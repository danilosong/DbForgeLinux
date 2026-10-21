/* global process, console, setTimeout, clearTimeout, window, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const electronPath = process.env.DBFORGE_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')
if (!existsSync(electronPath)) throw new Error(`Packaged Electron executable not found at ${electronPath}. Run pnpm dist:deb first.`)
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-smoke-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
const testPrefix = mysqlTestPrefix('smoke')
const database = testPrefix
const targetDatabase = `${testPrefix}_target`
const docTable = `${testPrefix}_document`
const childTable = `${testPrefix}_child`
const dragTable = `${testPrefix}_drag`
const debugRoutine = `${testPrefix}_debug`
let debugSchemaExisted = false
let databaseCreated = false
let app
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')

async function dropDisposableDatabase(name) {
  let lastError
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try { await admin.query(`DROP DATABASE IF EXISTS \`${name.replaceAll('`', '``')}\``) }
    catch (error) { lastError = error }
    const [remaining] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [name])
    if (!remaining.length) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Could not remove disposable database ${name}: ${lastError instanceof Error ? lastError.message : 'database is still present'}`)
}
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  databaseCreated = true
  await admin.query(`CREATE DATABASE \`${targetDatabase}\``)
  await admin.query(`CREATE TABLE \`${database}\`.\`${docTable}\` (id INT PRIMARY KEY, label VARCHAR(40) NOT NULL)`)
  await admin.query(`CREATE TABLE \`${database}\`.\`${childTable}\` (id INT PRIMARY KEY, document_id INT NOT NULL, CONSTRAINT fk_smoke_document FOREIGN KEY (document_id) REFERENCES \`${docTable}\`(id))`)
  await admin.query(`CREATE TABLE \`${database}\`.\`${dragTable}\` (id INT PRIMARY KEY, note VARCHAR(40))`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.\`${docTable}\` (id INT PRIMARY KEY)`)
  const [debugSchemas] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'dbforge_linux_debug'")
  debugSchemaExisted = debugSchemas.length > 0
  await admin.query(`CREATE PROCEDURE \`${database}\`.\`${debugRoutine}\`()
BEGIN
  DECLARE current_value INT DEFAULT 0;
  SET current_value = current_value + 1;
  SELECT current_value;
END`)
  app = await electron.launch({
    executablePath: electronPath,
    args: ['--disable-gpu'],
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
  page.on('dialog', (dialog) => dialog.accept())
  await page.addLocatorHandler(page.locator('.panel-dialog-backdrop:has(.update-dialog)'), async () => {
    const laterButton = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
    if (await laterButton.count()) await laterButton.click()
    else await page.locator('.panel-dialog-close').last().click()
  })
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Smoke MySQL 33067')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
  await page.getByLabel('Password', { exact: true }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected\. Server version:/).waitFor()
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.selectOption(database)
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
  const documentation = await page.evaluate(async ({ targetDirectory, database }) => {
    const record = (await window.dbforge.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Documenter smoke connection was not saved.')
    const connection = await window.dbforge.connect(record)
    try {
      return await window.dbforge.generateDatabaseDocumentation({ connectionId: connection.id, database, title: 'Smoke database', outputDirectory: targetDirectory, formats: ['html', 'markdown', 'pdf'], includeDiagram: true, confirmed: true })
    } finally { await window.dbforge.disconnect(connection.id) }
  }, { targetDirectory: documentationDirectory, database })
  const pdf = await readFile(documentation.pdf)
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Documenter did not write a valid PDF header.')
  if (!(await readFile(documentation.html, 'utf8')).startsWith('<!doctype html>')) throw new Error('Documenter HTML output is invalid.')
  if (!(await readFile(documentation.markdown, 'utf8')).includes('Smoke database')) throw new Error('Documenter Markdown output is invalid.')

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
  await page.locator('.document-tab.selected .tab-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Database Diagram' }).click()
  await page.locator('.er-panel').waitFor()
  await page.locator('.document-tab.selected .tab-close').click()
  const tools = page.locator('.menu-row summary').filter({ hasText: 'Tools' })
  await tools.click()
  await page.getByRole('button', { name: 'Options…' }).click()
  await page.locator('.options-panel').waitFor()
  await page.locator('.panel-dialog-backdrop:has(.options-panel) .panel-dialog-close').click()
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
  const testDatabaseNode = page.locator('.database-name').filter({ hasText: database }).first()
  await testDatabaseNode.waitFor({ timeout: 15_000 })
  await testDatabaseNode.locator('span').click()
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

  // Explorer Generate Script As must create a SQL document without executing it.
  await smokeObject.click({ button: 'right' })
  const contextMenu = page.locator('.explorer-context-menu')
  await contextMenu.locator('.explorer-context-submenu > summary').filter({ hasText: 'Generate Script As' }).click()
  await contextMenu.locator('.explorer-context-submenu > summary').filter({ hasText: /^CREATE/i }).click()
  await contextMenu.getByRole('menuitem', { name: /To New SQL Window/ }).click()
  await page.getByRole('tab', { name: /SQL/ }).last().waitFor()
  await page.getByText(new RegExp(`CREATE TABLE.*${docTable}`, 's')).waitFor({ timeout: 15_000 })

  // Comparison menu and Schema Compare through its final review summary, with no execution.
  const comparison = page.locator('.menu-row summary').filter({ hasText: /^Comparison$/ })
  await comparison.click()
  await page.getByRole('button', { name: 'New Schema Comparison…' }).click()
  const schemaPanel = page.locator('.compare-panel')
  await schemaPanel.waitFor()
  const schemaInputs = schemaPanel.locator('fieldset .compare-form input')
  await schemaInputs.nth(0).fill(database)
  await schemaInputs.nth(1).fill(targetDatabase)
  await schemaPanel.getByRole('button', { name: /Compare \(F5\)/ }).click()
  await schemaPanel.getByText(/differences|diferenças|identical|idênticos/i).waitFor({ timeout: 30_000 })
  await schemaPanel.getByRole('button', { name: /Synchronize|Sincronizar/ }).click()
  const syncDialog = schemaPanel.getByRole('dialog')
  await syncDialog.waitFor()
  for (let step = 0; step < 3; step += 1) await syncDialog.getByRole('button', { name: /Next|Avançar/ }).click()
  await syncDialog.getByText(/Summary|Resumo/i).waitFor()
  await syncDialog.getByRole('button', { name: /Cancel|Cancelar/ }).click()

  // Table Designer sections remain accessible in the actual object editor.
  await smokeObject.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Open Editor', exact: true }).click()
  const designer = page.locator('.object-editor')
  await designer.waitFor()
  for (const pageName of ['General', 'Columns', 'Constraints', 'Indexes', 'Options', 'Triggers', 'Partitioning', 'Data', 'SQL']) {
    const tab = designer.locator('.object-editor-nav').getByRole('button', { name: new RegExp(`^${pageName}$`, 'i') }).first()
    if (await tab.count()) { await tab.click(); await tab.waitFor() }
  }
  await page.locator('.document-tab.selected .tab-close').click()

  // Query Builder opens from a real table, then adds its foreign-key parent and creates a JOIN.
  await page.getByRole('tab', { name: 'Start Page' }).click().catch(() => undefined)
  await smokeObject.click({ button: 'right' })
  await contextMenu.locator('.explorer-context-submenu > summary').filter({ hasText: 'Send to' }).click()
  await contextMenu.getByRole('menuitem', { name: 'Query Builder', exact: true }).click()
  const qb = page.locator('.qb-panel')
  await qb.waitFor()
  await qb.getByRole('button', { name: /Add table/i }).click()
  const tablePicker = qb.locator('.qb-table-list')
  await tablePicker.getByRole('button', { name: new RegExp(childTable) }).click()
  await qb.getByRole('button', { name: 'Joins', exact: true }).click()
  await qb.locator('.qb-join-tools select').first().selectOption('LEFT')
  await qb.locator('.qb-table-card').filter({ hasText: childTable }).locator('.qb-column-row').filter({ hasText: 'document_id' }).dragTo(qb.locator('.qb-table-card').filter({ hasText: docTable }).locator('.qb-column-row').filter({ hasText: 'id' }))
  await qb.locator('.qb-join-chip').getByText(/LEFT/).waitFor({ timeout: 15_000 })
  await qb.locator('.qb-join-lines path').waitFor()
  await qb.locator('.qb-view-tabs span').getByText(/LEFT JOIN/).waitFor()
  await mkdir(evidenceDirectory, { recursive: true })
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceDirectory, `query-builder-joins-${theme}.png`) })
  }
  await page.locator('.object-name').filter({ hasText: dragTable }).dragTo(qb.locator('.qb-canvas-wrap'))
  await qb.locator('.qb-table-card').filter({ hasText: dragTable }).waitFor({ timeout: 15_000 })

  // Tables and views from Explorer can be dropped onto a blank ER diagram.
  await smokeObject.click({ button: 'right' })
  await contextMenu.locator('.explorer-context-submenu > summary').filter({ hasText: 'Send to' }).click()
  await contextMenu.getByRole('menuitem', { name: 'Database Diagram', exact: true }).click()
  const erDiagram = page.locator('.er-panel')
  await erDiagram.waitFor()
  await page.locator('.object-name').filter({ hasText: dragTable }).dragTo(erDiagram.locator('.er-canvas-wrap, .er-empty').first())
  try { await erDiagram.locator('.er-table').filter({ hasText: dragTable }).waitFor({ timeout: 30_000 }) }
  catch { throw new Error(`ER Explorer drop did not add ${dragTable}: ${await erDiagram.innerText()}`) }
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceDirectory, `er-diagram-explorer-drop-${theme}.png`) })
  }


  // Export wizard is taken to its last confirmation page but never started.
  await smokeObject.click({ button: 'right' })
  await contextMenu.getByRole('menuitem', { name: /Export Data/ }).click()
  const exportPanel = page.locator('.io-wizard')
  await exportPanel.waitFor()
  await exportPanel.locator('.io-footer').getByRole('button', { name: /Next|Avançar/ }).click()
  const exportQuery = exportPanel.locator('textarea').first()
  await exportQuery.fill(`SELECT * FROM \`${database}\`.\`${docTable}\``)
  for (let step = 0; step < 7; step += 1) {
    const next = exportPanel.getByRole('button', { name: /Next|Avançar/ })
    if (!(await next.count())) break
    await next.click()
  }
  await exportPanel.getByRole('heading', { name: 'Ready to export' }).first().waitFor()
  if (await exportPanel.getByRole('button', { name: /^Export$/ }).count() !== 1) throw new Error('Export confirmation step is not visible.')
  await exportPanel.locator('.io-footer').getByRole('button', { name: /Cancel|Cancelar/ }).click()
  const exportClose = page.locator('.panel-dialog-backdrop:has(.io-wizard) .panel-dialog-close')
  if (await exportClose.count()) await exportClose.last().click()

  // Security user list and debugger deployment / stepping run against this disposable schema.
  await page.locator('.menu-row summary').filter({ hasText: /^Database$/ }).click()
  await page.getByRole('button', { name: /Security Manager/ }).click()
  const security = page.locator('.security-panel')
  await security.waitFor()
  await security.locator('.security-users button').first().waitFor({ timeout: 15_000 })
  await page.locator('.panel-dialog-backdrop:has(.security-panel) .panel-dialog-close').click()

  const debugMenu = page.locator('.menu-row summary').filter({ hasText: /^Debug$/ })
  await debugMenu.click()
  await page.getByRole('button', { name: /Start Debugging/ }).click()
  const debuggerPanel = page.locator('.routine-debugger')
  await debuggerPanel.waitFor()
  const debugConnection = debuggerPanel.locator('.rd-target select').nth(0)
  await debugConnection.selectOption({ label: 'Smoke MySQL 33067' })
  await debuggerPanel.locator('.rd-target select').nth(1).selectOption(database)
  await debuggerPanel.locator('.rd-target select').nth(2).selectOption(debugRoutine)
  await debuggerPanel.getByRole('button', { name: /Deploy Debug Engine|Deploy debugger support/i }).click()
  await debuggerPanel.getByText(/Engine installed|Engine v/).waitFor({ timeout: 30_000 })
  const [sqlModeRows] = await admin.query("SHOW GLOBAL VARIABLES LIKE 'sql_mode'")
  if (!String(sqlModeRows[0]?.Value).includes('STRICT')) throw new Error(`Debugger smoke requires a strict MySQL session default, received: ${sqlModeRows[0]?.Value}`)
  await debuggerPanel.locator('.rd-target').getByRole('button', { name: /Start Debugging/ }).click()
  try { await debuggerPanel.locator('.rd-toolbar span').filter({ hasText: /^paused/i }).waitFor({ timeout: 30_000 }) }
  catch { throw new Error(`Debugger did not pause after Start: ${await debuggerPanel.innerText()}`) }
  const stepInto = debuggerPanel.locator('.rd-toolbar').getByRole('button').nth(1)
  const lineBeforeStep = await debuggerPanel.locator('.rd-toolbar span').innerText()
  await stepInto.click()
  await page.waitForFunction((before) => {
    const value = document.querySelector('.routine-debugger .rd-toolbar span')?.textContent ?? ''
    return /running|paused|finished|error/i.test(value) && value !== before
  }, lineBeforeStep, { timeout: 15_000 })
  const stop = debuggerPanel.locator('.rd-toolbar').getByRole('button').nth(5)
  if (await stop.isEnabled()) await stop.click()

  console.log('Smoke e2e passed: Query Builder column drag join/edit/SQL, Explorer-to-Query Builder and ER Diagram drops, plus existing comparison/editor/security/debugger coverage.')
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
  try {
    if (databaseCreated) await dropDisposableDatabase(database)
    await dropDisposableDatabase(targetDatabase)
    if (!debugSchemaExisted) await dropDisposableDatabase('dbforge_linux_debug')
  } finally {
    await admin.end()
    await rm(dataRoot, { recursive: true, force: true })
  }
}
