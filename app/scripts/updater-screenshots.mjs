/* global process, console, setTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-updater-ui-'))
const output = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const unpacked = join(process.cwd(), 'dist', 'linux-unpacked')
const executablePath = join(unpacked, existsSync(join(unpacked, 'tuxsql')) ? 'tuxsql' : 'electron')
const app = await electron.launch({
  executablePath,
  args: [], cwd: process.cwd(), timeout: 90_000,
  env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
})
try {
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const openUpdaterOptions = async () => {
    await page.locator('.menu-row summary').filter({ hasText: /^Tools$/ }).click()
    await page.getByRole('button', { name: /Options/ }).click()
    await page.locator('.options-panel').waitFor()
    await page.locator('.options-sidebar nav').getByRole('button', { name: /General|Geral/ }).first().click()
    await page.locator('.options-page h3').filter({ hasText: /General|Geral/ }).waitFor()
  }
  await openUpdaterOptions()
  await mkdir(output, { recursive: true })
  for (const [index, theme] of ['Light', 'Dark'].entries()) {
    if (index > 0) {
      await page.locator('.panel-dialog-close').click()
      await page.locator('button[title="Auto theme"]').click()
      await openUpdaterOptions()
    }
    await page.locator('.options-panel').waitFor()
    await page.screenshot({ path: join(output, `updater-options-${theme.toLowerCase()}.png`) })
  }
  console.log('Saved updater options screenshots in light and dark themes.')
} finally {
  const child = app.process()
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 30_000))])
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
