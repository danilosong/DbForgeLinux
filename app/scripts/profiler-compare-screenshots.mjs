/* global process, window, CustomEvent, document, HTMLDetailsElement, HTMLButtonElement, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const executable = join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(executable)) throw new Error(`Packaged app not found at ${executable}.`)
const root = await mkdtemp(join(tmpdir(), 'tuxsql-profiler-compare-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', '12-profiler-plan-canvas')
let app
try {
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: executable, args: [], env: { ...process.env, LANG: 'en_US.UTF-8', LANGUAGE: 'en', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_DATA_HOME: join(root, 'data'), XDG_STATE_HOME: join(root, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await page.evaluate(() => {
    const view = [...document.querySelectorAll('.menu-row > details')].find((item) => item.querySelector(':scope > summary')?.textContent?.trim() === 'View')
    if (!(view instanceof HTMLDetailsElement)) throw new Error('View menu missing.')
    view.open = true
    const action = [...view.querySelectorAll('.menu-action')].find((item) => item.textContent?.trim() === 'Profiler')
    if (!(action instanceof HTMLButtonElement)) throw new Error('Profiler menu action missing.')
    action.click()
  })
  const profiler = page.locator('.profiler-panel')
  await profiler.waitFor()
  for (let index = 0; index < 5; index++) {
    await page.evaluate(({ index }) => {
      const plan = { operation: 'Table scan', table: `orders_${index + 1}`, rows: 10 + index, cost: 2 + index, children: [] }
      window.dispatchEvent(new CustomEvent('tuxsql:profiler-profile', { detail: { query: `SELECT * FROM orders WHERE batch = ${index + 1}`, normalizedQuery: 'SELECT * FROM orders WHERE batch = ?', mode: 'EXPLAIN', startedAt: `2026-10-21T12:00:0${index}.000Z`, durationMs: 10 + index * 2, plan: { roots: [plan], warnings: [] }, statusDelta: { Questions: 1 + index, Com_select: 1, Rows_sent: 10 + index }, events: [] } }))
    }, { index })
    await page.waitForTimeout(80)
  }
  const runs = profiler.getByRole('checkbox', { name: /^Select run [1-5] for comparison$/ })
  await profiler.getByRole('combobox', { name: 'Compare' }).selectOption('5')
  await profiler.getByText('Compare 5 executions').waitFor()
  await page.screenshot({ path: join(evidence, 'comparison-five-light.png') })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.screenshot({ path: join(evidence, 'comparison-five-dark.png') })
  if (await runs.count() !== 5) throw new Error('Expected five selectable profile runs.')
  console.log(`Saved five-run Profiler comparison screenshots in ${evidence}.`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); let timer; try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } } finally { if (timer) clearTimeout(timer) } }
  }
  await rm(root, { recursive: true, force: true })
}
