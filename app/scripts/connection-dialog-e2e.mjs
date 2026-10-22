/* global process, console, setTimeout, clearTimeout */
/* global document */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-connection-ui-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui', '01-connection')
const database = mysqlTestPrefix('connection_dialog')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  await mkdir(evidenceRoot, { recursive: true })
  app = await electron.launch({ executablePath: join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql'), args: [], env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  await page.locator('.workbench').waitFor()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  const dialog = page.getByRole('dialog', { name: 'Database Connection Properties' })
  await dialog.waitFor()
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('root')
  const nameField = page.locator('.form-grid .form-field').filter({ hasText: 'Connection Name' }).locator('input')
  assert.equal(await nameField.inputValue(), '127.0.0.1:33067', 'connection name follows the edited endpoint until manually changed')
  await nameField.fill('Manual connection name')
  await page.getByLabel('Host').fill('localhost')
  await page.getByLabel('Host').fill('127.0.0.1')
  assert.equal(await nameField.inputValue(), 'Manual connection name', 'user edits stop automatic name updates')
  await page.getByRole('textbox', { name: 'Password' }).fill('intentionally-wrong-password')
  await dialog.getByRole('button', { name: 'Test Connection' }).click()
  const errorDialog = page.getByRole('dialog', { name: 'Test Connection' })
  await errorDialog.waitFor()
  const errorMessage = await errorDialog.locator('.connection-error-message').innerText()
  assert.match(errorMessage, /Access denied|1045/)
  assert.ok(!errorMessage.includes('Error invoking remote method'), 'IPC method names are not shown to users')
  assert.ok(!errorMessage.includes('intentionally-wrong-password'), 'server error never reveals entered password')
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `connection-error-${theme}.png`) })
  }
  await errorDialog.getByRole('button', { name: 'OK' }).click()

  if (process.env.TUXSQL_CONNECTION_ERROR_ONLY !== '1') {
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await dialog.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected\. Server version:/).waitFor()
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.locator('option').filter({ hasText: database }).waitFor({ state: 'attached' })
  assert.ok(await databaseSelect.locator('option[value="mysql"]').count(), 'system databases are included when Show all databases is enabled')
  await page.getByRole('checkbox', { name: 'Show all databases' }).uncheck()
  await dialog.getByRole('button', { name: 'Refresh' }).click()
  await databaseSelect.locator('option[value="mysql"]').waitFor({ state: 'detached' })
  await page.getByRole('checkbox', { name: 'Show all databases' }).check()
  await dialog.getByRole('button', { name: 'Refresh' }).click()
  await databaseSelect.locator('option[value="mysql"]').waitFor({ state: 'attached' })
  assert.ok(await dialog.getByRole('button', { name: 'Connect', exact: true }).count() >= 1)
  assert.ok(await dialog.locator('.dialog-footer').getByRole('button', { name: 'Cancel' }).count())
  await databaseSelect.selectOption('')
  const warningPromise = page.waitForEvent('dialog')
  page.once('dialog', (warning) => { assert.match(warning.message(), /not specified a default database/i); void warning.dismiss() })
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  await warningPromise
  await databaseSelect.selectOption(database)

  for (const theme of ['Light', 'Dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme.toLowerCase())
    await page.locator('.connection-dialog').waitFor()
    for (const tab of ['General', 'Advanced', 'Security', 'HTTP', 'Embedded']) {
      const tabButton = page.locator('.connection-pages').getByRole('button', { name: tab, exact: false })
      if (tab === 'Embedded') {
        assert.equal(await tabButton.isDisabled(), true)
        assert.match(await tabButton.getAttribute('title'), /not included|indisponível/i)
        continue
      }
      await tabButton.click()
      if (tab === 'General') assert.ok(await page.getByLabel('Show all databases').count())
      if (tab === 'Security') {
        await page.locator('.connection-page-content .form-field').filter({ has: page.getByText('Protocol', { exact: true }) }).locator('select').selectOption('ssh')
        assert.ok(await page.getByRole('checkbox', { name: 'Keyboard Interactive Mode' }).count())
      }
      if (tab === 'HTTP') assert.ok(await page.getByLabel('Use Base64 encoding').count())
      await page.screenshot({ path: join(evidenceRoot, `connection-${tab.toLowerCase()}-${theme.toLowerCase()}.png`) })
    }
  }
  }
  console.log(`Connection dialog screenshots saved in ${evidenceRoot}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try {
        await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30000) })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      } finally { if (timer) clearTimeout(timer) }
    }
  }
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
