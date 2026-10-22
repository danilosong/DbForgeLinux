import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { mysqlTestPrefix } from './mysqlTestNames.js'
import { spoolLimitedRows } from '../src/modules/options/streamResult.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('MysqlDriver integration', () => {
  const driver = new MysqlDriver()
  const testPrefix = mysqlTestPrefix('mysql_driver')
  const database = testPrefix
  const itemsTable = `${testPrefix}_items`
  const transactionTable = `${testPrefix}_transaction_probe`
  let id: string
  const config = {
    ...createDefaultConnection(mysqlTestPrefix('connection'), 'Integration'),
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 33067),
    user: 'root',
    password: 'integration-only'
  }

  afterAll(async () => {
    if (!id) return
    try { await driver.executeSql(id, `DROP DATABASE IF EXISTS \`${database}\``) } finally { await driver.disconnect(id) }
  })

  it.skipIf(process.env.MYSQL_EXPECT_TLS_FALLBACK === '1')('connects with preferred TLS against the local server certificate', async () => {
    const result = await driver.testConnection({ ...config, ssl: { mode: 'preferred' } })
    expect(result.tlsVersion).toBeTruthy()
    expect(result.tlsVerified).toBe(false)
  })

  it.skipIf(process.env.MYSQL_EXPECT_TLS_FALLBACK === '1')('connects with required TLS without certificate verification', async () => {
    const result = await driver.testConnection({ ...config, ssl: { mode: 'required' } })
    expect(result.tlsVersion).toBeTruthy()
    expect(result.tlsVerified).toBe(false)
  })

  it.skipIf(process.env.MYSQL_EXPECT_TLS_FALLBACK === '1')('rejects an untrusted server certificate in verified TLS modes', async () => {
    await expect(driver.testConnection({ ...config, ssl: { mode: 'verify-identity' } })).rejects.toThrow()
    await expect(driver.testConnection({ ...config, ssl: { mode: 'verify-ca' } })).rejects.toThrow('A CA certificate is required')
  })

  it('testa conexão, lista databases/tabelas e retorna resultados múltiplos', async () => {
    const connectionTest = await driver.testConnection(config)
    expect(connectionTest.serverVersion).toBeTruthy()
    if (process.env.MYSQL_EXPECT_TLS_FALLBACK === '1') {
      expect(connectionTest.serverVersion).toMatch(/mariadb/i)
      expect(connectionTest.tlsVersion).toBeUndefined()
    } else {
      expect(connectionTest.tlsVersion).toBeTruthy()
    }
    id = await driver.connect(config)
    await driver.executeSql(id, `CREATE DATABASE \`${database}\`; CREATE TABLE \`${database}\`.\`${itemsTable}\` (id INT PRIMARY KEY, name VARCHAR(40)); INSERT INTO \`${database}\`.\`${itemsTable}\` VALUES (1, 'one');`)
    expect(await driver.listDatabases(id)).toContain(database)
    expect(await driver.listTables(id, database)).toContain(itemsTable)
    const objects = await driver.listDatabaseObjects(id, database)
    expect(objects).toContainEqual({ name: itemsTable, kind: 'table' })
    expect(await driver.showCreateObject(id, database, { name: itemsTable, kind: 'table' })).toContain('CREATE TABLE')
    await driver.setDatabase(id, database)
    const switchedDatabaseResult = await driver.executeSql(id, `SELECT * FROM \`${itemsTable}\``)
    expect(switchedDatabaseResult[0].rows[0]).toMatchObject({ id: 1, name: 'one' })
    const results = await driver.executeSql(id, `SELECT * FROM \`${database}\`.\`${itemsTable}\`; SELECT COUNT(*) AS total FROM \`${database}\`.\`${itemsTable}\`;`)
    expect(results).toHaveLength(2)
    expect(results[0].rows[0]).toMatchObject({ id: 1, name: 'one' })
    expect(results[1].rows[0]).toMatchObject({ total: 1 })
    await driver.executeSql(id, `CREATE TABLE \`${database}\`.\`${transactionTable}\` (id INT PRIMARY KEY)`)
    await driver.beginTransaction(id)
    await driver.executeSql(id, `INSERT INTO \`${transactionTable}\` (id) VALUES (1)`)
    await driver.rollbackTransaction(id)
    expect((await driver.executeSql(id, `SELECT COUNT(*) AS total FROM \`${database}\`.\`${transactionTable}\``))[0].rows[0]).toMatchObject({ total: 0 })

    const streamIterations = Number(process.env.MYSQL_STREAM_STRESS ?? 1)
    for (let iteration = 0; iteration < streamIterations; iteration++) {
      const streamed: Array<Record<string, unknown>> = []
      for await (const row of driver.streamRows(id, 'SELECT ? AS iteration', [iteration])) streamed.push(row)
      expect(streamed).toEqual([{ iteration }])
    }

    const previousConnectionId = id
    id = ''
    await driver.disconnect(previousConnectionId)
    id = await driver.connect(config)
    const afterReconnect: Array<Record<string, unknown>> = []
    for await (const row of driver.streamRows(id, 'SELECT 1 AS reconnected')) afterReconnect.push(row)
    expect(afterReconnect).toEqual([{ reconnected: 1 }])
  })

  it('cancels a timed out query and keeps the pooled connection usable', async () => {
    const id = await driver.connect(config)
    try {
      async function* sleepingRows(): AsyncIterable<Record<string, unknown>> { yield* driver.streamRows(id, 'SELECT SLEEP(5) AS slept', [], undefined, 1) }
      await expect(spoolLimitedRows(sleepingRows(), 10, async () => undefined)).rejects.toThrow('Query cancelled after 1 s (command timeout)')
      expect((await driver.executeSql(id, 'SELECT 42 AS answer'))[0]?.rows[0]).toMatchObject({ answer: 42 })
    } finally { await driver.disconnect(id) }
  }, 10000)

  it('caps a real 200000-row stream at 1000 without materializing the remaining rows', async () => {
    const id = await driver.connect(config)
    try {
      const sql = `WITH digits AS (SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) SELECT a.d + b.d * 10 + c.d * 100 + d.d * 1000 + e.d * 10000 + f.d * 100000 AS n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e CROSS JOIN digits f WHERE a.d + b.d * 10 + c.d * 100 + d.d * 1000 + e.d * 10000 + f.d * 100000 < 200000`
      let stored = 0
      const summary = await spoolLimitedRows(driver.streamRows(id, sql), 1000, async () => { stored++ })
      expect(summary).toEqual({ columns: ['n'], rowCount: 1000, truncated: true })
      expect(stored).toBe(1000)
    } finally { await driver.disconnect(id) }
  }, 30000)
})
