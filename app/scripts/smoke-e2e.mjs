/* global process, console, setTimeout, clearTimeout, window, document, localStorage, CustomEvent, navigator, DOMException */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

const electronPath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(electronPath)) throw new Error(`Packaged Electron executable not found at ${electronPath}. Run pnpm dist:deb first.`)
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-smoke-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
// Keep this long-running E2E schema outside mysql:clean-test's broad tuxsql_test_ sweep.
const testPrefix = `qa_smoke_${process.pid}_${randomUUID().slice(0, 8)}`
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
  await admin.query(`INSERT INTO \`${database}\`.\`${docTable}\` VALUES (1, 'Smoke card')`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.\`${docTable}\` (id INT PRIMARY KEY)`)
  await admin.query(`CREATE TABLE \`${database}\`.\`custom_compare_rows\` (id INT PRIMARY KEY, label VARCHAR(40), changed_at DATETIME(6))`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.\`custom_compare_rows\` (id INT PRIMARY KEY, label VARCHAR(40), changed_at DATETIME(6))`)
  await admin.query(`INSERT INTO \`${database}\`.\`custom_compare_rows\` VALUES (1, 'same', '2025-01-01 12:00:00.100000'), (2, 'source', '2025-01-01 12:00:00.100000')`)
  await admin.query(`INSERT INTO \`${targetDatabase}\`.\`custom_compare_rows\` VALUES (1, 'same', '2025-01-01 12:00:00.900000'), (3, 'target', '2025-01-01 12:00:00.900000')`)
  const [debugSchemas] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'tuxsql_linux_debug'")
  debugSchemaExisted = debugSchemas.length > 0
  await admin.query(`CREATE PROCEDURE \`${database}\`.\`${debugRoutine}\`()
BEGIN
  DECLARE current_value INT DEFAULT 0;
  SET current_value = current_value + 1;
  SELECT current_value;
END`)
  app = await electron.launch({
    executablePath: electronPath,
    args: ['--disable-gpu', '--use-fake-device-for-media-stream'],
    cwd: process.cwd(),
    timeout: 90_000,
    env: {
      ...process.env,
      LANGUAGE: 'en',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  const page = await app.firstWindow()
  await app.evaluate(({ ipcMain }) => {
    const calls = []
    ipcMain.__assistantFinishOpenCalls = calls
    ipcMain.removeHandler('file:open-in-system')
    ipcMain.handle('file:open-in-system', (_event, path, kind) => { calls.push({ path, kind }); return '' })
  })
  await page.waitForFunction(() => window.performance.getEntriesByName('tuxsql:first-paint-settled', 'mark').length > 0, null, { timeout: 15_000 })
  await page.evaluate(async () => {
    const probe = `tuxsql-clipboard-${Date.now()}`
    await navigator.clipboard.writeText(probe)
    if (await navigator.clipboard.readText() !== probe) throw new Error('Primary-window clipboard read/write permission is unavailable.')
  })
  await page.evaluate(() => window.tuxsql.openAboutLink('documentation', 'en', 'light'))
  let docsPage
  for (let attempt = 0; attempt < 40 && !docsPage; attempt += 1) {
    for (const candidate of app.windows()) {
      if (candidate !== page && candidate.url().includes('/docs/')) { docsPage = candidate; break }
    }
    if (!docsPage) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!docsPage) throw new Error('Offline documentation window did not open.')
  const docsMediaResult = await docsPage.evaluate(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unavailable'
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); return 'granted' }
    catch (error) { return error instanceof DOMException ? error.name : 'rejected' }
  })
  if (docsMediaResult !== 'NotAllowedError') throw new Error(`Documentation window media permission was ${docsMediaResult}; expected NotAllowedError.`)
  await docsPage.close()
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
    const record = (await window.tuxsql.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Smoke connection was not saved.')
    const connection = await window.tuxsql.connect(record)
    try {
      const results = await window.tuxsql.executeSql(connection.id, 'SELECT 1 AS smoke')
      const result = results[0]
      const rows = result?.resultStoreId ? await window.tuxsql.readResultRows(result.resultStoreId, 0, 1) : result?.rows ?? []
      if (result?.resultStoreId) await window.tuxsql.disposeResult(result.resultStoreId)
      return rows[0]?.smoke
    } finally { await window.tuxsql.disconnect(connection.id) }
  })
  if (Number(scalar) !== 1) throw new Error(`SELECT 1 returned ${String(scalar)}.`)

  const fileMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^File$/ }) })
  await fileMenu.evaluate((element) => { element.open = true })
  await fileMenu.getByRole('button', { name: /New SQL/ }).click()
  const firstSqlTab = page.locator('.document-tab.selected')
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.insertText('SELECT 42 AS floated;')
  await firstSqlTab.locator('.tab-label').click({ button: 'right' })
  await page.locator('.tab-context-menu').getByRole('menuitem', { name: /Float/ }).click()
  let floatingWindow
  for (let attempt = 0; attempt < 60 && !floatingWindow; attempt += 1) {
    for (const candidate of app.windows()) {
      if (await candidate.locator('.float-sql-document').count()) { floatingWindow = candidate; break }
    }
    if (!floatingWindow) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!floatingWindow) { const windows = app.windows(); const states = await Promise.all(windows.map(async (candidate) => ({ url: candidate.url(), title: await candidate.title(), body: (await candidate.locator('body').innerText().catch(() => '')).slice(0, 240) }))); throw new Error(`Float did not render its SQL document window: ${JSON.stringify(states)}`) }
  const floatEditor = floatingWindow.locator('.float-sql-document textarea')
  if (!(await floatEditor.inputValue()).includes('SELECT 42 AS floated')) throw new Error('Floated SQL window did not display the selected document.')
  await floatEditor.fill('SELECT 43 AS synchronized;')
  if (await floatEditor.inputValue() !== 'SELECT 43 AS synchronized;') throw new Error(`Floated SQL editor did not accept edits: ${await floatEditor.inputValue()}`)
  const floatDocumentId = (await firstSqlTab.locator('.tab-label').getAttribute('id')).replace('document-tab-control-', '')
  await page.waitForFunction(({ id, expected }) => JSON.parse(localStorage.getItem('tuxsql.sqlDrafts') ?? '{}')[id]?.includes(expected), { id: floatDocumentId, expected: 'SELECT 43 AS synchronized' }, { timeout: 10_000 })
  await floatingWindow.close()
  await fileMenu.evaluate((element) => { element.open = true })
  await fileMenu.getByRole('button', { name: /New SQL/ }).click()
  const selectedTabForGroup = page.locator('.document-tab.selected')
  const otherSqlTab = page.locator('.document-tab').nth(1)
  await otherSqlTab.locator('.tab-label').click({ button: 'right' })
  await page.locator('.tab-context-menu').getByRole('menuitem', { name: /New Vertical Tab Group/ }).click()
  if (!(await otherSqlTab.getAttribute('class'))?.includes('group-vertical') || !(await selectedTabForGroup.getAttribute('class'))?.includes('group-vertical')) throw new Error('Dragging an SQL tab did not form a vertical tab group.')
  const secondaryEditor = page.getByRole('textbox', { name: 'Secondary document editor' })
  await secondaryEditor.fill('SELECT 17 AS split_sync;')
  if (await secondaryEditor.inputValue() !== 'SELECT 17 AS split_sync;') throw new Error('The secondary SQL editor did not accept input.')
  const splitDocumentId = (await otherSqlTab.locator('.tab-label').getAttribute('id')).replace('document-tab-control-', '')
  await page.waitForFunction(({ id, expected }) => JSON.parse(localStorage.getItem('tuxsql.sqlDrafts') ?? '{}')[id]?.includes(expected), { id: splitDocumentId, expected: 'SELECT 17 AS split_sync' }, { timeout: 10_000 })
  const explorerFilter = page.getByRole('textbox', { name: /Filter connections/ })
  await explorerFilter.fill('^Smoke MySQL')
  await page.getByLabel('Regex').check()
  if (await page.locator('.connection-node').count() !== 1) throw new Error('Explorer regex filter did not match the disposable smoke connection.')
  await page.getByRole('tab', { name: 'Start Page' }).click()

  const documentationDirectory = join(dataRoot, 'documentation')
  const documentation = await page.evaluate(async ({ targetDirectory, database }) => {
    const record = (await window.tuxsql.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Documenter smoke connection was not saved.')
    const connection = await window.tuxsql.connect(record)
    try {
      return await window.tuxsql.generateDatabaseDocumentation({ connectionId: connection.id, database, title: 'Smoke database', outputDirectory: targetDirectory, formats: ['html', 'markdown', 'pdf'], includeDiagram: true, confirmed: true })
    } finally { await window.tuxsql.disconnect(connection.id) }
  }, { targetDirectory: documentationDirectory, database })
  const pdf = await readFile(documentation.pdf)
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Documenter did not write a valid PDF header.')
  if (!(await readFile(documentation.html, 'utf8')).startsWith('<!doctype html>')) throw new Error('Documenter HTML output is invalid.')
  if (!(await readFile(documentation.markdown, 'utf8')).includes('Smoke database')) throw new Error('Documenter Markdown output is invalid.')

  await page.getByRole('heading', { name: 'Recent Connections' }).waitFor()
  await page.locator('.start-page .start-recent-list').first().getByRole('button', { name: /Smoke MySQL 33067/ }).waitFor()
  const recentSqlPath = join(dataRoot, 'recent-e2e.sql')
  const gridQuery = `SELECT * FROM \`${database}\`.\`${docTable}\`;`
  await writeFile(recentSqlPath, `${gridQuery}\n`, 'utf8')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, recentSqlPath)
  await page.getByRole('button', { name: 'Open SQL File…' }).click()
  await page.getByText(gridQuery, { exact: true }).waitFor()
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.locator('.grid-result').waitFor()
  const gridRow = page.locator('.grid-result tbody tr').filter({ hasText: 'Smoke card' }).first()
  await gridRow.waitFor()
  const gridCell = gridRow.locator('td').filter({ hasText: 'Smoke card' }).first()
  await gridCell.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Copy cell' }).click()
  const copiedGridValue = await page.evaluate(() => navigator.clipboard.readText())
  if (copiedGridValue !== 'Smoke card') throw new Error(`Grid copy put ${JSON.stringify(copiedGridValue)} on the clipboard.`)
  await page.evaluate(() => navigator.clipboard.writeText('2\tPasted smoke'))
  const pastePayload = await page.evaluate(() => navigator.clipboard.readText())
  if (pastePayload !== '2\tPasted smoke') throw new Error(`Grid paste could not read clipboard data: ${JSON.stringify(pastePayload)}.`)
  await page.locator('.workbench.panel-hidden').waitFor()
  await mkdir(evidenceDirectory, { recursive: true })
  await page.screenshot({ path: join(evidenceDirectory, 'reconcile-ui-light.png') })
  // Menu bar: opening a second menu must close the first, and Escape closes the open one.
  await page.locator('.menu-row summary').filter({ hasText: /^File$/ }).click()
  await page.locator('.menu-row summary').filter({ hasText: /^Edit$/ }).click()
  if ((await page.locator('.menu-row > details[open]').count()) !== 1) throw new Error('Opening a second menu must close the first one')
  await page.keyboard.press('Escape')
  if ((await page.locator('.menu-row > details[open]').count()) !== 0) throw new Error('Escape must close the open menu')
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
  await page.getByText(gridQuery, { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Start Page' }).click()
  await page.getByRole('button', { name: 'New SQL', exact: true }).click()
  await page.getByRole('tab', { name: /SQL/ }).last().waitFor()

  const databaseMenu = page.locator('.menu-row summary').filter({ hasText: 'Database' })
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Find Object…' }).click()
  await page.locator('.database-tools-panel').waitFor()
  await page.locator('.document-tab.selected .tab-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: /Flush/ }).click()
  await page.getByRole('tab', { name: /Flush Tables/ }).waitFor()
  await page.getByText('FLUSH TABLES;', { exact: true }).waitFor()
  await page.locator('.document-tab.selected .tab-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Database Diagram' }).click()
  await page.locator('.er-panel').waitFor()
  await page.locator('.document-tab.selected .tab-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Report Designer' }).click()
  await page.locator('[data-testid="report-designer"]').waitFor()
  for (const band of ['reportHeader', 'pageHeader', 'groupHeader', 'detail', 'groupFooter', 'pageFooter', 'reportFooter']) {
    await page.locator(`[data-testid="report-band-${band}"]`).waitFor()
  }
  const reportDesigner = page.locator('[data-testid="report-designer"]')
  await reportDesigner.getByRole('textbox', { name: 'Report data source query' }).fill("SELECT DATE('2025-01-03') AS ordered_at, 10 AS total UNION ALL SELECT DATE('2025-04-02'), 7")
  await reportDesigner.getByRole('button', { name: 'Load data' }).click()
  await page.locator('[data-testid="report-designer"][data-state="ready"]').waitFor()
  await reportDesigner.locator('.rp-draggable-field').filter({ hasText: 'ordered_at' }).dragTo(reportDesigner.locator('[data-testid="report-band-reportHeader"]'))
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceDirectory, `report-designer-wysiwyg-${theme}.png`) })
  }
  await page.getByRole('button', { name: 'Close designer' }).click()
  await page.locator('.document-tab.selected .tab-close').click()
  await databaseMenu.click()
  await page.getByRole('button', { name: 'Pivot Table', exact: true }).click()
  const reportPivot = page.locator('.report-pivot-panel:visible').last()
  await reportPivot.locator('.rp-query-label button').click()
  await reportPivot.locator('.rp-query-label textarea').fill("SELECT DATE('2025-01-03') AS ordered_at, 10 AS total")
  await reportPivot.getByRole('button', { name: 'Load query fields' }).click()
  await page.locator('[data-testid="report-query-state"][data-state="ready"]').waitFor()
  await reportPivot.getByLabel('Zone for ordered_at').selectOption('rows')
  await reportPivot.getByLabel('Zone for total').selectOption('values')
  await reportPivot.getByRole('button', { name: 'Build Pivot Table' }).click()
  await reportPivot.locator('[data-testid="pivot-grid"]').getByText('Grand Total', { exact: true }).first().waitFor()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceDirectory, `pivot-date-grand-total-${theme}.png`) })
  }
  await page.locator('.document-tab.selected .tab-close').click()
  await page.evaluate(() => window.dispatchEvent(new window.CustomEvent('tuxsql:insert-ai-sql', { detail: { sql: 'SELECT 1 AS recent_file;\nSELECT 2 AS next_result;' } })))
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
  await page.locator('.document-tab.selected [role=tab]').waitFor()
  await page.locator('.document-tab.selected [role=tab]').click()
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

  // Custom Query Data Compare runs each bounded read-only query against its endpoint.
  const comparisonMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^Comparison$/ }) })
  await comparisonMenu.evaluate((element) => { element.open = true })
  await comparisonMenu.getByRole('button', { name: 'New Data Comparison…' }).click()
  const dataComparePanel = page.locator('.compare-panel').filter({ hasText: 'Data Compare' }).last()
  await dataComparePanel.waitFor({ state: 'visible' })
  await dataComparePanel.locator('.compare-endpoints fieldset').nth(0).getByLabel('Database').fill(database)
  await dataComparePanel.locator('.compare-endpoints fieldset').nth(1).getByLabel('Database').fill(targetDatabase)
  await dataComparePanel.getByLabel('Compare by Custom Queries').check()
  await dataComparePanel.getByLabel('Source query').fill('SELECT id, label, changed_at FROM custom_compare_rows')
  await dataComparePanel.getByLabel('Target query').fill('SELECT id, label, changed_at FROM custom_compare_rows')
  await dataComparePanel.getByRole('button', { name: /Next/ }).click()
  await dataComparePanel.getByLabel('Search options').fill('microseconds')
  await dataComparePanel.getByLabel('Ignore microseconds').check({ force: true })
  await dataComparePanel.getByRole('button', { name: /Next/ }).click()
  await dataComparePanel.getByLabel('Comparison key').fill('id')
  await dataComparePanel.getByRole('button', { name: 'Compare', exact: true }).click()
  try { await dataComparePanel.locator('.compare-results').waitFor({ timeout: 30_000 }) }
  catch { throw new Error(`Custom query comparison did not finish: ${await dataComparePanel.innerText()}`) }
  const customCompareSummary = await dataComparePanel.locator('.compare-results p').filter({ hasText: 'Only in Source / Different / Identical / Only in Target' }).innerText()
  if (!/3 rows · 1 \/ 1 objects selected · 1 \/ 0 \/ 1 \/ 1 Only in Source \/ Different \/ Identical \/ Only in Target/.test(customCompareSummary)) throw new Error(`Custom query comparison counts differ: ${customCompareSummary}`)
  await dataComparePanel.locator('.compare-finish .assistant-finish').waitFor()
  await mkdir(evidenceDirectory, { recursive: true })
  await dataComparePanel.locator('.compare-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-data-compare.png') })
  await dataComparePanel.locator('.compare-finish').getByRole('button', { name: 'Compare more' }).waitFor()

  // Table Designer sections remain accessible in the actual object editor.
  await smokeObject.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Open Editor', exact: true }).click()
  const designer = page.locator('.object-editor:visible')
  await designer.waitFor()
  for (const pageName of ['General', 'Columns', 'Constraints', 'Indexes', 'Options', 'Triggers', 'Partitioning', 'Data', 'SQL']) {
    const tab = designer.locator('.object-editor-nav').getByRole('button', { name: new RegExp(`^${pageName}$`, 'i') }).first()
    if (await tab.count()) { await tab.click(); await tab.waitFor() }
  }
  await designer.locator('.object-editor-nav').getByRole('button', { name: /^Data$/i }).click()
  if (!(await designer.locator('.object-editor-nav').getByRole('button', { name: /^Data$/i }).count())) throw new Error('Table Designer Data page is not available.')
  await page.locator('.document-tab.selected .tab-close').click()

  // Data Generator finishes with a result summary and a repeat action.
  await smokeObject.click({ button: 'right' })
  await contextMenu.getByRole('menuitem', { name: /Generate Data/ }).click()
  const dataGenerator = page.locator('.data-generator-panel')
  await dataGenerator.waitFor()
  await dataGenerator.getByRole('button', { name: /Select Tables|Selecionar tabelas/ }).click()
  await dataGenerator.getByLabel(`${docTable} row count`).fill('1')
  await dataGenerator.getByRole('button', { name: /^Generate$/ }).click()
  await dataGenerator.locator('.assistant-finish').waitFor({ timeout: 30_000 })
  await dataGenerator.locator('.assistant-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-data-generator.png') })
  await dataGenerator.locator('.assistant-finish').getByRole('button', { name: /^Generate$/ }).waitFor()

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
  await qb.getByRole('button', { name: 'Select All rows from left table' }).click()
  await qb.getByRole('button', { name: 'Select All rows from right table' }).click()
  await qb.getByRole('button', { name: 'Wrap to Subquery' }).click()
  await qb.getByText('SELECT wrapped as a derived table.', { exact: false }).waitFor()
  await qb.getByRole('combobox', { name: 'Insert target table' }).selectOption(childTable)
  await qb.getByRole('button', { name: 'Wrap to Insert' }).click()
  await qb.getByText('INSERT SELECT created.', { exact: false }).waitFor()
  await qb.getByRole('button', { name: 'Create Subquery' }).click()
  await qb.getByRole('tab', { name: 'Root Query' }).waitFor()
  await qb.getByRole('tab', { name: 'Root Query' }).click()
  await qb.getByRole('tab', { name: 'SubQuery' }).click()
  await qb.getByRole('tab', { name: 'Root Query' }).click()
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
  catch {
    const [schemaRows] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [database])
    throw new Error(`ER Explorer drop did not add ${dragTable} (test database exists: ${schemaRows.length > 0}): ${await erDiagram.innerText()}`)
  }
  await erDiagram.getByRole('button', { name: 'Toggle diagram overview' }).click()
  await erDiagram.getByTestId('er-diagram-overview').waitFor()
  await erDiagram.getByRole('button', { name: 'Virtual Relation Manager' }).click()
  await erDiagram.getByRole('dialog', { name: 'Virtual Relation Manager' }).waitFor()
  await erDiagram.getByRole('dialog').getByRole('button', { name: /Close|Fechar/ }).click()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceDirectory, `er-diagram-explorer-drop-${theme}.png`) })
  }


  // Export and Import Finish pages exercise OS-opening controls through a main-process stub.
  const exportPath = join(dataRoot, 'finish-export.csv')
  const exportErrorLog = join(dataRoot, 'finish-export.log')
  const importSource = join(dataRoot, 'finish-import.csv')
  const importScript = join(dataRoot, 'finish-import.sql')
  await writeFile(importSource, 'id,label\n7,Finish fixture\n', 'utf8')
  await app.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async (...args) => {
      const options = args.at(-1)
      return { canceled: false, filePath: /log/i.test(options?.title ?? '') ? paths.log : /import/i.test(options?.title ?? '') ? paths.importScript : paths.export }
    }
  }, { export: exportPath, log: exportErrorLog, importScript })
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
  await exportPanel.locator('.io-footer .button-primary').click()
  await exportPanel.locator('.assistant-finish').waitFor()
  await mkdir(evidenceDirectory, { recursive: true })
  await exportPanel.locator('.assistant-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-export.png') })
  if (!(await exportPanel.getByRole('button', { name: 'Export more', exact: true }).count())) throw new Error('Export Finish must provide Export more.')
  for (const [label, kind] of [['Open result file', 'file'], ['Open result folder', 'folder']]) {
    await exportPanel.getByRole('button', { name: label, exact: true }).click()
    const calls = await app.evaluate(({ ipcMain }) => ipcMain.__assistantFinishOpenCalls)
    if (!calls.some((call) => call.path === exportPath && call.kind === kind)) throw new Error(`${label} did not call the system-open stub for the result ${kind}.`)
  }
  await exportPanel.getByRole('button', { name: 'Export more', exact: true }).click()
  await exportPanel.locator('.io-toolbar select').first().selectOption('export')
  await exportPanel.locator('.io-footer .button-primary').click()
  const secondQuery = exportPanel.locator('textarea').first()
  for (const selectedSource of await exportPanel.locator('.io-source-list input[type="checkbox"]:checked').all()) await selectedSource.uncheck()
  if (await secondQuery.count()) await secondQuery.fill('NOT A SELECT')
  for (let step = 0; step < 5; step += 1) {
    const next = exportPanel.getByRole('button', { name: /Next|Avançar/ })
    if (!(await next.count())) break
    if (await next.isDisabled()) break
    await next.click()
  }
  const writeErrorLog = exportPanel.getByRole('checkbox', { name: /Write an error log/ })
  if (await writeErrorLog.count() !== 1) throw new Error(`The export error step did not expose Write an error log: ${await exportPanel.innerText()}`)
  await writeErrorLog.check()
  await exportPanel.locator('.io-footer .button-primary').click()
  await exportPanel.locator('.io-footer .button-primary').click()
  const runExport = exportPanel.locator('.io-footer .button-primary')
  if (await runExport.count()) await runExport.click()
  const showLog = exportPanel.getByRole('button', { name: 'Show log file', exact: true })
  if (!(await showLog.count())) throw new Error(`Finish did not expose Show log file: ${await exportPanel.innerText()} (saved log: ${await readFile(exportErrorLog, 'utf8').catch(() => 'missing')})`)
  await exportPanel.locator('.assistant-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-log.png') })
  await showLog.click()
  const logCalls = await app.evaluate(({ ipcMain }) => ipcMain.__assistantFinishOpenCalls)
  if (!logCalls.some((call) => call.path === exportErrorLog && call.kind === 'file')) throw new Error('Show log file did not call the system-open stub.')
  await exportPanel.getByRole('button', { name: 'Export more', exact: true }).click()
  await exportPanel.locator('.io-toolbar select').first().selectOption('import')
  await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, importSource)
  await exportPanel.locator('.io-page > button').first().click()
  await exportPanel.locator('.io-footer .button-primary').click()
  for (let step = 0; step < 5; step += 1) {
    const next = exportPanel.getByRole('button', { name: /Next|Avançar/ })
    if (!(await next.count())) break
    await next.click()
  }
  await exportPanel.locator('.io-page input[type="radio"]').nth(1).check()
  await exportPanel.locator('.io-footer .button-primary').click()
  await exportPanel.locator('.io-footer .button-primary').click()
  const importRun = exportPanel.locator('.io-footer .button-primary')
  if (await importRun.count()) await importRun.click()
  await exportPanel.locator('.assistant-finish').waitFor({ timeout: 20_000 })
  await exportPanel.locator('.assistant-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-import.png') })
  if (!(await exportPanel.getByRole('button', { name: 'Import more', exact: true }).count())) throw new Error('Import Finish must provide Import more.')
  await exportPanel.getByRole('button', { name: 'Import more', exact: true }).waitFor()
  const exportClose = page.locator('.panel-dialog-backdrop:has(.io-wizard) .panel-dialog-close')
  if (await exportClose.count()) await exportClose.last().click()

  // Restore is a short three-stage preview flow. The selected fixture is disposable and is never run.
  const restoreFixture = join(dataRoot, 'restore-preview.sql')
  await writeFile(restoreFixture, '-- preview only\nSELECT 1;\n', 'utf8')
  await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, restoreFixture)
  await page.locator('.menu-row summary').filter({ hasText: /^Database$/ }).click()
  await page.getByRole('button', { name: /Backup \/ Restore/ }).click()
  const toolsPanel = page.locator('.database-tools-panel')
  await toolsPanel.waitFor()
  await toolsPanel.locator('.database-tools-tabs').getByRole('button', { name: 'Backup/Restore', exact: true }).click()
  const restoreWizard = page.locator('.backup-wizard')
  await restoreWizard.waitFor()
  await restoreWizard.getByRole('button', { name: 'Restore backup', exact: true }).click()
  if (await restoreWizard.locator('.backup-wizard-steps button').count() !== 3) throw new Error('Restore wizard should expose three steps.')
  await restoreWizard.getByRole('button', { name: /Choose backup file/ }).click()
  const restoreCommandPath = join(dataRoot, 'restore-command.sh')
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }) }, restoreCommandPath)
  await restoreWizard.getByRole('button', { name: /Save Command Line/ }).click()
  const restoreCommand = await readFile(restoreCommandPath, 'utf8')
  if (!restoreCommand.includes('mysql --host=') || !restoreCommand.includes('--password ') || restoreCommand.includes('integration-only')) throw new Error('Restore command should use the mysql client and prompt for credentials without embedding a password.')
  await restoreWizard.getByRole('button', { name: 'Next' }).click()
  if (await restoreWizard.getByRole('button', { name: 'Start' }).isEnabled()) throw new Error('Restore must require destination confirmation before execution.')
  const backupDirectory = join(dataRoot, 'finish-backups')
  await mkdir(backupDirectory, { recursive: true })
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }) }, backupDirectory)
  await restoreWizard.getByRole('button', { name: 'Create backup', exact: true }).click()
  await restoreWizard.getByRole('button', { name: /Choose folder/ }).click()
  for (let step = 0; step < 3; step += 1) await restoreWizard.locator('.backup-wizard-footer .button-primary').click()
  await restoreWizard.getByRole('button', { name: 'Next', exact: true }).click()
  await restoreWizard.locator('.backup-wizard-footer').getByRole('button', { name: 'Run backup now', exact: true }).click()
  await restoreWizard.locator('.assistant-finish').waitFor()
  await restoreWizard.locator('.assistant-finish').screenshot({ path: join(evidenceDirectory, 'assistant-finish-backup.png') })
  if (!(await restoreWizard.locator('.assistant-finish-output code').count())) throw new Error(`Backup did not produce an output file: ${await restoreWizard.innerText()}`)
  const backupPath = await restoreWizard.locator('.assistant-finish-output code').innerText()
  for (const [label, kind] of [['Open result file', 'file'], ['Open result folder', 'folder']]) {
    await restoreWizard.getByRole('button', { name: label, exact: true }).click()
    const calls = await app.evaluate(({ ipcMain }) => ipcMain.__assistantFinishOpenCalls)
    if (!calls.some((call) => call.path === backupPath && call.kind === kind)) throw new Error(`Backup ${label} did not call the system-open stub.`)
  }
  await page.locator('.document-tab.selected .tab-close').click()

  // Link wizard UI proof uses a temporary .git-shaped fixture and in-page API stubs;
  // no Git executable or repository mutation is invoked by this test.
  const sourceRepo = join(dataRoot, 'source-control-fixture')
  await mkdir(join(sourceRepo, '.git'), { recursive: true })
  await app.evaluate(({ ipcMain }, repo) => {
    const sourceModels = []
    ipcMain.__sourceLinkModels = sourceModels
    const handlers = {
      'source-control:choose-repository': () => repo,
      'source-control:status': () => ({ branch: 'main', changes: [] }),
      'source-control:branches': () => ['main'],
      'source-control:log': () => [],
      'source-control:has-remote': () => false,
      'source-control:project-files': () => [],
      'source-control:link-database': (_event, input) => { sourceModels.push(input.model); return { root: input.root, name: input.name, files: [], linkedDatabase: { connectionId: input.connectionId, connectionName: input.connectionName, database: input.database, model: input.model } } }
    }
    for (const [channel, handler] of Object.entries(handlers)) { ipcMain.removeHandler(channel); ipcMain.handle(channel, handler) }
  }, sourceRepo)
  await page.locator('.project-explorer-tab').click()
  await page.locator('.project-explorer-dock').waitFor()
  await page.locator('.project-explorer-dock .source-control-panel').waitFor()
  await page.locator('.source-control-panel').waitFor()
  for (const model of ['dedicated', 'shared']) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('tuxsql:source-control:link')))
    const linkWizard = page.locator('.sc-wizard')
    await linkWizard.waitFor()
    const modelInputs = linkWizard.locator('fieldset input[type="radio"]')
    await modelInputs.nth(model === 'dedicated' ? 0 : 1).check()
    await linkWizard.locator('.sc-project-actions button').first().click()
    await linkWizard.getByRole('button', { name: /Link/ }).click()
    await linkWizard.getByRole('button', { name: /Finish/ }).click()
  }
  const linkedModels = await app.evaluate(({ ipcMain }) => ipcMain.__sourceLinkModels ?? [])
  if (JSON.stringify(linkedModels) !== JSON.stringify(['dedicated', 'shared'])) throw new Error(`Source Control wizard did not persist both models: ${JSON.stringify(linkedModels)}`)
  const projectExplorerDock = page.locator('.project-explorer-dock')
  await projectExplorerDock.locator('header button').last().click()
  await projectExplorerDock.waitFor({ state: 'detached' })

  // Security user list and debugger deployment / stepping run against this disposable schema.
  await page.locator('.menu-row summary').filter({ hasText: /^Database$/ }).click()
  await page.getByRole('button', { name: /Security Manager/ }).click()
  const security = page.locator('.security-panel')
  await security.waitFor()
  const firstSecurityUser = security.locator('.security-users button').first()
  await firstSecurityUser.waitFor({ timeout: 15_000 })
  await firstSecurityUser.click()
  for (const tab of ['General', 'Roles', 'Users', 'Global Privileges', 'Object Privileges']) {
    await security.getByRole('button', { name: tab, exact: true }).click()
    if (tab === 'Global Privileges') {
      await security.getByRole('columnheader', { name: 'Granted', exact: true }).waitFor()
      await security.getByRole('columnheader', { name: 'With Grant Option', exact: true }).waitFor()
    }
  }
  await page.locator('.panel-dialog-backdrop:has(.security-panel) .panel-dialog-close').click()

  const debugMenu = page.locator('.menu-row summary').filter({ hasText: /^Debug$/ })
  await debugMenu.click()
  await page.getByRole('button', { name: /Start Debugging/ }).click()
  const debuggerPanel = page.locator('.routine-debugger')
  await debuggerPanel.waitFor()
  const debugConnection = debuggerPanel.locator('.rd-target select').nth(0)
  await debugConnection.selectOption({ label: 'Smoke MySQL 33067' })
  await debuggerPanel.locator('.rd-target select').nth(1).selectOption(database)
  await debuggerPanel.locator('.rd-target select').nth(3).selectOption(debugRoutine)
  const deployButton = debuggerPanel.getByRole('button', { name: /Deploy Debug Engine|Deploy debugger support/i })
  if (await deployButton.count()) {
    await deployButton.click()
    await debuggerPanel.getByText(/Engine installed|Engine v/).waitFor({ timeout: 30_000 })
  } else await debuggerPanel.getByText(/Engine installed|Engine v/).waitFor({ timeout: 15_000 })
  const [sqlModeRows] = await admin.query("SHOW GLOBAL VARIABLES LIKE 'sql_mode'")
  if (!String(sqlModeRows[0]?.Value).includes('STRICT')) throw new Error(`Debugger smoke requires a strict MySQL session default, received: ${sqlModeRows[0]?.Value}`)
  await debuggerPanel.locator('.rd-target').getByRole('button', { name: /Start Debugging/ }).click()
  try { await debuggerPanel.locator('.rd-toolbar span').filter({ hasText: /^paused/i }).waitFor({ timeout: 30_000 }) }
  catch { throw new Error(`Debugger did not pause after Start: ${await debuggerPanel.innerText()}`) }
  const stepInto = debuggerPanel.locator('.rd-toolbar').getByRole('button', { name: /Step Into/ })
  const lineBeforeStep = await debuggerPanel.locator('.rd-toolbar span').innerText()
  await stepInto.click()
  await page.waitForFunction((before) => {
    const value = document.querySelector('.routine-debugger .rd-toolbar span')?.textContent ?? ''
    return /running|paused|finished|error/i.test(value) && value !== before
  }, lineBeforeStep, { timeout: 15_000 })
  const stop = debuggerPanel.locator('.rd-toolbar').getByRole('button', { name: /Stop/ })
  if (await stop.isEnabled()) await stop.click()

  // Skin choices and toolbar customization mutate only this smoke profile.
  const toolsDetails = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^Tools$/ }) })
  const toolsMenu = toolsDetails.locator(':scope > summary')
  if (!(await toolsDetails.evaluate((element) => element.open))) await toolsMenu.click()
  const toolsPopup = toolsDetails.locator(':scope > .menu-popup')
  await toolsPopup.waitFor({ state: 'visible' })
  const blueSkinAction = toolsPopup.getByRole('button', { name: /^(Skin: Blue|Visual: Azul)$/ })
  if (!(await blueSkinAction.count())) throw new Error(`Tools menu did not expose the blue skin action: ${await toolsPopup.innerText()}`)
  await blueSkinAction.click()
  if (await page.locator('html').getAttribute('data-skin') !== 'blue') throw new Error('Blue skin was not applied.')
  if (!(await toolsDetails.evaluate((element) => element.open))) await toolsMenu.click()
  await toolsPopup.getByRole('button', { name: /^(Customize…|Personalizar…)$/ }).click()
  const customize = page.locator('.toolbar-customize')
  await customize.waitFor()
  await customize.getByRole('checkbox', { name: 'Results' }).uncheck()
  await customize.getByRole('button', { name: 'Done' }).click()
  if (await page.locator('.app-toolbar').getByRole('button', { name: 'Results' }).count()) throw new Error('Toolbar customization did not hide Results.')

  console.log('Smoke e2e passed: comparison/editor/security/debugger, security privilege tabs, startup paint mark, skin selection, toolbar customization, and disposable-schema flows.')
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
    if (!debugSchemaExisted) await dropDisposableDatabase('tuxsql_linux_debug')
  } finally {
    await admin.end()
    await rm(dataRoot, { recursive: true, force: true })
  }
}
