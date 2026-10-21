/* global process, console, setTimeout, clearTimeout, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestUser } from './mysql-test-prefix.mjs'

const electronPath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(electronPath)) throw new Error(`Packaged Electron executable not found at ${electronPath}. Build the app first.`)
const suffix = `${process.pid}_${randomUUID().slice(0, 8)}`
const database = `tuxsql_modules_${suffix}`
const targetDatabase = `${database}_target`
const user = mysqlTestUser('module_screenshots')
const password = `Ui-${randomUUID().slice(0, 14)}-9!`
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-modules-ui-'))
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui', '08-13-modules')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only', multipleStatements: false })
let app
let databaseCreated = false
let targetDatabaseCreated = false
let userCreated = false
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  databaseCreated = true
  await admin.query(`CREATE DATABASE \`${targetDatabase}\``)
  targetDatabaseCreated = true
  await admin.query(`CREATE USER '${user}'@'%' IDENTIFIED BY ?`, [password])
  userCreated = true
  await admin.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'%'`)
  await admin.query(`GRANT ALL PRIVILEGES ON \`${targetDatabase}\`.* TO '${user}'@'%'`)
  await admin.query(`GRANT SELECT ON mysql.* TO '${user}'@'%'`)
  await admin.query(`GRANT CREATE USER ON *.* TO '${user}'@'%'`)
  await admin.query(`CREATE TABLE \`${database}\`.customers (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE, country CHAR(2) NOT NULL DEFAULT 'BR', status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active') ENGINE=InnoDB`)
  await admin.query(`CREATE TABLE \`${database}\`.orders (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, total DECIMAL(10,2) NOT NULL, CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES \`${database}\`.customers(id)) ENGINE=InnoDB`)
  await admin.query(`INSERT INTO \`${database}\`.customers(name,email,country,status) VALUES ('Ana Silva','ana@example.test','BR','active'),('Ben Miller','ben@example.test','US','pending')`)
  await admin.query(`INSERT INTO \`${database}\`.orders(customer_id,total) VALUES (1,25.50),(2,40.00)`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.customers (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE, country CHAR(2) NOT NULL DEFAULT 'BR', status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active') ENGINE=InnoDB`)
  await admin.query(`INSERT INTO \`${targetDatabase}\`.customers VALUES (1,'Ana changed','ana@example.test','BR','active'),(2,'Ben Miller','ben@example.test','US','pending')`)
  await admin.query(`CREATE PROCEDURE \`${database}\`.debug_sample(IN p_id INT) BEGIN SELECT p_id; END`)
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: electronPath, args: ['--disable-gpu'], cwd: process.cwd(), timeout: 90_000, env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.on('console', (message) => console.log(`[renderer:${message.type()}] ${message.text()}`))
  page.on('pageerror', (error) => console.error(`[renderer:error] ${error.stack ?? error.message}`))
  await page.locator('.workbench').waitFor()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Temporary module evidence')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill(user)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.locator('.connection-status.success').waitFor({ timeout: 30_000 })
  const loadDatabases = page.getByRole('button', { name: /Load Databases|Refresh Databases|Databases/ })
  if (await loadDatabases.count()) await loadDatabases.last().click().catch(() => undefined)
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.selectOption(database)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  if (!(await page.locator('.explorer-dock').count())) {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: 'Database Explorer' }).click()
  }
  await page.locator('.node-name').filter({ hasText: 'Temporary module evidence' }).click({ timeout: 5_000 })
  await page.locator('.database-name').filter({ hasText: new RegExp(`^.*${database}$`) }).dblclick({ timeout: 5_000 })
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  await page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).waitFor()

  const chooseTheme = async (theme) => {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme.toLowerCase())
  }
  const menuAction = async (menu, label) => {
    await page.locator('summary').filter({ hasText: new RegExp(`^${menu}$`) }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: label }).last().click()
  }
  const closePanelDialog = async () => {
    const backdrops = page.locator('.panel-dialog-backdrop')
    for (let attempt = 0; attempt < 10 && await backdrops.count(); attempt += 1) {
      const close = backdrops.last().locator('.panel-dialog-close')
      if (await close.count()) await close.click({ force: true }).catch(() => undefined)
      else await page.keyboard.press('Escape').catch(() => undefined)
      await page.waitForTimeout(100)
    }
    await page.locator('.document-tab.selected .tab-close').click({ force: true }).catch(() => undefined)
    if (await backdrops.count()) await page.keyboard.press('Escape').catch(() => undefined)
    if (await backdrops.count()) await page.evaluate(() => {
      for (const backdrop of document.querySelectorAll('.panel-dialog-backdrop')) {
        const close = backdrop.querySelector('.panel-dialog-close')
        if (close) close.click()
        if (backdrop.isConnected) backdrop.remove()
      }
    })
    await backdrops.first().waitFor({ state: 'detached', timeout: 2000 }).catch(() => undefined)
  }
  const captureMenuPanel = async (menu, label, selector, file) => {
    for (const theme of ['Light', 'Dark']) {
      await chooseTheme(theme)
      await menuAction(menu, label)
      await page.locator(selector).waitFor({ timeout: 20_000 })
      await page.screenshot({ path: join(evidenceDirectory, `${file}-${theme.toLowerCase()}.png`) })
      await closePanelDialog()
    }
  }
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).click({ button: 'right', force: true })
    await page.locator('.explorer-context-menu').waitFor()
    await page.screenshot({ path: join(evidenceDirectory, `explorer-generate-send-${theme.toLowerCase()}.png`) })
    await page.keyboard.press('Escape')
    await menuAction('Database', 'Database documentation')
    await page.locator('.documenter-panel').waitFor()
    const dbInput = page.locator('.documenter-panel fieldset').first().locator('input').first()
    await dbInput.fill(database)
    await page.locator('.documenter-panel fieldset > details > summary').first().click()
    await page.locator('.documenter-panel').getByText('customers', { exact: true }).waitFor()
    await page.locator('.documenter-panel').getByText('customers', { exact: true }).click()
    await page.screenshot({ path: join(evidenceDirectory, `documenter-granular-${theme.toLowerCase()}.png`) })
    await closePanelDialog()
    await menuAction('Comparison', 'New Data Comparison')
    await page.locator('.compare-panel').waitFor()
    const endpoints = page.locator('.compare-panel .compare-endpoints fieldset')
    await endpoints.nth(0).locator('input').fill(database)
    await endpoints.nth(1).locator('input').fill(targetDatabase)
    await page.getByRole('button', { name: /3\. Mapping/ }).click()
    const mappingInputs = page.locator('.compare-panel .compare-mapping-row label input')
    await mappingInputs.nth(0).fill('customers')
    await mappingInputs.nth(1).fill('customers')
    await page.getByRole('button', { name: /^Compare$/ }).click({ force: true })
    await page.locator('.compare-results').waitFor({ timeout: 30_000 })
    await page.locator('.compare-results').screenshot({ path: join(evidenceDirectory, `data-compare-grid-${theme.toLowerCase()}.png`) })
    await closePanelDialog()
    await menuAction('Comparison', 'New Schema Comparison')
    const schemaCompare = page.locator('.compare-panel')
    await schemaCompare.waitFor()
    const sourceType = schemaCompare.locator('.compare-form select').first()
    await sourceType.selectOption('Scripts Folder')
    await page.screenshot({ path: join(evidenceDirectory, `schema-compare-scripts-folder-${theme.toLowerCase()}.png`) })
    await sourceType.selectOption('Snapshot')
    await page.screenshot({ path: join(evidenceDirectory, `schema-compare-snapshot-${theme.toLowerCase()}.png`) })
    await closePanelDialog()
  }

  // Security, Sessions, and Server Variables are captured in their own modal pass.
  await chooseTheme('Light')
  await page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).click({ button: 'right', force: true })
  await page.locator('.explorer-context-menu [role="menuitem"]').filter({ hasText: 'Generate Data' }).click({ force: true })
  await page.locator('.data-generator-panel').waitFor()
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await page.screenshot({ path: join(evidenceDirectory, `data-generator-${theme.toLowerCase()}.png`) })
  }
  await closePanelDialog()
  await captureMenuPanel('View', 'Query Builder', '.qb-panel', 'query-builder')
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await menuAction('Database', 'Database Diagram')
    const diagram = page.locator('.er-panel')
    await diagram.waitFor()
    const selectors = diagram.locator('.er-toolbar select')
    await selectors.nth(0).selectOption({ label: 'Temporary module evidence' })
    await selectors.nth(1).selectOption(database)
    await diagram.getByRole('button', { name: 'Load Diagram' }).click()
    await diagram.locator('.er-table').filter({ hasText: 'orders' }).waitFor({ timeout: 30_000 })
    await page.screenshot({ path: join(evidenceDirectory, `er-diagram-cardinality-${theme.toLowerCase()}.png`) })
    await closePanelDialog()
  }
  await captureMenuPanel('View', 'Profiler', '.profiler-panel', 'profiler')
  await captureMenuPanel('Debug', 'Start Debugging', '.routine-debugger', 'routine-debugger')
  console.log(`Module screenshots saved under ${evidenceDirectory}; database ${database} and user ${user} are temporary.`)
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
  if (userCreated) await admin.query(`DROP USER IF EXISTS '${user}'@'%'`).catch(() => undefined)
  if (targetDatabaseCreated) await admin.query(`DROP DATABASE IF EXISTS \`${targetDatabase}\``).catch(() => undefined)
  if (databaseCreated) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
