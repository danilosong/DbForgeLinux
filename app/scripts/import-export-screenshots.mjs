/* global process, console, setTimeout, clearTimeout */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import mysql from 'mysql2/promise'
import { _electron as electron } from 'playwright'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const testPrefix = mysqlTestPrefix('import_export_ui')
const database = testPrefix
const table = `${testPrefix}_items`
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-imex-ui-'))
const importSourcePath = join(dataRoot, 'import-source.csv')
const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
let app
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  await admin.query(`CREATE TABLE \`${database}\`.\`${table}\` (id INT PRIMARY KEY, label VARCHAR(80) NOT NULL)`)
  await admin.query(`INSERT INTO \`${database}\`.\`${table}\` VALUES (1, 'temporary evidence data')`)
  await writeFile(importSourcePath, 'id,label\n1,Ada\n2,Lin\n', { mode: 0o600 })
  const executablePath = process.env.TUXSQL_APP_BIN ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
  app = await electron.launch({
    executablePath, args: [], cwd: process.cwd(), timeout: 90_000,
    env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TUXSQL_SCREENSHOT_IMPORT_SOURCE: importSourcePath, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  await page.getByLabel('Connection name').fill('Disposable Import Export')
  await page.getByLabel('Host').fill(process.env.MYSQL_HOST ?? '127.0.0.1')
  await page.getByLabel('Port').fill(process.env.MYSQL_PORT ?? '33067')
  await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.locator('#connection-database').selectOption(database, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  const connectionNode = page.locator('.node-name').filter({ hasText: 'Disposable Import Export' })
  await connectionNode.waitFor({ timeout: 20_000 })
  await connectionNode.click()
  const databaseNode = page.locator('.database-name').filter({ hasText: database })
  await databaseNode.waitFor({ timeout: 20_000 })
  await databaseNode.locator('span').click()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  const tableNode = page.locator('.object-name').filter({ hasText: table })
  await tableNode.waitFor({ timeout: 20_000 })
  const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
  await mkdir(evidenceDirectory, { recursive: true })
  for (const theme of ['Light', 'Dark']) {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    await page.getByRole('button', { name: `Theme: ${theme}`, exact: true }).click()
    await page.locator('.workbench').waitFor()
    await tableNode.click({ button: 'right' })
    const menu = page.locator('.explorer-context-menu')
    await menu.waitFor()
    await menu.getByRole('menuitem', { name: /Export Data/ }).click()
    await page.locator('.io-wizard').waitFor()
    await page.screenshot({ path: join(evidenceDirectory, `import-export-format-${theme.toLowerCase()}.png`) })
    await page.screenshot({ path: join(evidenceDirectory, `import-export-${theme.toLowerCase()}.png`) })
    await page.getByRole('button', { name: /^CSV/ }).click()
    await page.locator('.io-footer button.button-primary').click()
    await page.locator('.io-source-list').waitFor()
    await page.screenshot({ path: join(evidenceDirectory, `import-export-source-${theme.toLowerCase()}.png`) })
    await page.locator('.io-footer button.button-primary').click()
    await page.getByLabel('Delete older exports').check()
    await page.getByLabel('Compress output as Zip').check()
    await page.getByLabel('Zip password').waitFor()
    await page.getByLabel('Older than days').waitFor()
    await page.screenshot({ path: join(evidenceDirectory, `import-export-zip-${theme.toLowerCase()}.png`) })
    await page.locator('.panel-dialog-backdrop .panel-dialog-close').click()
    await tableNode.click({ button: 'right' })
    await page.locator('.explorer-context-menu').getByRole('menuitem', { name: /Import Data/ }).click()
    await page.locator('.io-wizard').waitFor()
    await page.locator('.io-toolbar select').filter({ has: page.locator('option[value="import"]') }).selectOption('import')
    await page.screenshot({ path: join(evidenceDirectory, `import-new-table-source-${theme.toLowerCase()}.png`) })
    await app.evaluate(() => {
      const createRequire = process.getBuiltinModule('node:module').createRequire
      const electron = createRequire(`${process.cwd()}/package.json`)('electron')
      const sourcePath = process.env.TUXSQL_SCREENSHOT_IMPORT_SOURCE
      electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [sourcePath] })
    })
    await page.getByRole('button', { name: 'Browse…' }).click()
    const nextButton = page.locator('.io-footer').getByRole('button', { name: /Next/ })
    if (!await nextButton.isEnabled()) throw new Error('Selecting the source file did not enable Next')
    await page.screenshot({ path: join(evidenceDirectory, `import-source-selected-${theme.toLowerCase()}.png`) })
    await nextButton.click()
    await page.screenshot({ path: join(evidenceDirectory, `import-destination-${theme.toLowerCase()}.png`) })
    await nextButton.click()
    await page.screenshot({ path: join(evidenceDirectory, `import-options-${theme.toLowerCase()}.png`) })
    await nextButton.click()
    await page.screenshot({ path: join(evidenceDirectory, `import-data-formats-${theme.toLowerCase()}.png`) })
    for (let step = 0; step < 4; step++) await nextButton.click()
    const activeStep = await page.locator('.io-stepper button[aria-current=step]').innerText()
    if (!activeStep.includes('Errors handling')) throw new Error(`Expected Errors handling, reached ${activeStep}`)
    await page.screenshot({ path: join(evidenceDirectory, `import-errors-handling-${theme.toLowerCase()}.png`) })
    await page.locator('.panel-dialog-backdrop .panel-dialog-close').click()
  }
  console.log(`Import/export screenshots saved in ${evidenceDirectory}`)
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
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
