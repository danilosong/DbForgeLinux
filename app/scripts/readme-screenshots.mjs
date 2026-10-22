/* global process, console, setTimeout, clearTimeout, document, DOMPoint, HTMLElement, getComputedStyle, localStorage */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

// Electron's renderer follows the system locale. Keep its text and screenshots deterministic.
process.env.LANG = 'en_US.UTF-8'
process.env.LC_ALL = 'en_US.UTF-8'

const names = ['ui-corrections', 'sql-editor', 'table-data-grid-edit', 'er-diagram', 'schema-compare', 'routine-debugger', 'table-designer', 'ai-assistant', 'connection-properties']
const expectedFiles = names.flatMap((name) => [`${name}-light.png`, `${name}-dark.png`]).sort()
const appBinary = resolve(process.env.TUXSQL_APP_BIN ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql'))
if (!existsSync(appBinary)) throw new Error(`TuxSQL executable not found: ${appBinary}`)

const evidenceDirectory = process.env.TUXSQL_SCREENSHOT_OUTPUT ?? join(process.cwd(), '..', 'document', 'evidence', 'ui')
const runId = `${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 10)}`
const database = `tuxsql_readme_${runId}`
const targetDatabase = `${database}_target`
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-readme-screenshots-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only', multipleStatements: true })
let app
let page
let sourceCreated = false
let targetCreated = false

async function stopApp() {
  if (!app) return
  const child = app.process()
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  let timer
  try {
    await Promise.race([exited, new Promise((resolvePromise) => { timer = setTimeout(resolvePromise, 20_000) })])
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
  } finally { if (timer) clearTimeout(timer) }
}

try {
  await admin.query('DROP DATABASE IF EXISTS `tuxsql_linux_debug`')
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`)
  sourceCreated = true
  await admin.query(`CREATE DATABASE \`${targetDatabase}\` CHARACTER SET utf8mb4`)
  targetCreated = true
  await admin.query(`CREATE TABLE \`${database}\`.customers (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE, status ENUM('active','pending','inactive') NOT NULL DEFAULT 'active') ENGINE=InnoDB`)
  await admin.query(`CREATE TABLE \`${database}\`.orders (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, total DECIMAL(10,2) NOT NULL, created_at DATE NOT NULL, CONSTRAINT fk_readme_customer FOREIGN KEY (customer_id) REFERENCES \`${database}\`.customers(id)) ENGINE=InnoDB`)
  await admin.query(`INSERT INTO \`${database}\`.customers(name,email,status) VALUES ('Ana Silva','ana@example.test','active'),('Ben Miller','ben@example.test','pending'),('Carla Costa','carla@example.test','active')`)
  await admin.query(`INSERT INTO \`${database}\`.orders(customer_id,total,created_at) VALUES (1,125.50,'2026-04-18'),(1,42.00,'2026-05-02'),(2,310.00,'2026-05-12'),(3,78.90,'2026-05-21')`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.customers (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE, status ENUM('active','pending','inactive') NOT NULL DEFAULT 'active', region CHAR(2) NULL) ENGINE=InnoDB`)
  await admin.query(`CREATE TABLE \`${targetDatabase}\`.orders (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, total DECIMAL(10,2) NOT NULL, created_at DATE NOT NULL, CONSTRAINT fk_readme_customer FOREIGN KEY (customer_id) REFERENCES \`${targetDatabase}\`.customers(id)) ENGINE=InnoDB`)
  await admin.query(`INSERT INTO \`${targetDatabase}\`.customers(id,name,email,status) VALUES (1,'Ana Silva','ana@example.test','active'),(2,'Ben Miller','ben@example.test','pending')`)
  await admin.query(`CREATE PROCEDURE \`${database}\`.debug_customer(IN p_customer_id INT)
BEGIN
  DECLARE customer_name VARCHAR(80);
  SELECT name INTO customer_name FROM customers WHERE id = p_customer_id;
  SELECT customer_name AS customer_name;
END`)
  await mkdir(evidenceDirectory, { recursive: true })
  const isolatedConfig = join(dataRoot, 'config', 'tuxsql')
  await mkdir(isolatedConfig, { recursive: true })
  await writeFile(join(isolatedConfig, 'settings.json'), JSON.stringify({ schemaVersion: 2, language: { locale: 'en' }, grid: { readOnlyByDefault: false } }), { mode: 0o600 })

  app = await electron.launch({
    executablePath: appBinary,
    args: ['--disable-gpu'],
    cwd: process.cwd(),
    timeout: 90_000,
    env: {
      ...process.env,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  page = await app.firstWindow()
  page.setDefaultTimeout(15_000)
  page.on('dialog', (dialog) => dialog.accept())
  const setTheme = async (theme) => {
    const dialogOpen = await page.locator('.connection-dialog').isVisible().catch(() => false)
    const state = await page.evaluate(() => ({ dataset: document.documentElement.dataset.theme, mode: localStorage.getItem('tuxsql.theme') }))
    if (dialogOpen) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
      return
    }
    if (state.mode !== theme) {
      const viewMenu = page.locator('.menu-row > details').filter({ has: page.locator('summary').filter({ hasText: /^View$/ }) })
      await viewMenu.locator('summary').click()
      await viewMenu.getByRole('button', { name: `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`, exact: true }).click()
    } else if (state.dataset !== theme) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    }
  }
  const assertThemeLuminance = async (theme) => {
    const actual = await page.evaluate(() => {
      const root = document.documentElement
      const css = getComputedStyle(root)
      const background = css.getPropertyValue('--color-canvas-app').trim() || css.getPropertyValue('--bg-app').trim()
      const channels = background.startsWith('#')
        ? (background.length === 4 ? background.slice(1).split('').map((channel) => Number.parseInt(channel + channel, 16)) : background.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16)))
        : background.match(/[\d.]+/g)?.slice(0, 3).map(Number)
      if (!channels || channels.length !== 3) throw new Error(`Cannot resolve theme canvas color: ${background}`)
      const linear = channels.map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return { theme: root.dataset.theme, background, accent: css.getPropertyValue('--accent').trim(), luminance: 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] }
    })
    const correctTheme = actual.theme === theme && (theme === 'light' ? actual.luminance > 0.45 : actual.luminance < 0.15)
    if (!correctTheme) throw new Error(`Expected ${theme} theme luminance; got data-theme=${actual.theme}, color=${actual.background}, luminance=${actual.luminance.toFixed(3)}`)
    const expectedAccent = theme === 'light' ? '#0e7490' : '#38bdf8'
    if (actual.accent !== expectedAccent) throw new Error(`Expected ${theme} accent ${expectedAccent}; got ${actual.accent}`)
    return actual.luminance
  }
  await page.locator('.app-shell .brand').filter({ hasText: /^TuxSQL$/ }).waitFor()
  const localFonts = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 13px Inter', 'TuxSQL Ação'),
      document.fonts.load('500 13px Inter', 'Interface'),
      document.fonts.load('600 13px Inter', 'TuxSQL'),
      document.fonts.load('400 13px "JetBrains Mono"', 'SELECT 42'),
      document.fonts.load('500 13px "JetBrains Mono"', '123.45'),
      document.fonts.load('600 13px "JetBrains Mono"', 'CREATE TABLE')
    ])
    return {
      inter: document.fonts.check('400 13px Inter', 'TuxSQL Ação'),
      mono: document.fonts.check('400 13px "JetBrains Mono"', 'SELECT 42')
    }
  })
  if (!localFonts.inter || !localFonts.mono) throw new Error(`Packaged fonts did not load locally: ${JSON.stringify(localFonts)}`)
  const later = page.getByRole('button', { name: /^(Later|Dismiss)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const welcomeClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await welcomeClose.count()) await welcomeClose.last().click().catch(() => undefined)

  // Create a root profile only in this run's temporary XDG profile; no password is written into the repository.
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('README demo · local MySQL')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('root')
  await page.getByLabel('Password', { exact: true }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  const databaseInput = page.getByRole('textbox', { name: 'Database' })
  if (await databaseInput.count()) await databaseInput.fill(database)
  const testButton = page.getByRole('button', { name: 'Test Connection' })
  if (await testButton.count()) {
    await testButton.click()
    await page.locator('.connection-status.success').waitFor()
  }
  const dbSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  if (await dbSelect.count()) await dbSelect.selectOption(database).catch(() => undefined)
  for (const theme of ['light', 'dark']) {
    await setTheme(theme)
    await assertThemeLuminance(theme)
    await page.locator('.connection-dialog').waitFor({ state: 'visible' })
    await page.screenshot({ path: join(evidenceDirectory, `connection-properties-${theme}.png`) })
  }
  await setTheme('light')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  await page.locator('.workbench').waitFor()

  const summaries = page.locator('.menu-row > details > summary')
  const openMenu = async (menuName, actionName) => {
    const summary = summaries.filter({ hasText: menuName })
    await summary.click()
    await summary.locator('xpath=..').getByRole('button', { name: actionName }).click()
  }
  const closePanel = async () => {
    for (let i = 0; i < 5; i += 1) {
      const backdrop = page.locator('.panel-dialog-backdrop')
      if (!(await backdrop.count())) break
      const close = backdrop.last().locator('.panel-dialog-close')
      if (await close.count()) await close.click({ force: true }).catch(() => undefined)
      else await page.keyboard.press('Escape')
      await page.waitForTimeout(120)
    }
  }
  const capturePair = async (name, selector, setup) => {
    for (const theme of ['light', 'dark']) {
      await setTheme(theme)
      if (setup) await setup(theme)
      await assertThemeLuminance(theme)
      if (name === 'routine-debugger') await page.waitForFunction(() => {
        const toolbar = document.querySelector('.rd-toolbar')?.textContent ?? ''
        const variables = document.querySelector('.rd-side')?.textContent ?? ''
        const watches = document.querySelector('.rd-bottom')?.textContent ?? ''
        return toolbar.includes('paused') && variables.includes('customer_name') && variables.includes('Ana Silva') && watches.includes('customer_name') && watches.includes('Ana Silva')
      }, null, { timeout: 30_000 })
      const panel = page.locator(selector).last()
      await panel.waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator('.brand').filter({ hasText: /^TuxSQL$/ }).waitFor({ state: 'visible' })
      const visibleText = await page.locator('body').innerText()
      if (/dbforge/i.test(visibleText)) throw new Error(`Unexpected dbForge text visible while capturing ${name}`)
      await page.screenshot({ path: join(evidenceDirectory, `${name}-${theme}.png`) })
    }
    await closePanel()
  }

  // Shell and Query Builder: show a connected workspace with a customer/order join.
  await openMenu(/^View$/, /Query Builder/)
  await page.locator('.qb-panel').waitFor({ timeout: 30_000 })
  await page.locator('.qb-panel').getByRole('button').filter({ has: page.locator('svg') }).first().waitFor().catch(() => undefined)
  const qb = page.locator('.qb-panel')
  const qbSelects = qb.locator('select')
  if (await qbSelects.count()) await qbSelects.first().selectOption({ label: database }).catch(() => undefined)
  const addTable = qb.getByRole('button', { name: /Add Table/ }).first()
  await addTable.click()
  const addTables = qb.locator('.qb-add-table .qb-table-list button')
  await addTables.filter({ hasText: 'customers' }).click()
  await addTable.click()
  await qb.locator('.qb-add-table .qb-table-list button').filter({ hasText: 'orders' }).click()
  await qb.locator('.qb-table-card').filter({ hasText: 'customers' }).waitFor()
  await qb.locator('.qb-table-card').filter({ hasText: 'orders' }).waitFor()
  await qb.getByRole('button', { name: 'Joins', exact: true }).click()
  await qb.getByLabel('Join left table').selectOption({ label: 'orders' })
  await qb.getByLabel('Join left column').selectOption('customer_id')
  await qb.getByLabel('Join right table').selectOption({ label: 'customers' })
  await qb.getByLabel('Join right column').selectOption('id')
  await qb.getByRole('button', { name: 'Add Join Condition', exact: true }).click()
  const joinLink = qb.locator('.qb-join-link')
  await joinLink.waitFor()
  if (!(await joinLink.getAttribute('aria-label'))?.includes('orders.customer_id to customers.id')) throw new Error('Query Builder fixture did not create the expected customer/order relationship')
  const joinLayout = await joinLink.evaluate((element) => {
    const path = element.querySelector('path')
    const svg = path?.ownerSVGElement
    const transform = svg?.getScreenCTM()
    if (!path || !svg || !transform) throw new Error('Query Builder join SVG is not measurable')
    const start = new DOMPoint(path.getPointAtLength(0).x, path.getPointAtLength(0).y).matrixTransform(transform)
    const finish = new DOMPoint(path.getPointAtLength(path.getTotalLength()).x, path.getPointAtLength(path.getTotalLength()).y).matrixTransform(transform)
    const canvas = element.closest('.qb-canvas')
    const sourceCard = canvas?.querySelector('.qb-table-card[aria-label="Table orders"]')
    const targetCard = canvas?.querySelector('.qb-table-card[aria-label="Table customers"]')
    if (!(sourceCard instanceof HTMLElement) || !(targetCard instanceof HTMLElement)) throw new Error('Query Builder join table cards are missing')
    return { path: path.getAttribute('d'), startX: start.x, endX: finish.x, sourceLeft: sourceCard.getBoundingClientRect().left, targetRight: targetCard.getBoundingClientRect().right }
  })
  if (Math.abs(joinLayout.startX - joinLayout.sourceLeft) > 1 || Math.abs(joinLayout.endX - joinLayout.targetRight) > 1) throw new Error(`Query Builder join endpoints miss their table edges: ${JSON.stringify(joinLayout)}`)
  console.log('Query Builder relationship path:', joinLayout)
  await capturePair('ui-corrections', '.qb-panel')

  // SQL Editor and result grid.
  await page.locator('button[title^="New SQL Document"]').click()
  await page.locator('.monaco-editor').last().waitFor()
  const editor = page.locator('.monaco-editor').last()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(`SELECT c.id, c.name, c.email, o.total, o.created_at FROM ${database}.customers c JOIN ${database}.orders o ON o.customer_id = c.id ORDER BY o.created_at LIMIT 100;`)
  const execute = page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).first()
  await execute.click()
  await page.locator('.result-grid').last().waitFor({ timeout: 30_000 })
  const initialGrid = page.locator('.result-grid').last()
  await page.waitForFunction(() => [...document.querySelectorAll('.result-grid')].at(-1)?.textContent?.includes('Ana Silva'), { timeout: 30_000 }).catch(async () => {
    console.log('SQL result diagnostic:', { grid: await initialGrid.innerText().catch(() => ''), output: (await page.locator('.output-log').innerText().catch(() => '')).slice(-1000), editor: await page.locator('.monaco-editor').last().innerText().catch(() => '') })
    throw new Error('SQL Editor query did not render expected fixture data')
  })
  await page.locator('.result-grid').last().locator('tbody tr:not(.grid-spacer)').first().waitFor()
  await capturePair('sql-editor', '.result-grid')

  // Editable result cell with a pending, unapplied change.
  await page.locator('.monaco-editor').last().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(`SELECT * FROM \`${database}\`.customers ORDER BY id LIMIT 100;`)
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).first().click()
  await page.locator('.result-grid tbody tr:not(.grid-spacer)').first().waitFor()
  const editableGrid = page.locator('.result-grid').last()
  await page.waitForFunction(() => [...document.querySelectorAll('.result-grid')].at(-1)?.textContent?.includes('Ana Silva'), { timeout: 30_000 })
  const gridRow = editableGrid.locator('tbody tr:not(.grid-spacer)').first()
  const nameColumnIndex = (await editableGrid.locator('thead th').allTextContents()).findIndex((value) => value.trim().toLowerCase().startsWith('name'))
  if (nameColumnIndex < 0) throw new Error('Editable grid does not contain the expected name column')
  await gridRow.locator('td').nth(nameColumnIndex).dblclick()
  const editBox = gridRow.locator('input').first()
  await editBox.waitFor({ state: 'visible' })
  await editBox.fill('Ana Silva · pending edit')
  await editBox.press('Enter')
  await page.locator('.grid-edit-toolbar').waitFor()
  await capturePair('table-data-grid-edit', '.result-grid')

  // ER diagram panel and table designer context editor.
  await openMenu(/^Database$/, /Database Diagram/)
  const diagram = page.locator('.er-panel')
  await diagram.waitFor()
  await diagram.getByLabel('Connection').selectOption({ label: 'README demo · local MySQL' })
  await diagram.getByLabel('Database').selectOption(database)
  await diagram.getByRole('button', { name: 'Load Diagram' }).click()
  await diagram.locator('.er-table').filter({ hasText: 'customers' }).waitFor({ timeout: 30_000 })
  await capturePair('er-diagram', '.er-panel')

  // Schema comparison presents the two real disposable schemas and their differences.
  await openMenu(/^Comparison$/, /New Schema Comparison/)
  const compare = page.locator('.compare-panel')
  await compare.waitFor()
  await compare.getByLabel(/Source database/).fill(database)
  await compare.getByLabel(/Destination database/).fill(targetDatabase)
  await compare.getByLabel(/Source connection/).selectOption({ label: 'README demo · local MySQL' })
  await compare.getByLabel(/Destination connection/).selectOption({ label: 'README demo · local MySQL' })
  const compareButton = compare.getByRole('button', { name: /Compare/ })
  if (await compareButton.count()) {
    await compareButton.click()
    await compare.locator('.schema-diff-table').waitFor({ timeout: 30_000 })
  }
  await capturePair('schema-compare', '.compare-panel')

  // Deploy the server-side engine and pause after loading a local variable for Variables and Watches.
  await setTheme('light')
  await openMenu(/^Debug$/, /Start Debugging/)
  const debugPanel = page.locator('.routine-debugger')
  await debugPanel.waitFor()
  const deployButton = debugPanel.getByRole('button', { name: /Deploy Debug Engine/ })
  await deployButton.click()
  await page.waitForFunction(() => /Engine v\d+/.test(document.querySelector('.rd-engine')?.textContent ?? ''), { timeout: 30_000 })
  const routineSelect = debugPanel.locator('.rd-target select').filter({ has: page.locator('option[value="debug_customer"]') })
  await routineSelect.selectOption('debug_customer')
  await debugPanel.getByRole('button', { name: /Edit Parameters/ }).click()
  await page.getByRole('dialog').getByLabel('p_customer_id value', { exact: true }).fill('1')
  await page.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click()
  const buttonLabels = [
    ['Start Debugging', debugPanel.locator('.rd-target')],
    ['Continue Alt+F9', debugPanel.locator('.rd-toolbar')],
    ['Step Into F11', debugPanel.locator('.rd-toolbar')],
    ['Step Over F10', debugPanel.locator('.rd-toolbar')],
    ['Step Out Shift+F11', debugPanel.locator('.rd-toolbar')],
    ['Run To Cursor', debugPanel.locator('.rd-toolbar')],
    ['Stop', debugPanel.locator('.rd-toolbar')],
    ['Restart', debugPanel.locator('.rd-toolbar')]
  ]
  for (const [label, scope] of buttonLabels) {
    if (!(await scope.getByRole('button', { name: label, exact: true }).count())) throw new Error(`Routine Debugger button label is missing or combined: ${label}`)
  }
  await debugPanel.locator('.rd-target').getByRole('button', { name: 'Start Debugging', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.rd-toolbar')?.textContent?.includes('paused'), null, { timeout: 30_000 })
  const watchInput = debugPanel.locator('.rd-watch-add input')
  await watchInput.fill('customer_name')
  await debugPanel.locator('.rd-watch-add').getByRole('button', { name: /Add Watch/ }).click()
  await debugPanel.locator('.rd-toolbar').getByRole('button', { name: 'Step Over F10', exact: true }).click()
  await page.waitForFunction(() => {
    const variables = document.querySelector('.rd-side')?.textContent ?? ''
    const watches = document.querySelector('.rd-bottom')?.textContent ?? ''
    return variables.includes('customer_name') && variables.includes('Ana Silva') && watches.includes('customer_name') && watches.includes('Ana Silva')
  }, null, { timeout: 30_000 })
  await capturePair('routine-debugger', '.routine-debugger')

  // Open Table Designer from the explorer's table context menu.
  const savedConnection = page.locator('.connection-node').filter({ hasText: 'README demo · local MySQL' })
  const connectionExpander = savedConnection.locator('.node-expander')
  if (await savedConnection.getAttribute('aria-expanded') !== 'true') await connectionExpander.click()
  const databaseNameNode = page.locator('.database-name').filter({ hasText: new RegExp(`${database}$`) }).last()
  const databaseNode = databaseNameNode.locator('xpath=..')
  await databaseNode.locator('.database-name > span').click()
  await databaseNode.locator('.object-group-name').first().click()
  await page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).waitFor()
  const customerNode = page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).last()
  await customerNode.click({ button: 'right', force: true })
  await page.getByRole('menuitem', { name: /Open Editor|Abrir editor/ }).click({ force: true })
  await page.locator('.object-editor').waitFor({ timeout: 10_000 })
  await capturePair('table-designer', '.object-editor')

  // AI Assistant dock, left unconfigured so no credentials or external request are needed.
  await page.locator('.menubar-ai').click()
  await capturePair('ai-assistant', '.ai-panel')

  const present = await readdir(evidenceDirectory)
  const missing = expectedFiles.filter((file) => !present.includes(file))
  if (missing.length) throw new Error(`README screenshot set incomplete; missing: ${missing.join(', ')}`)
  console.log(`Generated exactly ${expectedFiles.length} README screenshots in ${evidenceDirectory} using ${appBinary}.`)
} finally {
  if (page) {
    const debugPanel = page.locator('.routine-debugger')
    const stopButton = debugPanel.locator('.rd-toolbar').getByRole('button', { name: 'Stop', exact: true })
    if (await stopButton.count().catch(() => 0)) {
      await stopButton.click().catch(() => undefined)
      await page.waitForFunction(() => /stopped|finished|error/i.test(document.querySelector('.rd-toolbar')?.textContent ?? ''), { timeout: 15_000 }).catch(() => undefined)
    }
  }
  await stopApp()
  if (targetCreated) await admin.query(`DROP DATABASE IF EXISTS \`${targetDatabase}\``).catch(() => undefined)
  if (sourceCreated) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.query('DROP DATABASE IF EXISTS `tuxsql_linux_debug`').catch(() => undefined)
  await admin.end().catch(() => undefined)
  await rm(dataRoot, { recursive: true, force: true })
}
