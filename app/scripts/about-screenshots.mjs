/* global process, console, setTimeout, clearTimeout, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const packedApp = join(process.cwd(), 'dist', 'linux-unpacked')
const appPath = join(packedApp, existsSync(join(packedApp, 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-about-ui-'))
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
let app

try {
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: {
    ...process.env,
    XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'),
    XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'),
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const selectTheme = async (theme) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await page.locator('html').getAttribute('data-theme') === theme) return
      await page.locator('button[title="Auto theme"]').click()
    }
    if (await page.locator('html').getAttribute('data-theme') !== theme) throw new Error(`Could not select ${theme} theme.`)
  }
  for (const theme of ['light', 'dark']) {
    await selectTheme(theme)
    await page.locator('summary').filter({ hasText: /^Help$/ }).click()
    await page.locator('.menu-action').filter({ hasText: /About dbForgeLinux|Sobre o dbForgeLinux/i }).click()
    await page.locator('.about-panel').waitFor()
    await page.waitForFunction(() => {
      const versions = [...document.querySelectorAll('.about-versions dd')]
      return versions.length === 6 && versions.every((item) => item.textContent !== '…')
    })
    await page.screenshot({ path: join(evidenceDirectory, `about-${theme}.png`), fullPage: true })
    await page.locator('.about-panel footer button').last().click()
    await page.locator('.about-panel').waitFor({ state: 'detached' })
  }
  console.log(`About screenshots saved in ${evidenceDirectory}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try {
        await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      } finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
