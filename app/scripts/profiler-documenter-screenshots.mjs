/* global process, console, document, window, CustomEvent, HTMLDetailsElement, HTMLButtonElement, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(appPath)) throw new Error(`Packaged app not found at ${appPath}.`)
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-profiler-documenter-ui-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const profilerEvidence = join(evidenceRoot, '12-profiler-plan-canvas')
const documenterEvidence = join(evidenceRoot, '16-documenter-cover-designer')
let app
try {
  await mkdir(profilerEvidence, { recursive: true })
  await mkdir(documenterEvidence, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    await page.getByRole('button', { name: theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/ }).click()
    await page.locator('.workbench').waitFor()
  }
  const openMenuAction = async (menu, label, nestedLabel) => {
    if (nestedLabel) {
      await page.evaluate(({ menuName, actionLabel, nestedName }) => {
        const rootSummary = [...document.querySelectorAll('summary')].find((item) => item.textContent?.trim() === menuName)
        const root = rootSummary?.parentElement
        if (root instanceof HTMLDetailsElement) root.open = true
        const nestedSummary = [...(root?.querySelectorAll('summary') ?? [])].find((item) => item.textContent?.trim() === nestedName)
        const nested = nestedSummary?.parentElement
        if (nested instanceof HTMLDetailsElement) nested.open = true
        const action = [...(nested?.querySelectorAll('.menu-action') ?? [])].find((item) => item.textContent?.includes(actionLabel))
        if (!(action instanceof HTMLButtonElement)) throw new Error(`Menu action not found: ${actionLabel}`)
        action.click()
      }, { menuName: menu, actionLabel: label, nestedName: nestedLabel })
      return
    }
    await page.locator('summary').filter({ hasText: new RegExp(`^${menu}$`) }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: label }).last().click()
  }

  await chooseTheme('light')
  await openMenuAction('View', 'Profiler')
  const profiler = page.locator('.profiler-panel')
  await profiler.waitFor()
  await page.evaluate(() => {
    const plan = { operation: 'Nested loop join', table: 'orders', rows: 12, cost: 3.5, children: [{ operation: 'Index lookup', table: 'customers', rows: 2, cost: 1.1, children: [] }] }
    window.dispatchEvent(new CustomEvent('tuxsql:profiler-profile', { detail: { query: 'SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id', normalizedQuery: 'SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id', mode: 'EXPLAIN', startedAt: '2026-10-21T12:00:00.000Z', durationMs: 12.4, plan: { roots: [plan], warnings: [] }, statusDelta: { Questions: 1, Com_select: 1 }, events: [] } }))
  })
  await profiler.getByRole('button', { name: 'Plan Diagram' }).click()
  await profiler.locator('.profiler-plan-canvas svg').waitFor()
  await page.screenshot({ path: join(profilerEvidence, 'plan-diagram-light.png') })
  await chooseTheme('dark')
  await page.screenshot({ path: join(profilerEvidence, 'plan-diagram-dark.png') })
  const closeProfiler = page.locator('.panel-dialog-backdrop .panel-dialog-close').last()
  if (await closeProfiler.count()) await closeProfiler.click({ force: true })

  await chooseTheme('light')
  await openMenuAction('Database', 'Database documentation', 'Tasks')
  const documenter = page.locator('.documenter-panel')
  await documenter.waitFor()
  await documenter.locator('fieldset').first().locator('input[type="checkbox"]').check().catch(() => undefined)
  await documenter.locator('select').last().selectOption('ocean').catch(() => undefined)
  await page.screenshot({ path: join(documenterEvidence, 'cover-designer-light.png') })
  await chooseTheme('dark')
  await page.screenshot({ path: join(documenterEvidence, 'cover-designer-dark.png') })
  console.log(`Profiler and Documenter screenshots saved to ${profilerEvidence} and ${documenterEvidence}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
