/* global process, console */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-documenter-ui-'))
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
let app
try {
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    await page.getByRole('button', { name: theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/ }).click()
    await page.locator('.workbench').waitFor()
  }
  const openDatabaseAction = async (title, selector) => {
    await page.locator('summary').filter({ hasText: 'Database' }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: new RegExp(title, 'i') }).last().click()
    await page.locator(selector).waitFor()
  }
  const capture = async (menuTitle, selector, basename) => {
    await chooseTheme('light')
    await openDatabaseAction(menuTitle, selector)
    await page.screenshot({ path: join(evidenceDirectory, `${basename}-light.png`) })
    await chooseTheme('dark')
    await page.screenshot({ path: join(evidenceDirectory, `${basename}-dark.png`) })
  }
  await capture('Database documentation', '.documenter-panel', 'documenter-cover')
  await capture('Report Designer', '.report-pivot-panel', 'report-pivot-dnd')
  console.log(`Documenter and Report/Pivot screenshots saved in ${evidenceDirectory}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try {
        await Promise.race([exited, new Promise((resolve) => { timer = globalThis.setTimeout(resolve, 30_000) })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      } finally { if (timer) globalThis.clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
