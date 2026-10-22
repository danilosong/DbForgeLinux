/* global process, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-editor-options-ui-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui', '04-editor-options')
let app
try {
  await mkdir(evidenceRoot, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, HOME: dataRoot, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const setTheme = async (theme) => {
    const expected = theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
    if (await page.locator('html').getAttribute('data-theme') === theme) return
    await page.locator('summary').filter({ hasText: /^View$/ }).click()
    await page.getByRole('button', { name: expected }).click()
  }
  const openOptions = async () => {
    await page.locator('summary').filter({ hasText: /^Tools$/ }).click()
    await page.getByRole('button', { name: /^Options/ }).click()
    await page.locator('.options-panel').waitFor()
  }
  const capture = async (file) => page.locator('.options-panel').screenshot({ path: join(evidenceRoot, file) })

  await page.getByTitle('New SQL Document (Ctrl+N)').click()
  await page.locator('.monaco-editor').waitFor()
  await page.locator('.monaco-editor').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText('SELECT IF(1,')
  await page.keyboard.press('Control+Shift+Space')
  const parameterWidget = page.locator('.parameter-hints-widget')
  await parameterWidget.waitFor({ timeout: 5000 })
  console.log(`Parameter Info: ${await parameterWidget.innerText()}`)
  for (const theme of ['light', 'dark']) {
    await setTheme(theme)
    await page.screenshot({ path: join(evidenceRoot, `parameter-info-${theme}.png`) })
  }

  await setTheme('light')
  await openOptions()
  await capture('options-startup-light.png')
  await page.locator('.panel-dialog-close').click()
  await setTheme('dark')
  await openOptions()
  await capture('options-startup-dark.png')
  const profilerGroup = page.locator('.options-tree-group').filter({ hasText: 'Query Profiler' })
  await profilerGroup.getByRole('button', { name: 'General', exact: true }).click()
  await page.getByText('Maximum profile history entries', { exact: true }).waitFor()
  await page.locator('.options-layout').evaluate((element) => { element.scrollTop = 0 })
  await capture('options-profiler-dark.png')
  await page.locator('.panel-dialog-close').click()
  await setTheme('light')
  await openOptions()
  const lightProfilerGroup = page.locator('.options-tree-group').filter({ hasText: 'Query Profiler' })
  await lightProfilerGroup.getByRole('button', { name: 'General', exact: true }).click()
  await page.getByText('Maximum profile history entries', { exact: true }).waitFor()
  await page.locator('.options-layout').evaluate((element) => { element.scrollTop = 0 })
  await capture('options-profiler-light.png')
  await page.locator('.panel-dialog-close').click()
  for (const theme of ['light', 'dark']) {
    await setTheme(theme)
    await openOptions()
    const debuggingGroup = page.locator('.options-tree-group').filter({ hasText: 'Debugging' })
    await debuggingGroup.getByRole('button', { name: 'General', exact: true }).click()
    await page.getByText('Debugging session timeout (seconds)', { exact: true }).waitFor()
    await capture(`options-debugging-${theme}.png`)
    await page.locator('label.options-field').filter({ hasText: 'Debugging session timeout (seconds)' }).screenshot({ path: join(evidenceRoot, `options-debugging-setting-${theme}.png`) })
    await page.locator('.panel-dialog-close').click()
  }
  console.log(`Editor and Options screenshots saved in ${evidenceRoot}`)
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
