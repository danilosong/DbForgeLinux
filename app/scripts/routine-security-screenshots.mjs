/* global process, console, document, window */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

const executable = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
if (!existsSync(executable)) throw new Error('Build TuxSQL before capturing UI evidence.')
const suffix = `${process.pid}_${randomUUID().slice(0, 8)}`
const database = `tuxsql_debug_ui_${suffix}`
const temp = await mkdtemp(join(tmpdir(), 'tuxsql-debug-ui-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only', multipleStatements: false })
let app
let madeDb = false
const panel = '.routine-debugger'
try {
  await admin.query("UPDATE tuxsql_linux_debug.debug_sessions SET status='error' WHERE database_name LIKE 'tuxsql_debug_ui_%' AND status IN ('preparing','running','paused')").catch(() => undefined)
  await admin.query("DELETE FROM tuxsql_linux_debug.routine_sources WHERE database_name LIKE 'tuxsql_debug_ui_%'").catch(() => undefined)
  await admin.query(`CREATE DATABASE \`${database}\``); madeDb = true
  await admin.query(`CREATE PROCEDURE \`${database}\`.debug_sample(IN p_id INT UNSIGNED, OUT p_label VARCHAR(40), INOUT p_total INT)
BEGIN
  DECLARE computed INT DEFAULT 0;
  SET computed=p_id*2;
  SET p_label=CONCAT('item-',computed);
  SET p_total=p_total+computed;
  SELECT p_id AS requested_id, computed AS calculated_total;
END`)
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: executable, args: ['--disable-gpu'], cwd: process.cwd(), timeout: 90_000, env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(temp, 'config'), XDG_CACHE_HOME: join(temp, 'cache'), XDG_DATA_HOME: join(temp, 'data'), XDG_STATE_HOME: join(temp, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await page.evaluate(() => { window.confirm = () => true })
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  await page.getByLabel('Connection name').fill('Debugger UI evidence')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('root')
  await page.getByLabel('Password', { exact: true }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.locator('.connection-status.success').waitFor({ timeout: 30_000 })
  const loadDatabases = page.getByRole('button', { name: /^Load Databases$/ })
  if (await loadDatabases.count()) await loadDatabases.click().catch(() => undefined)
  const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
  await databaseSelect.selectOption(database)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  const chooseTheme = async (theme) => { await page.evaluate((value) => { document.documentElement.dataset.theme = value.toLowerCase() }, theme) }
  for (const theme of ['Light']) {
    const suffixTheme = theme.toLowerCase()
    await chooseTheme(theme)
    await page.locator('.menu-row summary').filter({ hasText: /^Debug$/ }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: /^Start Debugging/ }).click()
    const debuggerPanel = page.locator(panel)
    await debuggerPanel.waitFor({ timeout: 20_000 })
    const connectionSelect = debuggerPanel.getByLabel('Connection')
    await page.waitForFunction(() => {
      const field = [...document.querySelectorAll('.rd-target label')].find((label) => label.textContent?.includes('Connection'))
      return Boolean(field?.querySelector('select') && !field.querySelector('select')?.hasAttribute('disabled'))
    }, null, { timeout: 30_000 })
    await connectionSelect.selectOption({ label: 'Debugger UI evidence' })
    await debuggerPanel.getByLabel('Database').selectOption(database)
    await debuggerPanel.locator('label').filter({ hasText: 'Select procedure' }).locator('select').selectOption('debug_sample')
    const deployButton = debuggerPanel.getByRole('button', { name: /Deploy Debug Engine/ })
    if (await deployButton.count()) await deployButton.click()
    await debuggerPanel.getByText(/Engine v/).waitFor({ timeout: 30_000 })
    await page.waitForFunction(() => Number(document.querySelector('.routine-debugger .rd-editor')?.getAttribute('data-source-length')) > 0, null, { timeout: 30_000 })
    const sourceLines = debuggerPanel.locator('.rd-editor .view-lines')
    await sourceLines.waitFor({ timeout: 30_000 })
    const visibleSource = (await sourceLines.allInnerTexts()).join('\n').replace(/\s+/g, ' ')
    const sourceLength = await debuggerPanel.locator('.rd-editor').getAttribute('data-source-length')
    if (!visibleSource.includes('DECLARE computed')) {
      const fields = await debuggerPanel.locator('.rd-target label').evaluateAll((labels) => labels.map((label) => ({ label: label.textContent, value: label.querySelector('select')?.value })))
      throw new Error(`Routine Debugger source panel is empty or missing the loaded declaration (source length ${sourceLength}). Fields: ${JSON.stringify(fields)}; Status: ${await debuggerPanel.locator('.rd-message').innerText().catch(() => '')}; source: ${visibleSource.slice(0, 240)}`)
    }
    await debuggerPanel.screenshot({ path: join(evidence, `debugger-break-all-${suffixTheme}.png`) })
    await chooseTheme('Dark')
    await debuggerPanel.screenshot({ path: join(evidence, 'debugger-break-all-dark.png') })
    await chooseTheme('Light')
    await debuggerPanel.getByRole('button', { name: /Edit Parameters/ }).click()
    const parameterDialog = debuggerPanel.getByRole('dialog', { name: 'Edit Parameters' })
    await parameterDialog.waitFor()
    await parameterDialog.screenshot({ path: join(evidence, `debugger-edit-parameters-${suffixTheme}.png`) })
    await chooseTheme('Dark')
    await parameterDialog.screenshot({ path: join(evidence, 'debugger-edit-parameters-dark.png') })
    await chooseTheme('Light')
    await parameterDialog.getByLabel('p_id value').fill('7')
    await parameterDialog.getByLabel('p_total value').fill('5')
    await parameterDialog.getByRole('button', { name: /Apply/ }).click()
    await debuggerPanel.getByRole('button', { name: 'Start Debugging', exact: true }).click()
    await page.waitForFunction(() => {
      const continueButton = [...document.querySelectorAll('.routine-debugger .rd-toolbar button')].find((button) => button.textContent?.includes('Continue'))
      return Boolean(continueButton && !continueButton.hasAttribute('disabled'))
    }, null, { timeout: 30_000 })
    const pausedSource = (await sourceLines.allInnerTexts()).join('\n').replace(/\s+/g, ' ')
    if (!pausedSource.includes('DECLARE computed')) throw new Error(`Routine Debugger source disappeared while paused: ${pausedSource.slice(0, 240)}`)
    await debuggerPanel.screenshot({ path: join(evidence, 'routine-debugger-light.png') })
    await chooseTheme('Dark')
    await debuggerPanel.getByRole('button', { name: 'Call Stack', exact: true }).click()
    await debuggerPanel.getByRole('button', { name: 'Watches', exact: true }).click()
    await debuggerPanel.screenshot({ path: join(evidence, 'routine-debugger-dark.png') })
    await chooseTheme('Light')
    await debuggerPanel.getByRole('button', { name: 'Call Stack', exact: true }).click()
    await debuggerPanel.getByRole('button', { name: 'Watches', exact: true }).click()
    await debuggerPanel.getByRole('button', { name: /Continue/ }).click()
    const outputDialog = debuggerPanel.getByRole('dialog', { name: 'View Output Parameters' })
    await outputDialog.waitFor({ timeout: 30_000 })
    await outputDialog.getByText('p_label', { exact: true }).waitFor()
    await outputDialog.getByText('item-14', { exact: true }).waitFor()
    await outputDialog.getByText('p_total', { exact: true }).waitFor()
    await outputDialog.getByText('19', { exact: true }).waitFor()
    await outputDialog.getByText(/Result set 1/).waitFor()
    await outputDialog.getByText('requested_id', { exact: true }).waitFor()
    await outputDialog.screenshot({ path: join(evidence, `debugger-output-parameters-${suffixTheme}.png`) })
    await chooseTheme('Dark')
    await outputDialog.screenshot({ path: join(evidence, 'debugger-output-parameters-dark.png') })
    await chooseTheme('Light')
    await outputDialog.getByRole('button', { name: 'Close' }).click()
    await page.locator('.menu-row summary').filter({ hasText: /^Database$/ }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: /^Security Manager/ }).click()
    const security = page.locator('.security-panel')
    await security.waitFor({ timeout: 20_000 })
    await security.getByRole('button', { name: 'Global Privileges', exact: true }).click()
    await security.getByRole('row', { name: /BACKUP_ADMIN/ }).scrollIntoViewIfNeeded()
    await security.screenshot({ path: join(evidence, `security-dynamic-privileges-${suffixTheme}.png`) })
    await chooseTheme('Dark')
    await security.screenshot({ path: join(evidence, 'security-dynamic-privileges-dark.png') })
    await page.locator('.panel-dialog-close').click().catch(() => undefined)
  }
  console.log('Saved debugger and dynamic privilege evidence in light and dark themes.')
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
  }
  await admin.query("UPDATE tuxsql_linux_debug.debug_sessions SET status='error' WHERE database_name=? AND status IN ('preparing','running','paused')", [database]).catch(() => undefined)
  await admin.query('DELETE FROM tuxsql_linux_debug.routine_sources WHERE database_name=?', [database]).catch(() => undefined)
  if (madeDb) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end()
  await rm(temp, { recursive: true, force: true })
}
