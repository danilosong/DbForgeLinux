/* global process, console, setTimeout, clearTimeout, window */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

const electronPath = join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-smoke-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
try {
  await admin.query("CREATE USER IF NOT EXISTS 'dbforge_smoke'@'%' IDENTIFIED BY ''")
  await admin.query('GRANT ALL PRIVILEGES ON sample.* TO `dbforge_smoke`@`%`')
  app = await electron.launch({
    executablePath: electronPath,
    args: [],
    timeout: 90_000,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  const page = await app.firstWindow()
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Smoke MySQL 33067')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('dbforge_smoke')
  await page.getByRole('textbox', { name: 'Database' }).fill('sample')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  const scalar = await page.evaluate(async () => {
    const record = (await window.dbforge.getConnections()).find((item) => item.name === 'Smoke MySQL 33067')
    if (!record) throw new Error('Smoke connection was not saved.')
    const connection = await window.dbforge.connect(record)
    try {
      const results = await window.dbforge.executeSql(connection.id, 'SELECT 1 AS smoke')
      const result = results[0]
      const rows = result?.resultStoreId ? await window.dbforge.readResultRows(result.resultStoreId, 0, 1) : result?.rows ?? []
      if (result?.resultStoreId) await window.dbforge.disposeResult(result.resultStoreId)
      return rows[0]?.smoke
    } finally { await window.dbforge.disconnect(connection.id) }
  })
  if (Number(scalar) !== 1) throw new Error(`SELECT 1 returned ${String(scalar)}.`)

  await page.getByRole('heading', { name: 'Recent Connections' }).waitFor()
  await page.locator('.start-page .start-recent-list').first().getByRole('button', { name: /Smoke MySQL 33067/ }).waitFor()
  const recentSqlPath = join(dataRoot, 'recent-e2e.sql')
  await writeFile(recentSqlPath, 'SELECT 1 AS recent_file;\n', 'utf8')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, recentSqlPath)
  await page.getByRole('button', { name: 'Open SQL File…' }).click()
  await page.getByText('SELECT 1 AS recent_file;', { exact: true }).waitFor()
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.locator('.grid-result').waitFor()
  await page.locator('.grid-result tbody tr td').filter({ hasText: /^1$/ }).first().waitFor()
  await page.getByRole('tab', { name: 'Start Page' }).click()
  const recentFile = page.locator('.start-page').getByRole('button', { name: /recent-e2e\.sql/ })
  await recentFile.waitFor()
  await recentFile.click()
  await page.getByText('SELECT 1 AS recent_file;', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Start Page' }).click()
  await page.getByRole('button', { name: 'New SQL', exact: true }).click()
  await page.getByRole('tab', { name: /SQL/ }).last().waitFor()

  const tools = page.locator('summary').filter({ hasText: 'Tools' })
  await tools.click()
  await page.getByRole('button', { name: /Find Object \/ Invalid Objects/ }).click()
  await page.locator('.database-tools-panel').waitFor()
  await page.locator('.panel-dialog-close').click()
  await tools.click()
  await page.getByRole('button', { name: /er-diagram/ }).click()
  await page.locator('.er-panel').waitFor()
  await page.locator('.panel-dialog-close').click()
  await tools.click()
  await page.getByRole('button', { name: 'Options…' }).click()
  await page.locator('.options-panel').waitFor()
  console.log('Smoke e2e passed: MySQL connection, recent SQL open/reopen, UI SQL execution/result grid, new SQL, Database Tools, ER Diagram, Options.')
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
  await admin.query("DROP USER IF EXISTS 'dbforge_smoke'@'%'")
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
