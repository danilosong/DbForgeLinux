/* global process, console, setTimeout, clearTimeout, window, crypto */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'

const electronPath = join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-risk-'))
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only', multipleStatements: true })
let app
let connectionId = ''
let riskUser = ''
const suffix = `${process.pid}_${Date.now()}`
const csvPath = join(dataRoot, 'hundred-thousand.csv')
const sqlPath = join(dataRoot, 'risk-open.sql')
const savePath = join(dataRoot, 'risk-save.sql')
const tableSqlPath = join(dataRoot, 'table-data.sql')

async function waitForProcess(queryPrefix) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const [rows] = await admin.query('SELECT ID FROM information_schema.PROCESSLIST WHERE INFO LIKE ?', [`${queryPrefix}%`])
    if (rows[0]) return Number(rows[0].ID)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`MySQL query did not start: ${queryPrefix}`)
}

try {
  await admin.query("DROP USER IF EXISTS 'dbforge_smoke'@'%'; CREATE USER 'dbforge_smoke'@'%' IDENTIFIED BY ''")
  await admin.query('GRANT ALL PRIVILEGES ON sample.* TO `dbforge_smoke`@`%`')
  await admin.query("GRANT CREATE USER ON *.* TO 'dbforge_smoke'@'%'; GRANT SELECT ON mysql.* TO 'dbforge_smoke'@'%'")
  await admin.query(`CREATE TABLE IF NOT EXISTS sample.qa_tx_${suffix} (id INT PRIMARY KEY, value VARCHAR(80)) ENGINE=InnoDB`)
  await admin.query(`CREATE TABLE IF NOT EXISTS sample.qa_compare_src_${suffix} (id INT PRIMARY KEY, value VARCHAR(80)); CREATE TABLE IF NOT EXISTS sample.qa_compare_dst_${suffix} (id INT PRIMARY KEY, value VARCHAR(80)); INSERT INTO sample.qa_compare_src_${suffix} VALUES (1,'new'),(2,'source'); INSERT INTO sample.qa_compare_dst_${suffix} VALUES (1,'old'),(3,'target')`)
  await admin.query(`CREATE TABLE sample.qa_csv_${suffix} (id INT PRIMARY KEY, value VARCHAR(80)) ENGINE=InnoDB`)
  await writeFile(sqlPath, 'SELECT 71 AS opened;\n', 'utf8')
  await writeFile(csvPath, 'id,value\n' + Array.from({ length: 100_000 }, (_, index) => `${index + 1},row-${index + 1}`).join('\n') + '\n', 'utf8')

  app = await electron.launch({
    executablePath: electronPath,
    timeout: 90_000,
    env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  const page = await app.firstWindow()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Risk QA MySQL')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill('dbforge_smoke')
  await page.getByRole('textbox', { name: 'Database' }).fill('sample')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  await app.evaluate(({ dialog }, savePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: savePath }) }, savePath)
  await app.evaluate(({ dialog }, csvPath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [csvPath] }) }, csvPath)
  const outcome = await page.evaluate(async ({ suffix, sqlPath }) => {
    const api = window.dbforge
    const record = (await api.getConnections()).find((item) => item.name === 'Risk QA MySQL')
    if (!record) throw new Error('QA connection was not persisted')
    const connected = await api.connect(record)
    const outcomes = {}
    try {
      // Manual transaction: explicit rollback and commit both survive reconnects.
      await api.executeSql(connected.id, `DELETE FROM sample.qa_tx_${suffix}`)
      await api.beginTransaction(connected.id)
      await api.executeSql(connected.id, `INSERT INTO sample.qa_tx_${suffix} VALUES (1,'rollback')`)
      const pendingCount = (await api.executeSql(connected.id, `SELECT COUNT(*) AS n FROM sample.qa_tx_${suffix}`))[0]
      const pendingRows = pendingCount.resultStoreId ? await api.readResultRows(pendingCount.resultStoreId, 0, 1) : pendingCount.rows
      if (pendingCount.resultStoreId) await api.disposeResult(pendingCount.resultStoreId)
      outcomes.pendingTransactionRows = Number(pendingRows[0]?.n)
      await api.rollbackTransaction(connected.id)
      outcomes.rollbackRows = (await api.executeSql(connected.id, `SELECT COUNT(*) AS n FROM sample.qa_tx_${suffix} LIMIT 1`))[0].rows[0].n
      await api.beginTransaction(connected.id)
      await api.executeSql(connected.id, `INSERT INTO sample.qa_tx_${suffix} VALUES (2,'commit')`)
      await api.commitTransaction(connected.id)
      outcomes.commitRows = (await api.executeSql(connected.id, `SELECT id FROM sample.qa_tx_${suffix} LIMIT 10`))[0].rows.map((row) => Number(row.id))

      // Long streaming query cancellation must reject and leave the pool usable.
      const cancelId = crypto.randomUUID()
      const sleeping = api.executeSql(connected.id, 'SELECT SLEEP(30) AS sleeping', cancelId).then(() => 'resolved', (error) => error.name)
      await new Promise((resolve) => setTimeout(resolve, 500))
      await api.cancelQuery(connected.id, cancelId)
      outcomes.cancel = await Promise.race([sleeping, new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000))])
      outcomes.afterCancel = (await api.executeSql(connected.id, 'SELECT 1 AS alive LIMIT 1'))[0].rows[0].alive

      // Force a real server-side connection loss in the middle of a query.
      window.__qaConnectionId = connected.id
      outcomes.fileOpen = await api.openSqlPath(sqlPath)
      outcomes.fileSaved = await api.saveSqlFile(undefined, 'SELECT 72 AS saved;')

      const multi = await api.executeSql(connected.id, 'SELECT 101 AS first_result; SELECT 202 AS second_result;')
      outcomes.multiResults = multi.map((result) => result.rows[0] && Number(Object.values(result.rows[0])[0]))

      // Table Designer IPC: create and alter a real InnoDB table.
      const tableName = `qa_designer_${suffix}`
      const table = { kind: 'table', name: tableName, columns: [{ name: 'id', type: 'INT', nullable: false, autoIncrement: true }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: [], engine: 'InnoDB', charset: 'utf8mb4' }
      outcomes.createdDdl = await api.applyTableEditor(connected.id, 'sample', null, table)
      const original = await api.loadObjectEditor({ connectionId: connected.id, database: 'sample', kind: 'table', name: tableName })
      const modified = { ...original, columns: [...original.columns, { name: 'label', type: 'VARCHAR(100)', nullable: true }] }
      outcomes.alteredDdl = await api.applyTableEditor(connected.id, 'sample', original, modified)

      // Data Compare uses parameterized statements and requires a second compare to be empty.
      const sourceTable = `qa_compare_src_${suffix}`; const targetTable = `qa_compare_dst_${suffix}`
      const before = await api.compareData(connected.id, 'sample', sourceTable, connected.id, 'sample', targetTable, ['id'], ['id', 'value'])
      outcomes.compareBefore = before.report
      const synced = await api.synchronizeData(connected.id, 'sample', sourceTable, connected.id, 'sample', targetTable, ['id'], ['id', 'value'], true, true)
      outcomes.sync = synced
      outcomes.compareAfter = (await api.compareData(connected.id, 'sample', sourceTable, connected.id, 'sample', targetTable, ['id'], ['id', 'value'])).report

      // Security Manager IPC create/drop. Use no password for the disposable account.
      const user = `qa_risk_${Date.now()}`
      outcomes.securityCreate = await api.applySecurityChanges(connected.id, [{ kind: 'createUser', account: { user, host: '%' }, password: '' }], true)
      outcomes.securityCreated = (await api.listSecurityAccounts(connected.id)).some((account) => account.user === user && account.host === '%')
      outcomes.securityDrop = await api.applySecurityChanges(connected.id, [{ kind: 'dropUser', account: { user, host: '%' } }], true)
      outcomes.securityDropped = !(await api.listSecurityAccounts(connected.id)).some((account) => account.user === user && account.host === '%')

      // Import wizard source selection plus its 100k row transactional import.
      const jobId = crypto.randomUUID()
      outcomes.csvPreview = await api.selectImportSource(jobId, 'csv', { delimiter: ',', quote: '"', header: true, encoding: 'utf8' })
      outcomes.csvImport = await api.importData(connected.id, `sample.qa_csv_${suffix}`, 'csv', 'append', [], { delimiter: ',', quote: '"', header: true, encoding: 'utf8', onRowError: 'abort' }, jobId)
      outcomes.csvCount = (await api.executeSql(connected.id, `SELECT COUNT(*) AS n FROM sample.qa_csv_${suffix} LIMIT 1`))[0].rows[0].n
    } finally { /* Keep the connection alive for the server-side disconnect scenario below. */ }
    return outcomes
  }, { suffix, sqlPath })
  const [uncanceledSleep] = await admin.query("SELECT ID FROM information_schema.PROCESSLIST WHERE INFO = 'SELECT SLEEP(30) AS sleeping'")
  if (uncanceledSleep.length) throw new Error('Canceled SLEEP query is still running on the MySQL server')

  const lostExecutionId = await page.evaluate(async () => {
    const id = crypto.randomUUID()
    window.__qaLostPromise = window.dbforge.executeSql(window.__qaConnectionId, 'SELECT SLEEP(30) AS lost LIMIT 1', id).then(() => 'resolved', (error) => error.code ?? error.message)
    return id
  })
  const threadId = await waitForProcess('SELECT SLEEP(30) AS lost')
  await admin.query(`KILL CONNECTION ${threadId}`)
  outcome.lostResult = await page.evaluate(async () => await window.__qaLostPromise)
  outcome.lostExecutionId = lostExecutionId
  outcome.reconnectAfterLoss = await page.evaluate(async () => {
    const record = (await window.dbforge.getConnections()).find((item) => item.name === 'Risk QA MySQL')
    if (!record) return false
    const recovered = await window.dbforge.connect(record)
    try { return Number((await window.dbforge.executeSql(recovered.id, 'SELECT 1 AS recovered LIMIT 1'))[0].rows[0].recovered) }
    finally { await window.dbforge.disconnect(recovered.id) }
  })
  await page.evaluate(async () => await window.dbforge.disconnect(window.__qaConnectionId))

  // Exercise visible SQL tabs and results through the UI.
  await page.getByRole('button', { name: 'New SQL', exact: true }).click()
  await page.getByRole('tab', { name: /SQL/ }).last().waitFor()
  const multiPath = join(dataRoot, 'multi.sql')
  await writeFile(multiPath, 'SELECT 303 AS visible_one; SELECT 404 AS visible_two;\n', 'utf8')
  await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, multiPath)
  await page.locator('summary').filter({ hasText: 'File' }).click()
  await page.getByRole('button', { name: 'Open SQL File…' }).click()
  await page.getByText('SELECT 303 AS visible_one; SELECT 404 AS visible_two;', { exact: true }).waitFor()
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.getByRole('tab', { name: /Result 1 \(1\)/ }).waitFor({ timeout: 30_000 })
  await page.getByRole('tab', { name: /Result 2 \(1\)/ }).waitFor({ timeout: 30_000 })

  // Table Data editing stays virtualized and posts parameterized keyed edits.
  const tableSql = `SELECT * FROM sample.qa_tx_${suffix} LIMIT 100;`
  await writeFile(tableSqlPath, tableSql, 'utf8')
  await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, tableSqlPath)
  await page.locator('summary').filter({ hasText: 'File' }).click()
  await page.getByRole('button', { name: 'Open SQL File…' }).click()
  await page.getByText(tableSql, { exact: true }).waitFor()
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.getByRole('tab', { name: /Result 1/ }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Insert Row' }).waitFor({ timeout: 30_000 })
  const gridRows = page.locator('.result-grid tbody tr:not(.grid-spacer)')
  await gridRows.first().locator('td').nth(2).dblclick()
  await page.getByRole('textbox', { name: 'Edit value' }).fill('edited-inline')
  await page.getByRole('textbox', { name: 'Edit value' }).press('Enter')
  await expectPending(page)
  const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
  await mkdir(evidence, { recursive: true })
  await page.locator('.grid-edit-toolbar').getByRole('button', { name: 'Preview SQL' }).click()
  await page.getByRole('dialog', { name: 'Pending SQL preview' }).waitFor()
  await page.getByRole('button', { name: 'Close preview' }).click()
  await page.screenshot({ path: join(evidence, 'table-data-grid-edit-light.png'), fullPage: false })
  await page.locator('summary').filter({ hasText: 'View' }).click()
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.screenshot({ path: join(evidence, 'table-data-grid-edit-dark.png'), fullPage: false })
  await page.locator('.grid-edit-toolbar').getByRole('button', { name: 'Post / Apply' }).click()
  await page.getByRole('button', { name: 'OK' }).waitFor({ state: 'detached', timeout: 1000 }).catch(() => undefined)
  await page.locator('summary').filter({ hasText: 'View' }).click()
  await page.getByRole('button', { name: 'Light' }).click()
  await page.getByRole('button', { name: 'Insert Row' }).click()
  const insertedRow = page.locator('.grid-row-inserted').last()
  await insertedRow.locator('td').nth(1).dblclick()
  await page.getByRole('textbox', { name: 'New id' }).fill('3')
  await page.getByRole('textbox', { name: 'New id' }).press('Enter')
  await insertedRow.locator('td').nth(2).dblclick()
  await page.getByRole('textbox', { name: 'New value' }).fill('inserted-inline')
  await page.getByRole('textbox', { name: 'New value' }).press('Enter')
  await page.locator('.grid-edit-toolbar').getByRole('button', { name: 'Post / Apply' }).click()
  await page.getByText(/1 inserted/).waitFor({ timeout: 15_000 })
  const [insertedCheck] = await admin.query(`SELECT id FROM sample.qa_tx_${suffix} WHERE id = 3`)
  if (!insertedCheck.length) throw new Error('Inline grid insert did not post')
  const inserted = page.locator('.result-grid tbody tr').filter({ hasText: 'inserted-inline' }).last()
  await inserted.locator('td').first().click()
  await page.getByRole('button', { name: 'Delete Row' }).click()
  await page.locator('.grid-edit-toolbar').getByRole('button', { name: 'Post / Apply' }).click()
  await page.getByText(/1 deleted/).waitFor({ timeout: 15_000 })

  await page.locator('summary').filter({ hasText: 'File' }).click()
  await page.getByRole('button', { name: /Save SQL/ }).click()
  if ((await readFile(multiPath, 'utf8')).trim() !== 'SELECT 303 AS visible_one; SELECT 404 AS visible_two;') throw new Error('UI Save SQL did not preserve the opened document')

  const connectionNode = page.locator('.connection-node').filter({ hasText: 'Risk QA MySQL' })
  if (await connectionNode.getByRole('button', { name: 'Expandir conexão' }).count()) await connectionNode.getByRole('button', { name: 'Expandir conexão' }).click()
  const sampleDatabase = page.locator('.database-node').filter({ hasText: '◈ sample' })
  await sampleDatabase.locator('.database-name span').click()
  const tableGroup = sampleDatabase.locator('.object-group').filter({ has: page.locator('.object-group-name', { hasText: 'Tables' }) })
  await tableGroup.getByRole('button', { name: /Tables/ }).click()
  const designerTable = tableGroup.locator('.object-name').filter({ hasText: `qa_designer_${suffix}` })
  await designerTable.click({ button: 'right' })
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await page.locator('.object-editor').waitFor()
  await page.getByRole('button', { name: 'Add Column' }).click()
  await page.getByLabel(/Column 3 name/).fill('ui_added')
  await page.locator('.object-editor-toolbar').getByRole('button', { name: 'Apply Changes' }).click()
  await page.getByText(new RegExp(`Tabela qa_designer_${suffix} atualizada\\.`)).waitFor({ timeout: 30_000 })

  const toolsMenu = page.locator('summary').filter({ hasText: 'Tools' })
  await toolsMenu.click()
  await page.getByRole('button', { name: /security/i }).click()
  await page.locator('.security-panel').waitFor()
  const uiUser = `qa_ui_${suffix}`
  await page.locator('.security-panel').getByRole('button', { name: 'New User' }).click()
  await page.locator('.security-panel').getByLabel('User name').fill(uiUser)
  await page.locator('.security-panel').getByLabel('Host').fill('%')
  await page.locator('.security-panel').getByRole('textbox', { name: 'Password', exact: true }).fill('TemporaryRisk123!')
  await page.locator('.security-panel').getByRole('textbox', { name: 'Confirm password' }).fill('TemporaryRisk123!')
  await page.locator('.security-panel').getByRole('button', { name: 'Queue changes' }).click()
  await page.locator('.security-panel').getByRole('button', { name: /Apply Ctrl\+S/ }).click()
  await page.locator('.security-panel').getByRole('status').filter({ hasText: 'Changes applied successfully.' }).waitFor({ timeout: 30_000 })
  const uiAccount = page.locator('.security-users').getByRole('button', { name: new RegExp(`${uiUser}@%`) })
  await uiAccount.waitFor({ timeout: 30_000 })
  await uiAccount.click()
  await page.locator('.security-panel').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.locator('.security-panel').getByRole('button', { name: /Apply Ctrl\+S/ }).click()
  await uiAccount.waitFor({ state: 'detached', timeout: 30_000 })

  const savedStat = await stat(savePath)
  if ((savedStat.mode & 0o777) !== 0o600) throw new Error(`SQL save mode must be 0600, got ${(savedStat.mode & 0o777).toString(8)}`)
  if (Number(outcome.pendingTransactionRows) !== 1 || Number(outcome.rollbackRows) !== 0 || outcome.commitRows.length !== 1 || Number(outcome.afterCancel) !== 1) throw new Error(`Transaction/cancel regression: ${JSON.stringify(outcome)}`)
  if (!['AbortError', 'Error'].includes(outcome.cancel)) throw new Error(`Cancel returned ${outcome.cancel}`)
  if (outcome.lostResult === 'resolved' || outcome.reconnectAfterLoss !== 1) throw new Error(`Connection loss/reconnect mismatch: ${JSON.stringify(outcome)}`)
  if (outcome.multiResults.length !== 2 || outcome.multiResults[0] !== 101 || outcome.multiResults[1] !== 202) throw new Error(`Multiple statements mismatch: ${JSON.stringify(outcome.multiResults)}`)
  if (!outcome.createdDdl.length || !outcome.alteredDdl.length) throw new Error('Table Designer DDL was not applied')
  const [gridResult] = await admin.query(`SELECT value FROM sample.qa_tx_${suffix} WHERE id = 2`)
  if (gridResult[0]?.value !== 'edited-inline') throw new Error(`Inline grid edit did not post: ${JSON.stringify(gridResult)}`)
  const [deletedGridRows] = await admin.query(`SELECT id FROM sample.qa_tx_${suffix} WHERE id = 3`)
  if (deletedGridRows.length) throw new Error('Inline grid delete did not post')
  const screenshots = await Promise.all(['table-data-grid-edit-light.png', 'table-data-grid-edit-dark.png'].map((name) => stat(join(process.cwd(), '..', 'document', 'evidence', 'ui', name))))
  if (screenshots.some((item) => item.size < 10_000)) throw new Error('Grid edit screenshots were not captured')
  if (outcome.sync.failed !== 0 || Number(outcome.compareAfter.different) !== 0 || Number(outcome.compareAfter.sourceOnly) !== 0 || Number(outcome.compareAfter.targetOnly) !== 0) throw new Error(`Compare sync mismatch: ${JSON.stringify(outcome)}`)
  if (!outcome.securityCreated || !outcome.securityDropped) throw new Error('Security account create/drop failed')
  if (Number(outcome.csvImport.inserted) !== 100_000 || Number(outcome.csvCount) !== 100_000) throw new Error(`100k CSV import mismatch: ${JSON.stringify(outcome.csvImport)}`)
  console.log(`Risk QA passed: transactions, cancel/query recovery, connection kill, SQL file open/save, multi-result tabs, table apply, compare sync, Security Manager create/drop, CSV 100k. ${JSON.stringify({ cancel: outcome.cancel, lost: outcome.lostResult, importMs: outcome.csvImport.elapsedMs })}`)
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
  if (connectionId) await admin.query(`DROP USER IF EXISTS '${riskUser}'@'%'`).catch(() => undefined)
  const [temporaryAccounts] = await admin.query("SELECT User FROM mysql.user WHERE User LIKE 'qa_risk_%'").catch(() => [[]])
  for (const account of temporaryAccounts) await admin.query(`DROP USER IF EXISTS '${String(account.User).replaceAll("'", "''")}'@'%'`).catch(() => undefined)
  await admin.query(`DROP TABLE IF EXISTS sample.qa_tx_${suffix}, sample.qa_compare_src_${suffix}, sample.qa_compare_dst_${suffix}, sample.qa_designer_${suffix}, sample.qa_csv_${suffix}`).catch(() => undefined)
  await admin.query("DROP USER IF EXISTS 'dbforge_smoke'@'%'").catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}

async function expectPending(page) {
  await page.locator('.grid-row-updated').waitFor({ timeout: 10_000 })
  if (!(await page.locator('.grid-edit-toolbar').getByRole('button', { name: 'Post / Apply' }).isEnabled())) throw new Error('Grid did not mark the edit as pending')
}
