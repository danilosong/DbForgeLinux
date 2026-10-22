/* global process, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-editor-pairs-ui-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', '04-editor-options')
let app
try {
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, HOME: dataRoot, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), TUXSQL_NO_DEV_LINK: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await page.getByTitle('New SQL Document (Ctrl+N)').click()
  await page.locator('.monaco-editor').waitFor()
  await page.locator('.monaco-editor').click()
  await page.keyboard.insertText('BEGIN\n  SELECT 1;\nEND;')
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('Control+F12')
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      const view = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
      await view.evaluate((element) => { element.open = true })
      await view.locator(':scope > .menu-popup > .menu-action').filter({ hasText: theme === 'light' ? /Theme: Light/ : /Theme: Dark/ }).click()
    }
    await page.screenshot({ path: join(evidence, `editor-begin-end-${theme}.png`) })
  }
  console.log('BEGIN/END Ctrl+F12 screenshots saved in light and dark themes.')
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
