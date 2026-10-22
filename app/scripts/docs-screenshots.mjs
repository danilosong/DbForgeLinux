/* global process, console, setTimeout, clearTimeout, document, getComputedStyle */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const unpacked = resolve(process.cwd(), 'dist/linux-unpacked')
const executable = join(unpacked, existsSync(join(unpacked, 'tuxsql')) ? 'tuxsql' : 'electron')
if (!existsSync(executable)) throw new Error(`Packaged TuxSQL executable not found: ${executable}`)
const docsDirectory = resolve(process.cwd(), '../document/evidence/ui/docs')
const tempProfile = await mkdtemp(join(tmpdir(), 'tuxsql-docs-captures-'))
let application
try {
  await mkdir(docsDirectory, { recursive: true })
  application = await electron.launch({ executablePath: executable, args: [], env: {
    ...process.env,
    LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', LANGUAGE: 'en',
    XDG_CONFIG_HOME: join(tempProfile, 'config'), XDG_CACHE_HOME: join(tempProfile, 'cache'),
    XDG_DATA_HOME: join(tempProfile, 'data'), XDG_STATE_HOME: join(tempProfile, 'state'),
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  } })
  let mainPage
  for (let attempt = 0; attempt < 150 && !mainPage; attempt += 1) {
    for (const candidate of application.windows()) {
      if (await candidate.locator('.workbench').count()) { mainPage = candidate; break }
    }
    if (!mainPage) await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  if (!mainPage) throw new Error('TuxSQL workbench window did not open.')
  mainPage.setDefaultTimeout(15_000)
  const docsPageFor = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const found = application.windows().find((candidate) => candidate.url().startsWith('file:') && candidate.url().includes('/docs/'))
      if (found) return found
      await new Promise((resolveWait) => setTimeout(resolveWait, 100))
    }
    throw new Error('Offline documentation window did not open.')
  }
  for (const theme of ['light', 'dark']) {
    await mainPage.getByText('View', { exact: true }).click()
    await mainPage.getByRole('button', { name: theme === 'dark' ? 'Theme: Dark' : 'Theme: Light', exact: true }).click()
    await mainPage.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme)
    await mainPage.getByText('Help', { exact: true }).click()
    await mainPage.getByRole('button', { name: 'About…', exact: true }).click()
    await mainPage.locator('.about-panel').waitFor()
    await mainPage.getByRole('button', { name: 'Documentation', exact: true }).click()
    const docsPage = await docsPageFor()
    await docsPage.getByRole('heading', { name: 'Documentation', exact: true }).waitFor()
    const assertTheme = async (name) => {
      const values = await docsPage.evaluate(() => ({ theme: document.documentElement.dataset.theme, background: getComputedStyle(document.body).backgroundColor }))
      if (values.theme !== theme) throw new Error(`${name} expected ${theme} theme, received ${values.theme ?? 'unset'}`)
      const expectedBackground = theme === 'dark' ? 'rgb(11, 15, 23)' : 'rgb(241, 245, 249)'
      if (values.background !== expectedBackground) throw new Error(`${name} expected ${expectedBackground}, received ${values.background}`)
    }
    await assertTheme('documentation index')
    await docsPage.screenshot({ path: join(docsDirectory, `index-${theme}.png`), fullPage: true })
    await docsPage.getByRole('complementary', { name: 'Contents' }).getByRole('link', { name: 'SQL Editor and Results Grid', exact: true }).click()
    await docsPage.getByRole('heading', { name: 'SQL Editor and Results Grid', exact: true }).waitFor()
    await assertTheme('tool guide')
    await docsPage.screenshot({ path: join(docsDirectory, `sql-editor-results-${theme}.png`), fullPage: true })
    await docsPage.getByRole('complementary', { name: 'Contents' }).getByRole('link', { name: 'License and third-party notices', exact: true }).click()
    await docsPage.getByRole('heading', { name: 'License and third-party notices', exact: true }).waitFor()
    await assertTheme('license page')
    await docsPage.screenshot({ path: join(docsDirectory, `license-${theme}.png`), fullPage: true })
    await mainPage.locator('.about-panel footer').getByRole('button', { name: 'Close', exact: true }).click()
  }
  console.log(`Offline documentation screenshots saved in ${docsDirectory}`)
} finally {
  if (application) {
    const child = application.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try {
        await Promise.race([exited, new Promise((resolveWait) => { timer = setTimeout(resolveWait, 20_000) })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      } finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(tempProfile, { recursive: true, force: true })
}
