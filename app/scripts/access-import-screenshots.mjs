/* global process, console, setTimeout, clearTimeout, document, localStorage, getComputedStyle, fetch */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import mysql from 'mysql2/promise'
import { chromium } from 'playwright'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const database = mysqlTestPrefix('access_ui')
const destinations = ['access_customers_light', 'access_customers_dark']
const fixture = join(process.cwd(), 'test', 'fixtures', 'sample-access.mdb')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-access-ui-'))
const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
let browser
let page

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not reserve an Electron debug port.')
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function connectToApp(port) {
  const url = `http://127.0.0.1:${port}`
  let lastError
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${url}/json/version`)
      if (response.ok) return chromium.connectOverCDP(url, { timeout: 10_000 })
    } catch (error) { lastError = error }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Electron did not expose its UI debugging endpoint.', { cause: lastError })
}

function quoteIdentifier(value) { return `\`${value.replaceAll('`', '``')}\`` }

async function chooseTheme(page, theme) {
  await page.locator('.menu-row summary').filter({ hasText: /^(View|Exibir)$/ }).evaluate((element) => element.click())
  await page.getByRole('button', { name: theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/ }).evaluate((element) => element.click())
  await page.waitForFunction((mode) => localStorage.getItem('tuxsql.theme') === mode && document.documentElement.dataset.theme === mode, theme)
}

async function assertTheme(page, theme) {
  const state = await page.evaluate(() => {
    const color = getComputedStyle(document.documentElement).backgroundColor
    const rgb = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!rgb || rgb.length !== 3) throw new Error(`Could not read theme background: ${color}`)
    const linear = rgb.map((channel) => { const normalized = channel / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4 })
    return { color, mode: localStorage.getItem('tuxsql.theme'), theme: document.documentElement.dataset.theme, luminance: 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] }
  })
  assert.equal(state.mode, theme, `theme preference should be ${theme}`)
  assert.equal(state.theme, theme, `active theme should be ${theme}`)
  assert.ok(theme === 'dark' ? state.luminance < 0.3 : state.luminance > 0.7, `${theme} background luminance ${state.luminance} (${state.color})`)
}

try {
  await admin.query(`CREATE DATABASE ${quoteIdentifier(database)}`)
  for (const table of destinations) {
    await admin.query(`CREATE TABLE ${quoteIdentifier(database)}.${quoteIdentifier(table)} (
      CustomerID INT PRIMARY KEY,
      DisplayName VARCHAR(50),
      CreditLimit DECIMAL(19,4),
      CreatedAt DATETIME,
      IsActive TINYINT(1),
      Notes TEXT,
      OptionalCode VARCHAR(15)
    ) DEFAULT CHARACTER SET utf8mb4`)
  }
  const executablePath = process.env.TUXSQL_APP_BIN ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
  const port = await freePort()
  app = spawn(executablePath, ['--no-sandbox', `--remote-debugging-port=${port}`], {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TUXSQL_LINUX_BACKEND: 'x11', TUXSQL_NO_DEV_LINK: '1', TUXSQL_E2E_FILE_DIALOG: '1', TUXSQL_E2E_IMPORT_SOURCE: fixture, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  browser = await connectToApp(port)
  page = browser.contexts()[0]?.pages()[0]
  if (!page) throw new Error('Electron opened without a renderer page.')
  await page.locator('.workbench').waitFor({ timeout: 30_000 })
  page.setDefaultTimeout(10_000)
  const startupLater = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await startupLater.count()) await startupLater.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  console.log('Access UI: opening disposable MySQL connection')
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  await page.getByLabel('Connection name').fill('Disposable Access Fixture')
  await page.getByLabel('Host').fill(process.env.MYSQL_HOST ?? '127.0.0.1')
  await page.getByLabel('Port').fill(process.env.MYSQL_PORT ?? '33067')
  await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.locator('#connection-database').selectOption(database, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  const connectionNode = page.locator('.node-name').filter({ hasText: 'Disposable Access Fixture' })
  await connectionNode.waitFor()
  await connectionNode.click()
  const databaseNode = page.locator('.database-name').filter({ hasText: database })
  await databaseNode.waitFor()
  await databaseNode.locator('span').click()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  console.log('Access UI: connected to disposable MySQL database')
  const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui', '07-access-import')
  await mkdir(evidenceDirectory, { recursive: true })

    const theme = 'light'
    await chooseTheme(page, theme)
    await assertTheme(page, theme)
    const target = destinations[0]
    const tableNode = page.locator('.object-name').filter({ hasText: target })
    await tableNode.waitFor()
    await tableNode.click({ button: 'right' })
    await page.locator('.explorer-context-menu').getByRole('menuitem', { name: /Import Data/ }).click()
    await page.locator('.io-wizard').waitFor()
    await page.locator('.io-toolbar select').filter({ has: page.locator('option[value="import"]') }).selectOption('import')
    const accessFormat = page.locator('.io-format-grid button').filter({ hasText: /^Access/ })
    await accessFormat.waitFor()
    assert.equal(await accessFormat.isEnabled(), true, 'Access import is enabled because mdbtools is installed')
    await accessFormat.click()
    console.log(`Access UI: selecting sample-access.mdb (${theme})`)
    await page.getByRole('button', { name: /Browse/ }).click()
    const accessTable = page.getByLabel(/Access table/)
    await accessTable.waitFor()
    await accessTable.selectOption('Customers')
    const next = page.locator('.io-footer button.button-primary')
    await next.click()
    await next.click()
    await page.getByText("João d'Ávila", { exact: false }).waitFor()
    await assertTheme(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `access-import-customers-${theme}-preview.png`) })
    console.log(`Access UI: importing Customers into ${target}`)
    for (let step = 0; step < 6; step++) await next.click()
    await next.click()
    await page.waitForTimeout(1_500)
    console.log(`Access UI post-import state (${theme}): ${(await page.locator('.io-page').innerText()).replaceAll('\n', ' | ').slice(0, 1800)}`)
    await page.getByText(/Import complete/).waitFor({ timeout: 10_000 })
    const [rows] = await admin.query(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(database)}.${quoteIdentifier(target)}`)
    assert.equal(Number(rows[0].total), 3, `${target} was populated through the Import wizard`)
    await assertTheme(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `access-import-customers-${theme}.png`) })
    await chooseTheme(page, 'dark')
    await assertTheme(page, 'dark')
    await page.screenshot({ path: join(evidenceDirectory, 'access-import-customers-dark.png') })
  console.log(`Access import UI screenshots saved in ${evidenceDirectory}`)
} catch (error) {
  console.error('Access import UI capture failed:', error)
  if (page) await page.screenshot({ path: '/tmp/tuxsql-access-import-failure.png' }).catch(() => undefined)
  throw error
} finally {
  if (app) {
    if (browser) await browser.close().catch(() => undefined)
    if (app.exitCode === null && app.signalCode === null) {
      const exited = once(app, 'exit')
      app.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (app.exitCode === null && app.signalCode === null) { app.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
