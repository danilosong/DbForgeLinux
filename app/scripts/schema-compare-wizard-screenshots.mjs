/* global process, console, setTimeout, clearTimeout, document */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const electronPath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(electronPath)) throw new Error(`Packaged Electron executable not found at ${electronPath}. Build the app first.`)
const prefix = mysqlTestPrefix('schema_compare_wizard')
const sourceDb = `${prefix}_source`
const targetDb = `${prefix}_target`
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-schema-compare-ui-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui', '06-schema-compare')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
try {
  await admin.query(`CREATE DATABASE \`${sourceDb}\``)
  await admin.query(`CREATE DATABASE \`${targetDb}\``)
  await admin.query(`CREATE TABLE \`${sourceDb}\`.source_only (id INT PRIMARY KEY)`)
  await admin.query(`CREATE TABLE \`${targetDb}\`.target_only (id INT PRIMARY KEY)`)
  await mkdir(evidenceRoot, { recursive: true })
  app = await electron.launch({ executablePath: electronPath, args: ['--disable-gpu'], cwd: process.cwd(), timeout: 90_000, env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', LANGUAGE: 'en', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(20_000)
  await page.locator('.workbench').waitFor()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  const connection = page.getByRole('dialog', { name: 'Database Connection Properties' })
  await connection.waitFor()
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await connection.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected\. Server version:/).waitFor()
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.selectOption(sourceDb)
  await connection.getByRole('button', { name: 'Connect', exact: true }).click()
  await connection.waitFor({ state: 'detached' })

  const openCompare = async () => {
    await page.locator('summary').filter({ hasText: /^Comparison$/ }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: 'New Schema Comparison' }).click()
    await page.locator('.compare-panel').waitFor()
  }
  const panel = page.locator('.compare-panel')
  await openCompare()
  await page.waitForFunction(() => { const selects = [...document.querySelectorAll('.compare-form select')]; return Boolean(selects[1]?.value && selects[3]?.value) })
  const sourceDatabase = panel.getByRole('textbox', { name: 'Source database' })
  const targetDatabase = panel.getByRole('textbox', { name: 'Destination database' })
  await sourceDatabase.fill(sourceDb)
  await targetDatabase.fill('')
  const invalidAlert = page.waitForEvent('dialog')
  page.once('dialog', (invalid) => { assert.equal(invalid.message(), 'Comparison target is invalid'); void invalid.accept() })
  await panel.getByRole('button', { name: /Next/ }).click()
  await invalidAlert
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `schema-compare-invalid-target-${theme}.png`) })
  }
  await targetDatabase.fill(targetDb)
  await panel.getByRole('button', { name: /Next/ }).click()
  await panel.locator('.schema-option-list').waitFor()
  await panel.getByRole('button', { name: /Compare/ }).click()
  await page.locator('.schema-compare-progress').waitFor()
  assert.equal(await page.locator('.schema-compare-progress li').count(), 5)
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  await page.screenshot({ path: join(evidenceRoot, 'schema-compare-progress-light.png') })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.screenshot({ path: join(evidenceRoot, 'schema-compare-progress-dark.png') })
  await page.locator('.schema-diff-table').waitFor({ timeout: 30_000 })
  await panel.getByRole('button', { name: /Synchronize/ }).click()
  const wizard = page.locator('.schema-sync-wizard')
  await wizard.waitFor()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `schema-sync-output-${theme}.png`) })
  }
  const steps = wizard.locator('.schema-wizard-steps button')
  assert.equal(await steps.count(), 4)
  await wizard.getByRole('button', { name: /Summary/ }).click()
  await wizard.getByRole('heading', { name: /Action Plan/ }).waitFor()
  const actionGroups = wizard.locator('.schema-action-group')
  assert.ok(await actionGroups.count() > 0)
  assert.ok(await wizard.getByRole('heading', { name: /Drop tables/ }).count())
  assert.ok(await wizard.getByRole('heading', { name: 'Schema Update Script' }).count())
  assert.equal(await wizard.locator('.schema-danger-confirm input[type="checkbox"]').count(), 1)
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `schema-sync-action-plan-${theme}.png`) })
  }
  await wizard.getByRole('button', { name: /Additional Scripts/ }).click()
  await wizard.getByLabel(/Scripts to execute before/).fill('CREATE FUNCTION preview_without_characteristics() RETURNS INT RETURN 1;')
  await wizard.getByRole('button', { name: /Summary/ }).click()
  const functionWarning = wizard.locator('.schema-function-warning')
  await functionWarning.waitFor()
  await functionWarning.scrollIntoViewIfNeeded()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `schema-sync-function-warning-${theme}.png`) })
  }
  console.log(`Schema Compare evidence saved in ${evidenceRoot}`)
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
  await admin.query(`DROP DATABASE IF EXISTS \`${sourceDb}\``).catch(() => undefined)
  await admin.query(`DROP DATABASE IF EXISTS \`${targetDb}\``).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
