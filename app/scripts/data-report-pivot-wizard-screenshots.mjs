/* global process, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import { _electron as electron } from 'playwright'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const database = mysqlTestPrefix('report_wizard_capture')
const table = 'orders'
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-report-wizard-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', '16-data-report-pivot')
const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
const appBinary = process.env.TUXSQL_APP_BIN ?? join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
let app
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  await admin.query(`CREATE TABLE \`${database}\`.\`${table}\` (id INT PRIMARY KEY, status VARCHAR(24), total DECIMAL(9,2))`)
  await admin.query(`INSERT INTO \`${database}\`.\`${table}\` VALUES (1,'open',12.5),(2,'closed',20.0)`)
  app = await electron.launch({ executablePath: appBinary, args: appBinary.endsWith('/electron') ? ['.'] : ['--disable-gpu'], cwd: process.cwd(), timeout: 90_000, env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor({ state: 'visible', timeout: 30_000 })
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
  if (await later.count()) await later.click()
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Disposable Report Wizard')
  await page.getByLabel('Host').fill(process.env.MYSQL_HOST ?? '127.0.0.1')
  await page.getByLabel('Port').fill(process.env.MYSQL_PORT ?? '33067')
  await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.locator('#connection-database').selectOption(database, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  await page.locator('select[aria-label="Ativa conexão"]').selectOption({ label: 'Disposable Report Wizard' })
  const databaseMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^Database$/ }) })
  await databaseMenu.evaluate((element) => { element.open = true })
  await databaseMenu.getByRole('button', { name: /Report Designer/ }).click()
  const existingDesigner = page.getByTestId('report-designer')
  if (await existingDesigner.count()) {
    await existingDesigner.waitFor({ state: 'visible' })
    await existingDesigner.getByRole('button', { name: 'Close designer' }).click()
  }
  const panel = page.getByTestId('report-pivot-panel')
  await panel.waitFor({ state: 'visible' })
  await panel.getByRole('button', { name: 'New Data Report' }).click()
  const wizard = page.getByTestId('data-report-wizard')
  await wizard.waitFor({ state: 'visible' })
  const wizardNext = async (step) => {
    await wizard.getByRole('button', { name: 'Next', exact: true }).click({ force: true })
    await wizard.getByText(`Step ${step} of 8`, { exact: false }).waitFor({ state: 'visible' })
  }
  await wizardNext(2)
  await wizard.getByLabel('Connection').selectOption({ label: 'Disposable Report Wizard' })
  await wizard.getByLabel('Database').selectOption(database)
  await wizardNext(3)
  await wizard.locator('select[aria-label="Table or view"]').selectOption(table)
  await wizardNext(4)
  await wizard.getByLabel('Available columns').locator('option').first().waitFor({ state: 'visible' })
  await mkdir(evidence, { recursive: true })
  const themeMenu = page.locator('summary').filter({ hasText: 'View' })
  for (const theme of ['Light', 'Dark']) {
    const themeButton = page.getByRole('button', { name: `Theme: ${theme}`, exact: true })
    if (!(await themeButton.isVisible())) { await themeMenu.click(); await page.getByRole('button', { name: `Theme: ${theme}`, exact: true }).click() }
    await page.waitForFunction((expected) => document.documentElement.getAttribute('data-theme') === expected.toLowerCase(), theme)
    await page.screenshot({ path: join(evidence, `data-report-wizard-${theme.toLowerCase()}.png`) })
  }
  await app.close()
  app = undefined
} finally {
  if (app) await app.close().catch(() => undefined)
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end().catch(() => undefined)
  await rm(dataRoot, { recursive: true, force: true })
}
