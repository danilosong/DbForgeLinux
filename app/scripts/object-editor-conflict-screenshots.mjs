/* global process, console, setTimeout, clearTimeout, document */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-object-conflict-'))
const evidenceRoot = join(process.cwd(), '..', 'document', 'evidence', 'ui', '03-table-designer')
const database = mysqlTestPrefix('external_change')
const table = `${database}_items`
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
try {
  await admin.query(`CREATE DATABASE \`${database}\``)
  await admin.query(`CREATE TABLE \`${database}\`.\`${table}\` (id INT PRIMARY KEY, label VARCHAR(40))`)
  app = await electron.launch({ executablePath: join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql'), args: [], env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(15_000)
  await page.locator('.workbench').waitFor()
  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  const connection = page.getByRole('dialog', { name: 'Database Connection Properties' })
  await page.getByLabel('Connection name').fill('External Change Evidence')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
  await connection.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected\. Server version:/).waitFor()
  await page.getByLabel('Database', { exact: true }).selectOption(database)
  await connection.getByRole('button', { name: 'Connect', exact: true }).click()
  await connection.waitFor({ state: 'detached' })
  const connectionNode = page.locator('.node-name').filter({ hasText: 'External Change Evidence' })
  await connectionNode.waitFor()
  await connectionNode.click()
  const databaseNode = page.locator('.database-name').filter({ hasText: database })
  await databaseNode.locator('span').click()
  await page.locator('.object-group-name').filter({ hasText: 'Tables' }).click()
  const tableNode = page.locator('.object-name').filter({ hasText: table })
  await tableNode.click({ button: 'right' })
  await page.locator('.explorer-context-menu').getByRole('menuitem', { name: 'Open Editor', exact: true }).click()
  const editor = page.locator('.object-editor')
  await editor.waitFor()
  await admin.query(`ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN outside_edit INT NULL`)
  await editor.getByRole('button', { name: 'Apply Changes' }).click()
  const conflict = page.getByRole('dialog', { name: 'Object changed outside the editor' })
  await conflict.waitFor()
  assert.match(await conflict.innerText(), /Reload the latest version|continue with this draft/i)
  await mkdir(evidenceRoot, { recursive: true })
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await page.screenshot({ path: join(evidenceRoot, `external-change-before-apply-${theme}.png`) })
  }
  await conflict.getByRole('button', { name: 'Reload latest definition' }).click()
  await editor.getByRole('textbox', { name: 'Column 3 name' }).waitFor()
  assert.equal(await editor.getByRole('textbox', { name: 'Column 3 name' }).inputValue(), 'outside_edit')
  console.log(`External object change evidence saved to ${evidenceRoot}`)
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
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
