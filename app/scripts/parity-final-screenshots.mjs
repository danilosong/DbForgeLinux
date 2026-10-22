/* global process, console, window, CustomEvent, Event, HTMLInputElement, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-parity-final-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', 'parity-final')
let app
try {
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, LANGUAGE: 'en_US.UTF-8', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    const viewMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(View|Exibir)$/ }) })
    await viewMenu.evaluate((element) => { element.open = true })
    await page.getByRole('button', { name: theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/ }).click()
  }
  const openDocumenter = async () => {
    const databaseMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(Database|Banco de dados)$/ }) })
    await databaseMenu.evaluate((element) => { element.open = true })
    const tasksMenu = databaseMenu.locator('.menu-nested').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(Tasks|Tarefas)$/ }) })
    await tasksMenu.evaluate((element) => { element.open = true })
    await tasksMenu.locator(':scope > .menu-submenu > .menu-action').filter({ hasText: /Database documentation|Documentação do banco/i }).click()
    await page.locator('.documenter-cover-preview').waitFor()
  }
  await chooseTheme('light')
  await openDocumenter()
  await page.getByRole('textbox', { name: /Cover title|Título da capa/ }).fill('Sales catalog')
  await page.getByRole('textbox', { name: /Cover logo|Logo da capa/ }).fill('TuxSQL')
  const setColor = async (label, value) => page.getByLabel(label).evaluate((input, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nextValue)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
  await setColor(/Cover accent|Cor de destaque da capa/, '#0f766e')
  await setColor(/Cover background|Fundo da capa/, '#ccfbf1')
  await page.setViewportSize({ width: 1600, height: 1050 })
  await page.locator('.documenter-panel').evaluate((element) => { element.scrollTop = 0 })
  await page.screenshot({ path: join(evidence, 'documenter-cover-wysiwyg-light.png') })
  await chooseTheme('dark')
  await page.screenshot({ path: join(evidence, 'documenter-cover-wysiwyg-dark.png') })
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tuxsql:module-errors', { detail: ['Warning · statement 1 · Warning 1265: Data truncated for column value.'] })))
  await page.getByRole('table').waitFor()
  await page.screenshot({ path: join(evidence, 'error-list-server-warning-dark.png') })
  await chooseTheme('light')
  await page.screenshot({ path: join(evidence, 'error-list-server-warning-light.png') })
  const databaseMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(Database|Banco de dados)$/ }) })
  await databaseMenu.evaluate((element) => { element.open = true })
  const tasksMenu = databaseMenu.locator('.menu-nested').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(Tasks|Tarefas)$/ }) })
  await tasksMenu.evaluate((element) => { element.open = true })
  await tasksMenu.locator(':scope > .menu-submenu > .menu-action').filter({ hasText: /Import Data|Importar dados/i }).click()
  const importExportPanel = page.locator('section.io-wizard')
  await importExportPanel.waitFor()
  await importExportPanel.locator('select').filter({ has: page.locator('option[value="import"]') }).selectOption('import')
  await page.getByRole('button', { name: /^DBF\b/ }).waitFor()
  await page.getByRole('button', { name: /^DBF\b/ }).click()
  await page.screenshot({ path: join(evidence, 'legacy-import-formats-light.png') })
  await page.locator('.panel-dialog-close').click()
  await chooseTheme('dark')
  await databaseMenu.evaluate((element) => { element.open = true })
  await tasksMenu.evaluate((element) => { element.open = true })
  await tasksMenu.locator(':scope > .menu-submenu > .menu-action').filter({ hasText: /Import Data|Importar dados/i }).click()
  const darkImportExportPanel = page.locator('section.io-wizard')
  await darkImportExportPanel.waitFor()
  await darkImportExportPanel.locator('select').filter({ has: page.locator('option[value="import"]') }).selectOption('import')
  await page.getByRole('button', { name: /^DBF\b/ }).click()
  await page.screenshot({ path: join(evidence, 'legacy-import-formats-dark.png') })
  console.log(`Final parity UI evidence saved in ${evidence}.`)
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
