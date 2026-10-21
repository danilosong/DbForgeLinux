import { Writable } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { exportData, importData } from '../../src/modules/data-export-import/index.js'
import { buildCreateTableSql, inferImportColumns } from '../../src/modules/data-export-import/inference.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('data import/export MySQL integration', () => {
  const driver = new MysqlDriver()
  const prefix = mysqlTestPrefix('import_export')
  const database = prefix
  const table = `${prefix}_rows`
  let connectionId = ''

  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``) } finally { await driver.disconnect(connectionId) }
  })

  it('imports and streams 100k rows without collecting the export in memory', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection(mysqlTestPrefix('connection'), 'Import/export integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067),
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? 'integration-only'
    })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${database}\`.\`${table}\` (id INT PRIMARY KEY, value VARCHAR(80), nullable_value VARCHAR(20) NULL)`)
    async function* csvRows(): AsyncIterable<Buffer> {
      yield Buffer.from('id,value,nullable_value\n')
      for (let id = 1; id <= 100_000; id++) yield Buffer.from(`${id},row-${id},${id % 2 ? '' : 'value'}\n`)
    }
    const imported = await importData({
      driver, connectionId, source: csvRows(), format: 'csv', table: `${database}.${table}`,
      options: { batchSize: 500, transactional: true }
    })
    expect(imported).toMatchObject({ read: 100_000, inserted: 100_000, errors: 0 })

    let outputBytes = 0
    const destination = new Writable({ write(chunk: Buffer, _encoding, callback) { outputBytes += chunk.length; callback() } })
    const exported = await exportData({
      driver, connectionId, query: `SELECT id, value, nullable_value FROM \`${database}\`.\`${table}\` ORDER BY id`,
      destination, format: 'csv'
    })
    expect(exported.rows).toBe(100_000)
    expect(outputBytes).toBe(exported.bytes)
    let total = 0
    for await (const row of driver.streamRows(connectionId, `SELECT COUNT(*) AS total FROM \`${database}\`.\`${table}\``)) total = Number(row.total)
    expect(total).toBe(100_000)

    const previewRows = [{ id: '1', label: 'naïve' }, { id: '2', label: '雪' }]
    const columns = inferImportColumns(['id', 'label'], previewRows)
    columns[0]!.primaryKey = true
    const importedTable = `${table}_new`
    await driver.executeSql(connectionId, buildCreateTableSql(database, importedTable, columns), undefined, database)
    const createdImport = await importData({
      driver, connectionId, source: (async function* () { yield Buffer.from('id,label\n1,naïve\n2,雪\n') })(),
      format: 'csv', table: `${database}.${importedTable}`, options: { transactional: true }
    })
    expect(createdImport).toMatchObject({ read: 2, inserted: 2, errors: 0 })
    let tableCollation = ''
    for await (const row of driver.streamRows(connectionId, `SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA='${database}' AND TABLE_NAME='${importedTable}'`)) tableCollation = String(row.TABLE_COLLATION)
    expect(tableCollation).toMatch(/^utf8mb4_/)
  }, 180_000)
})
