/* global process, console, setTimeout, clearTimeout */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix, mysqlTestUser } from './mysql-test-prefix.mjs'

const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-editor-designer-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const sqlEvidence = join(evidenceRoot, '04-sql-editor')
const tableEvidence = join(evidenceRoot, '03-table-designer')
const shellEvidence = join(evidenceRoot, '01-shell')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
const database = mysqlTestPrefix('editor_designer_ui')
const tableName = `${database}_customers`
const dbUser = mysqlTestUser('editor_designer_ui')
let app
try {
  await mkdir(sqlEvidence, { recursive: true })
  await mkdir(tableEvidence, { recursive: true })
  await mkdir(shellEvidence, { recursive: true })
  await admin.query(`CREATE DATABASE \`${database}\``)
  await admin.query(`CREATE USER '${dbUser}'@'%' IDENTIFIED BY ''`)
  await admin.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${dbUser}'@'%'`)
  await admin.query(`CREATE TABLE \`${database}\`.\`${tableName}\` (id INT PRIMARY KEY AUTO_INCREMENT, customer_name VARCHAR(80) NOT NULL, note VARCHAR(100) NULL) ENGINE=InnoDB`)
  await admin.query(`INSERT INTO \`${database}\`.\`${tableName}\` (customer_name, note) VALUES ('Ada', NULL)`)
  app = await electron.launch({ executablePath: join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux'), args: [], env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  page.on('console', (message) => console.log(`[renderer] ${message.type()}: ${message.text()}`))
  console.log('App opened; creating temporary MySQL connection.')
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Martelo UI MySQL')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill(dbUser)
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByLabel('Database', { exact: true }).selectOption(database)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30000 })
  console.log('Connection active.')
  const chooseTheme = async (theme) => {
    const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
    if (await later.count()) await later.click().catch(() => undefined)
    const dialogClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
    if (await dialogClose.count()) await dialogClose.click().catch(() => undefined)
    await page.keyboard.press('Escape').catch(() => undefined)
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await page.locator('html').getAttribute('data-theme')) === theme.toLowerCase()) return
      await page.locator('button[title="Auto theme"]').click()
    }
  }
  const capture = async (path) => {
    const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
    if (await later.count()) await later.click().catch(() => undefined)
    const close = page.locator('.panel-dialog-backdrop .panel-dialog-close')
    if (await close.count()) await close.click().catch(() => undefined)
    await page.screenshot({ path })
  }
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await page.locator('.node-line').filter({ hasText: 'Martelo UI MySQL' }).click({ button: 'right' })
    await page.screenshot({ path: join(shellEvidence, `explorer-server-menu-${theme.toLowerCase()}.png`) })
    await page.locator('.document-tabs').click({ position: { x: 700, y: 5 } })
  }
  await page.locator('.node-line').filter({ hasText: 'Martelo UI MySQL' }).click({ button: 'right' })
  await page.locator('.explorer-context-menu').getByRole('menuitem', { name: 'New Database' }).click()
  await page.locator('.database-create-editor').waitFor()
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await capture(join(shellEvidence, `new-database-editor-${theme.toLowerCase()}.png`))
    await page.locator('.document-tab').filter({ hasText: 'New Database' }).click({ button: 'right' })
    await page.screenshot({ path: join(shellEvidence, `document-tab-menu-${theme.toLowerCase()}.png`) })
    await page.locator('.document-tabs').click({ position: { x: 700, y: 5 } })
  }
  await page.locator('.document-tab').filter({ hasText: 'New Database' }).locator('.tab-close').click()
  await page.keyboard.press('Control+n')
  const editor = page.locator('.monaco-editor').last()
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await editor.click({ position: { x: 300, y: 14 } })
    await page.keyboard.press('Control+a')
    await page.keyboard.insertText('SELECT * FROM cus')
    await page.keyboard.press('Control+Space')
    await page.locator('.suggest-widget').waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(600)
    await capture(join(sqlEvidence, `editor-completion-${theme.toLowerCase()}.png`))
    await page.keyboard.press('Escape')
    await editor.click({ position: { x: 300, y: 14 }, button: 'right' })
    await page.locator('.sql-editor-context').waitFor({ state: 'visible' })
    await page.getByRole('menuitem', { name: 'Execute To Cursor' }).waitFor({ state: 'visible' })
    await page.screenshot({ path: join(sqlEvidence, `editor-context-${theme.toLowerCase()}.png`) })
    await page.keyboard.press('Escape')
  }
  console.log('Autocomplete and editor context menus captured.')
  await page.keyboard.press('Escape')
  await page.locator('.node-name').filter({ hasText: 'Martelo UI MySQL' }).click()
  const db = page.locator('.database-name').filter({ hasText: database }).first()
  await db.locator('span').click()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  await page.locator('.object-name').filter({ hasText: tableName }).click({ button: 'right' })
  await page.locator('.explorer-context-menu').getByRole('menuitem').nth(1).click()
  await page.locator('.object-editor').waitFor()
  console.log('Table Designer opened:', await page.locator('.object-editor-toolbar strong').innerText())
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await capture(join(tableEvidence, `table-designer-${theme.toLowerCase()}.png`))
  }
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  await page.getByRole('button', { name: /Refresh data|Atualizar dados/ }).click()
  await page.locator('.result-grid').waitFor({ timeout: 30000 })
  console.log('Table Data loaded.')
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(theme)
    await capture(join(tableEvidence, `table-data-${theme.toLowerCase()}.png`))
  }
  console.log(`Editor and Table Designer screenshots saved under ${evidenceRoot}`)
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
  await admin.query(`DROP USER IF EXISTS '${dbUser}'@'%'`).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
