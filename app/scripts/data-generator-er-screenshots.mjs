/* global process, console, document, HTMLDetailsElement, HTMLButtonElement, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestUser } from './mysql-test-prefix.mjs'

const executable = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(executable)) throw new Error(`Packaged app not found: ${executable}`)
const suffix = `${process.pid}_${randomUUID().slice(0, 8)}`
const database = `tuxsql_gen_er_${suffix}`
const user = mysqlTestUser('generator_er_ui')
const password = `Ui-${randomUUID().slice(0, 14)}-9!`
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-gen-er-ui-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', '09-11-generator-er')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only', multipleStatements: false })
let app
let createdUser = false
let createdDatabase = false
try {
  await admin.query(`CREATE DATABASE \`${database}\``); createdDatabase = true
  await admin.query(`CREATE USER '${user}'@'%' IDENTIFIED BY ?`, [password]); createdUser = true
  await admin.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'%'`)
  await admin.query(`CREATE TABLE \`${database}\`.customers (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE) ENGINE=InnoDB`)
  await admin.query(`CREATE TABLE \`${database}\`.orders (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, total DECIMAL(10,2) NOT NULL, CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES \`${database}\`.customers(id)) ENGINE=InnoDB`)
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: executable, args: ['--disable-gpu'], timeout: 90_000, env: { ...process.env, LANG: 'en_US.UTF-8', LANGUAGE: 'en', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const newConnection = page.getByRole('region', { name: 'Start Page' }).getByRole('button', { name: 'New Connection', exact: true })
  await newConnection.click()
  await page.getByLabel('Connection name').fill('Temporary 09 and 11 evidence')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill(user)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await page.locator('.connection-status.success').waitFor({ timeout: 30_000 })
  const loadDatabases = page.getByRole('button', { name: /Load Databases|Refresh Databases|Databases/ }).filter({ visible: true })
  if (await loadDatabases.count()) await loadDatabases.click()
  const databaseField = page.locator('.form-field').filter({ has: page.getByText('Database', { exact: true }) }).getByRole('combobox')
  await databaseField.selectOption(database)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  await page.locator('.explorer-dock').waitFor()
  await page.locator('.node-name').filter({ hasText: 'Temporary 09 and 11 evidence' }).click()
  await page.locator('.database-name').filter({ hasText: new RegExp(`${database}$`) }).dblclick()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  await page.locator('.explorer-tree .object-name').filter({ hasText: 'customers' }).waitFor()
  const menuAction = async (menuName, actionName) => {
    await page.evaluate(({ requestedMenu, requestedAction }) => {
      const menu = [...document.querySelectorAll('.menu-row > details')].find((item) => item.querySelector(':scope > summary')?.textContent?.trim() === requestedMenu)
      if (!(menu instanceof HTMLDetailsElement)) throw new Error(`Menu not found: ${requestedMenu}`)
      menu.open = true
      const action = [...menu.querySelectorAll('.menu-action')].find((item) => item.textContent?.trim() === requestedAction)
      if (!(action instanceof HTMLButtonElement)) throw new Error(`Menu action not found: ${requestedAction}`)
      action.click()
    }, { requestedMenu: menuName, requestedAction: actionName })
  }
  const capture = async (module, file) => {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((mode) => { document.documentElement.dataset.theme = mode }, theme)
      await module.waitFor()
      await page.screenshot({ path: join(evidence, `${file}-${theme}.png`) })
    }
  }
  await page.evaluate(() => {
    const databaseMenu = [...document.querySelectorAll('.menu-row > details')].find((item) => item.querySelector(':scope > summary')?.textContent?.trim() === 'Database')
    const taskMenu = databaseMenu ? [...databaseMenu.querySelectorAll('.menu-nested')].find((item) => item.querySelector(':scope > summary')?.textContent?.trim() === 'Tasks') : undefined
    if (!(taskMenu instanceof HTMLDetailsElement)) throw new Error('Database tasks menu was not found.')
    taskMenu.open = true
    const action = [...taskMenu.querySelectorAll('.menu-action')].find((item) => item.textContent?.trim() === 'Data Generation…')
    if (!(action instanceof HTMLButtonElement)) throw new Error('Data Generation menu action was not found.')
    action.click()
  })
  const generator = page.locator('.data-generator-panel')
  await generator.waitFor()
  await generator.locator('.dg-source').getByRole('textbox').fill(database)
  await generator.getByRole('button', { name: 'Select Tables', exact: true }).click()
  await generator.getByText('Related tables', { exact: false }).waitFor({ timeout: 20_000 })
  await capture(generator, 'data-generator')
  const generatorClose = page.locator('.panel-dialog-backdrop').filter({ has: generator }).getByRole('button', { name: /Close/ })
  if (await generatorClose.count()) await generatorClose.click({ force: true })
  await menuAction('Database', 'Database Diagram')
  const diagram = page.locator('.er-panel')
  await diagram.waitFor()
  await diagram.locator('select').filter({ has: page.getByRole('option', { name: 'Temporary 09 and 11 evidence', exact: true }) }).selectOption({ label: 'Temporary 09 and 11 evidence' })
  await diagram.locator('select').filter({ has: page.getByRole('option', { name: database, exact: true }) }).selectOption(database)
  await diagram.getByRole('button', { name: 'Load Diagram', exact: true }).click()
  await diagram.locator('.er-table').filter({ hasText: 'orders' }).waitFor({ timeout: 30_000 })
  const orderCard = diagram.locator('.er-table[aria-label="Table orders"]')
  const indexSection = orderCard.locator('.er-section').filter({ hasText: /Indexes \(1\)/ })
  const cardBackground = orderCard.locator('rect:not(.er-table-head)')
  const fullCardHeight = Number(await cardBackground.getAttribute('height'))
  await indexSection.click()
  const foldedCardHeight = Number(await cardBackground.getAttribute('height'))
  if (!(foldedCardHeight < fullCardHeight)) throw new Error('Collapsing the ER card index section did not reduce the card height.')
  await indexSection.click()
  await diagram.getByRole('button', { name: 'Add container', exact: true }).click()
  await diagram.getByRole('button', { name: 'Add note', exact: true }).click()
  await diagram.locator('.er-container').waitFor()
  await diagram.getByRole('textbox', { name: 'Diagram note' }).fill('Keep the customer and order entities together.')
  await diagram.getByRole('button', { name: 'Toggle diagram overview' }).click()
  const overview = diagram.locator('.er-overview-popover')
  await overview.waitFor()
  await capture(diagram, 'er-diagram-overview')
  const canvasContent = diagram.locator('.er-canvas > g[transform]')
  const transformBefore = await canvasContent.getAttribute('transform')
  const mapBounds = await overview.locator('.er-minimap').boundingBox()
  if (!mapBounds) throw new Error('Floating diagram overview has no visible bounds.')
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.25, mapBounds.y + mapBounds.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.75, mapBounds.y + mapBounds.height * 0.5)
  await page.mouse.up()
  const transformAfter = await canvasContent.getAttribute('transform')
  if (transformBefore === transformAfter) throw new Error('Dragging the overview did not move the diagram viewport.')
  console.log(`Saved light and dark Data Generator and ER Diagram captures in ${evidence}.`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  if (createdUser) await admin.query(`DROP USER IF EXISTS '${user}'@'%'`).catch(() => undefined)
  if (createdDatabase) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end().catch(() => undefined)
  await rm(dataRoot, { recursive: true, force: true })
}
