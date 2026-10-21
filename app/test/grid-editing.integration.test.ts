import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { buildGridChange, type EditableResult } from '../src/modules/grid-editing/index.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from './mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('grid editing MySQL integration', () => {
  const driver = new MysqlDriver()
  let connectionId = ''
  const prefix = mysqlTestPrefix('grid_edit')
  const database = prefix
  const table = `${prefix}_rows`
  const descriptor: EditableResult = { database, table, keyColumns: ['id'], columns: [
    { name: 'id', dataType: 'int', columnType: 'int', nullable: false, defaultValue: null, extra: '' },
    { name: 'value', dataType: 'varchar', columnType: 'varchar(80)', nullable: false, defaultValue: null, extra: '' }
  ] }

  beforeAll(async () => {
    connectionId = await driver.connect({ ...createDefaultConnection(prefix, 'Grid edit integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${database}\`.\`${table}\` (id INT PRIMARY KEY, value VARCHAR(80) NOT NULL) ENGINE=InnoDB`)
    await driver.executeSql(connectionId, `INSERT INTO \`${database}\`.\`${table}\` VALUES (1, 'before')`)
  })
  afterAll(async () => { if (connectionId) { try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined) } finally { await driver.disconnect(connectionId) } } })

  it('posts keyed changes atomically, detects concurrent modifications, and honors document rollback', async () => {
    const row = { id: 1, value: 'before' }
    const update = buildGridChange({ kind: 'update', original: row, values: { ...row, value: 'after' } }, descriptor)
    const committed = await driver.withTransaction(connectionId, (transaction) => transaction.execute(update.sql, update.values))
    expect(committed.affectedRows).toBe(1)
    const updated = await driver.queryRows(connectionId, `SELECT value FROM \`${database}\`.\`${table}\` WHERE id = 1`)
    expect(updated[0]?.value).toBe('after')

    await driver.beginTransaction(connectionId)
    await expect(driver.withSavepoint(connectionId, async () => {
      const first = buildGridChange({ kind: 'update', original: { id: 1, value: 'after' }, values: { id: 1, value: 'temporary' } }, descriptor)
      expect((await driver.executeParameterized(connectionId, first.sql, first.values)).affectedRows).toBe(1)
      const stale = buildGridChange({ kind: 'update', original: { id: 1, value: 'before' }, values: { id: 1, value: 'stale' } }, descriptor)
      if ((await driver.executeParameterized(connectionId, stale.sql, stale.values)).affectedRows !== 1) throw new Error('Conflict detected')
    })).rejects.toThrow('Conflict detected')
    expect((await driver.executeSql(connectionId, `SELECT value FROM \`${database}\`.\`${table}\` WHERE id = 1`))[0]?.rows[0]?.value).toBe('after')
    await driver.rollbackTransaction(connectionId)

    await driver.beginTransaction(connectionId)
    const inserted = buildGridChange({ kind: 'insert', values: { id: 2, value: 'pending' } }, descriptor)
    expect((await driver.executeParameterized(connectionId, inserted.sql, inserted.values)).affectedRows).toBe(1)
    await driver.rollbackTransaction(connectionId)
    expect(await driver.queryRows(connectionId, `SELECT id FROM \`${database}\`.\`${table}\` WHERE id = 2`)).toEqual([])

    const stale = buildGridChange({ kind: 'update', original: row, values: { ...row, value: 'stale' } }, descriptor)
    expect((await driver.executeParameterized(connectionId, stale.sql, stale.values)).affectedRows).toBe(0)
  }, 30_000)
})
