/* global process, console, setTimeout, clearTimeout, window, CustomEvent */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-shared-warning-ui-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
let app
try {
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [join(process.cwd(), 'out', 'main', 'index.js')], cwd: process.cwd(), env: { ...process.env, HOME: dataRoot, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), TUXSQL_NO_DEV_LINK: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const setTheme = async (theme) => {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      const view = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
      await view.evaluate((element) => { element.open = true })
      await view.locator(':scope > .menu-popup > .menu-action').filter({ hasText: theme === 'light' ? /Theme: Light/ : /Theme: Dark/ }).click()
    }
  }
  for (const theme of ['light', 'dark']) {
    await setTheme(theme)
    const view = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
    await view.evaluate((element) => { element.open = true })
    await view.locator(':scope > .menu-popup > .menu-action').filter({ hasText: /Source Control Manager/ }).click()
    await page.locator('.source-control-panel').waitFor()
    await page.locator('.sc-legacy-readonly').screenshot({ path: join(evidence, `source-control-legacy-readonly-${theme}.png`) })
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('tuxsql:source-control:link')))
    await page.locator('.sc-wizard').waitFor()
    await page.getByRole('radio', { name: /Shared/ }).check()
    await page.locator('.sc-shared-warning').waitFor()
    await page.locator('.sc-wizard').screenshot({ path: join(evidence, `source-control-shared-warning-${theme}.png`) })
    await page.locator('.sc-wizard header button').click()
    await page.locator('.panel-dialog-close').click()
  }
  console.log('Shared model warning captured in light and dark themes.')
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
