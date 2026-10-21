import { Writable } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { exportData, importData } from '../../src/modules/data-export-import/index.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('data import/export MySQL integration', () => {
  const driver = new MysqlDriver()
  const suffix = `${process.pid}_${Date.now()}`
  const database = `imex_test_${suffix}`
  const table = `imex_${suffix}`
  let connectionId = ''

  afterAll(async () => {
    if (!connectionId) return
    await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``)
    await driver.disconnect(connectionId)
  })

  it('imports and streams 100k rows without collecting the export in memory', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection('imex-integration', 'Import/export integration'),
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
  }, 180_000)
})
