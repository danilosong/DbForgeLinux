/* global process, console, setTimeout, clearTimeout, window, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

const electronPath = process.env.DBFORGE_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')
if (!existsSync(electronPath)) throw new Error(`Packaged Electron executable not found at ${electronPath}. Run pnpm dist:deb first.`)
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-smoke-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
const docTable = `smoke_doc_${process.pid}`
let app
try {
  await admin.query("CREATE USER IF NOT EXISTS 'dbforge_smoke'@'%' IDENTIFIED BY ''")
  await admin.query("ALTER USER 'dbforge_smoke'@'%' IDENTIFIED BY ''")
  await admin.query('GRANT ALL PRIVILEGES ON sample.* TO `dbforge_smoke`@`%`')
  await admin.query(`CREATE TABLE sample.\`${docTable}\` (id INT PRIMARY KEY, label VARCHAR(40) NOT NULL)`)
  app = await electron.launch({
    executablePath: electronPath,
    args: [],
    cwd: process.cwd(),
    timeout: 90_000,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  const page = await app.firstWindow()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Smoke MySQL 33067')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('dbforge_smoke')
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected\. Server version:/).waitFor()
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.selectOption('sample')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  const scalar = await page.evaluate(async () => {
    const record = (await window.dbforge.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Smoke connection was not saved.')
    const connection = await window.dbforge.connect(record)
    try {
      const results = await window.dbforge.executeSql(connection.id, 'SELECT 1 AS smoke')
      const result = results[0]
      const rows = result?.resultStoreId ? await window.dbforge.readResultRows(result.resultStoreId, 0, 1) : result?.rows ?? []
      if (result?.resultStoreId) await window.dbforge.disposeResult(result.resultStoreId)
      return rows[0]?.smoke
    } finally { await window.dbforge.disconnect(connection.id) }
  })
  if (Number(scalar) !== 1) throw new Error(`SELECT 1 returned ${String(scalar)}.`)

  const documentationDirectory = join(dataRoot, 'documentation')
  const documentation = await page.evaluate(async ({ targetDirectory }) => {
    const record = (await window.dbforge.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Documenter smoke connection was not saved.')
    const connection = await window.dbforge.connect(record)
    try {
      return await window.dbforge.generateDatabaseDocumentation({ connectionId: connection.id, database: 'sample', title: 'Smoke database', outputDirectory: targetDirectory, formats: ['html', 'markdown', 'pdf'], includeDiagram: true, confirmed: true })
    } finally { await window.dbforge.disconnect(connection.id) }
  }, { targetDirectory: documentationDirectory })
  const pdf = await readFile(documentation.pdf)
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Documenter did not write a valid PDF header.')
  if (!(await readFile(documentation.html, 'utf8')).startsWith('<!doctype html>')) throw new Error('Documenter HTML output is invalid.')
  if (!(await readFile(documentation.markdown, 'utf8')).startsWith('# Smoke database')) throw new Error('Documenter Markdown output is invalid.')

  await page.getByRole('heading', { name: 'Recent Connections' }).waitFor()
  await page.locator('.start-page .start-recent-list').first().getByRole('button', { name: /Smoke MySQL 33067/ }).waitFor()
  const recentSqlPath = join(dataRoot, 'recent-e2e.sql')
  await writeFile(recentSqlPath, 'SELECT 1 AS recent_file;\n', 'utf8')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, recentSqlPath)
  await page.getByRole('button', { name: 'Open SQL File…' }).click()
  await page.getByText('SELECT 1 AS recent_file;', { exact: true }).waitFor()
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.locator('.grid-result').waitFor()
  await page.locator('.grid-result tbody tr td').filter({ hasText: /^1$/ }).first().waitFor()
  await page.locator('.workbench.panel-hidden').waitFor()
  const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
  await mkdir(evidenceDirectory, { recursive: true })
  await page.screenshot({ path: join(evidenceDirectory, 'reconcile-ui-light.png') })
  await page.locator('summary').filter({ hasText: 'View' }).click()
  await page.getByRole('button', { name: 'Theme: Dark', exact: true }).click()
  await page.locator('.workbench').waitFor()
  await page.screenshot({ path: join(evidenceDirectory, 'reconcile-ui-dark.png') })
  await page.locator('summary').filter({ hasText: 'View' }).click()
  await page.getByRole('button', { name: 'Theme: Light', exact: true }).click()
  await page.getByRole('tab', { name: 'Start Page' }).click()
  const recentFile = page.locator('.start-page').getByRole('button', { name: /recent-e2e\.sql/ })
  await recentFile.waitFor()
  await recentFile.click()
  await page.getByText('SELECT 1 AS recent_file;', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Start Page' }).click()
  await page.getByRole('button', { name: 'New SQL', exact: true }).click()
  await page.getByRole('tab', { name: /SQL/ }).last().waitFor()

  const databaseMenu = page.locator('.menu-row summary').filter({ hasText: 'Database' })
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Find Object…' }).click()
  await page.locator('.database-tools-panel').waitFor()
  await page.locator('.panel-dialog-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Database Diagram' }).click()
  await page.locator('.er-panel').waitFor()
  const erDialogClose = page.locator('.panel-dialog-close')
  if (await erDialogClose.count()) await erDialogClose.click()
  else await page.locator('.document-tab.selected .tab-close').click()
  const tools = page.locator('.menu-row summary').filter({ hasText: 'Tools' })
  await tools.click()
  await page.getByRole('button', { name: 'Options…' }).click()
  await page.locator('.options-panel').waitFor()
  await page.locator('.panel-dialog-close').click()
  await page.evaluate(() => window.dispatchEvent(new window.CustomEvent('dbforge:insert-ai-sql', { detail: { sql: 'SELECT 1 AS recent_file;\nSELECT 2 AS next_result;' } })))
  await page.waitForFunction(() => document.querySelector('.sql-context-toolbar')?.textContent?.includes('AI Assistant SQL'))
  const chooseTheme = async (theme) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await page.locator('html').getAttribute('data-theme') === theme.toLowerCase()) return
      await page.locator('button[title="Auto theme"]').click()
    }
    if (await page.locator('html').getAttribute('data-theme') !== theme.toLowerCase()) throw new Error(`Could not switch to ${theme} theme.`)
    await page.locator('.workbench').waitFor()
  }
  const captureBothThemes = async (name) => {
    await chooseTheme('Light')
    await page.screenshot({ path: join(evidenceDirectory, `${name}-light.png`) })
    await chooseTheme('Dark')
    await page.screenshot({ path: join(evidenceDirectory, `${name}-dark.png`) })
  }
  const captureMenus = async (theme) => {
    await chooseTheme(theme)
    for (const menu of ['File', 'Edit', 'View', 'Database', 'Comparison', 'SQL', 'Tools', 'Window', 'Help']) {
      const summary = page.locator('.menu-row summary').filter({ hasText: new RegExp(`^${menu}$`) })
      if (!(await summary.count())) continue
      await summary.click()
      await page.screenshot({ path: join(evidenceDirectory, `menus-${menu.toLowerCase()}-${theme.toLowerCase()}.png`) })
      await summary.click()
    }
  }
  await page.addLocatorHandler(page.locator('.panel-dialog-backdrop:has(.update-dialog)'), async () => {
    const laterButton = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
    if (await laterButton.count()) await laterButton.click()
    else await page.locator('.panel-dialog-close').last().click()
  })
  await captureMenus('Light')
  await captureMenus('Dark')
  await page.keyboard.press('Control+Shift+F')
  await page.locator('.find-toolbar input[type="search"]').fill('SELECT')
  await page.locator('.navigation-list button').first().waitFor()
  await captureBothThemes('find-results')
  await page.keyboard.press('Control+H')
  await page.locator('.find-toolbar input[placeholder="Replace"]').fill('2')
  await captureBothThemes('find-replace')
  await page.keyboard.press('Control+Alt+U')
  await page.locator('.tool-document .navigation-panel').waitFor()
  await captureBothThemes('document-outline')
  await page.locator('summary').filter({ hasText: 'View' }).click()
  await page.locator('.menu-action').filter({ hasText: /Schema View|Visualização do esquema/ }).click()
  await page.locator('.schema-overview').waitFor()
  await captureBothThemes('schema-view')
  const connectionNode = page.locator('.node-name').filter({ hasText: 'Smoke MySQL 33067' })
  if (await connectionNode.count()) await connectionNode.click()
  const sampleDatabase = page.locator('.database-name').filter({ hasText: 'sample' }).first()
  await sampleDatabase.waitFor({ timeout: 15_000 })
  await sampleDatabase.locator('span').click()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  const smokeObject = page.locator('.object-name').filter({ hasText: docTable }).first()
  await smokeObject.waitFor({ timeout: 15_000 })
  await smokeObject.click()
  await page.keyboard.press('F4')
  await page.locator('.object-viewer').waitFor()
  await page.locator('.object-viewer pre').waitFor()
  await captureBothThemes('object-viewer')
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await smokeObject.click({ button: 'right' })
    const contextMenu = page.locator('.explorer-context-menu')
    await contextMenu.waitFor()
    for (const label of ['New Table', 'Open Editor', 'Open Data in Editor', 'Select All Rows', 'Export Data…', 'Import Data…', 'Generate Data…', 'Table Maintenance…', 'Flush', 'Truncate Table', 'Duplicate Object…', 'Generate Script As', 'Send to', 'Edit Privileges', 'Show Details', 'Rename', 'Delete', 'Refresh', 'Properties']) {
      const target = ['Generate Script As', 'Send to'].includes(label)
        ? contextMenu.locator('.explorer-context-submenu > summary').filter({ hasText: label }).first()
        : contextMenu.locator('button[role="menuitem"]').filter({ hasText: label }).first()
      await target.waitFor()
    }
    await page.screenshot({ path: join(evidenceDirectory, `explorer-table-menu-${theme.toLowerCase()}.png`) })
    await page.keyboard.press('Escape')
  }
  console.log('Smoke e2e passed: MySQL connection, SQL/grid, documentation, navigation panels, object properties, table context actions, and light/dark evidence.')
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
  await admin.query("DROP USER IF EXISTS 'dbforge_smoke'@'%'")
  await admin.query(`DROP TABLE IF EXISTS sample.\`${docTable}\``)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
