/* global process, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-utilities-ui-'))
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
let app
try {
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, DISPLAY: process.env.DISPLAY, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    const wanted = theme === 'Light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
    if (await page.locator('html').getAttribute('data-theme') !== theme.toLowerCase()) {
      await page.locator('summary').filter({ hasText: 'View' }).click()
      await page.getByRole('button', { name: wanted }).click()
    }
  }
  await page.locator('summary').filter({ hasText: 'Database' }).click()
  await page.locator('.menu-popup .menu-action').filter({ hasText: /Find Object/i }).last().click()
  await page.locator('.database-tools-panel').waitFor()
  const tabs = [
    ['Find Object...', 'utilities-find-object'],
    ['Table Maintenance', 'utilities-table-maintenance'],
    ['SQL Formatter', 'utilities-sql-formatter'],
    ['Large Script', 'utilities-large-script']
  ]
  for (const [theme, suffix] of [['Light', 'light'], ['Dark', 'dark']]) {
    await chooseTheme(theme)
    for (const [tab, name] of tabs) {
      await page.locator('.database-tools-tabs button').filter({ hasText: tab }).click()
      await page.locator('.database-tools-panel').screenshot({ path: join(evidenceDirectory, `${name}-${suffix}.png`) })
    }
  }
  await page.locator('summary').filter({ hasText: 'Tools' }).click()
  await page.locator('.menu-popup .menu-action').filter({ hasText: /Snippets Manager/i }).click()
  await page.locator('.snippets-panel').waitFor()
  for (const [theme, suffix] of [['Light', 'light'], ['Dark', 'dark']]) {
    await chooseTheme(theme)
    await page.locator('.snippets-panel').screenshot({ path: join(evidenceDirectory, `utilities-snippets-${suffix}.png`) })
  }
  console.log(`Utility screenshots saved in ${evidenceDirectory}`)
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
