import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { createBackupSqlWithOptions, restoreBackup } from '../../src/modules/database-tools/backup.js'
import { inspectDatabase } from '../../src/modules/schema/index.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('database backup MySQL integration', () => {
  const driver = new MysqlDriver(); const prefix = mysqlTestPrefix('backup_restore'); const sourceDb = `${prefix}_src`; const targetDb = `${prefix}_dst`; let connectionId = ''
  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${sourceDb}\``).catch(() => undefined); await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${targetDb}\``).catch(() => undefined) }
    finally { await driver.disconnect(connectionId).catch(() => undefined) }
  })
  it('backs up an owned throwaway schema and safely restores it to a second throwaway schema', async () => {
    connectionId = await driver.connect({ ...createDefaultConnection(`${prefix}_connection`, 'Backup integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${sourceDb}\``); await driver.executeSql(connectionId, `CREATE DATABASE \`${targetDb}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${sourceDb}\`.items (id INT PRIMARY KEY, label VARCHAR(40) NOT NULL)`); await driver.executeSql(connectionId, `INSERT INTO \`${sourceDb}\`.items VALUES (1, 'owned test row')`)
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), sourceDb)
    const backup = await createBackupSqlWithOptions(schema, { includeStructure: true, includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: true, extendedInserts: true, charset: 'utf8mb4', errorPolicy: 'abort', includeDefiner: true, includeDrop: false, dropIfExists: false, includeUse: false, noAutoValueOnZero: true, lockTables: false, flushLogs: false }, async (table, offset, limit) => driver.queryRows(connectionId, `SELECT * FROM \`${sourceDb}\`.\`${table}\` LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(connectionId, targetDb)
    const restored = await restoreBackup(targetDb, targetDb, backup.sql, async (statement) => { await driver.executeSql(connectionId, statement) })
    expect(restored.errors).toEqual([]); expect(restored.executed).toBeGreaterThan(1)
    const rows = await driver.queryRows(connectionId, 'SELECT id, label FROM items')
    expect(rows).toEqual([{ id: 1, label: 'owned test row' }])
    const sameDatabaseDump = await createBackupSqlWithOptions(schema, { includeStructure: true, includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: false, extendedInserts: true, charset: 'utf8mb4', errorPolicy: 'abort', includeDefiner: false, includeDrop: true, dropIfExists: true, includeUse: true, noAutoValueOnZero: false, lockTables: false, flushLogs: false }, async (table, offset, limit) => driver.queryRows(connectionId, `SELECT * FROM \`${sourceDb}\`.\`${table}\` LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(connectionId, sourceDb)
    const sameDbRestore = await restoreBackup(sourceDb, sourceDb, sameDatabaseDump.sql, async (statement) => { await driver.executeSql(connectionId, statement) })
    expect(sameDbRestore.errors).toEqual([])
    expect(await driver.queryRows(connectionId, 'SELECT id, label FROM items')).toEqual([{ id: 1, label: 'owned test row' }])
  }, 30_000)
})
