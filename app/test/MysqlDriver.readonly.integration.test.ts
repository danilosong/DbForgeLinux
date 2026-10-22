import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from './mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
const server = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 33067),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? 'integration-only'
}

describe.skipIf(!enabled)('MySQL driver read-only and session init on every pooled connection', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('readonly_pool')
  let adminId = ''
  let readOnlyId = ''
  let initId = ''

  beforeAll(async () => {
    adminId = await driver.connect({ ...createDefaultConnection('ro-admin', 'admin'), ...server })
    await driver.executeSql(adminId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(adminId, `CREATE TABLE \`${database}\`.t (id INT PRIMARY KEY)`)
    await driver.executeSql(adminId, `INSERT INTO \`${database}\`.t VALUES (1), (2), (3)`)
    const base = createDefaultConnection('ro-session', 'read-only')
    readOnlyId = await driver.connect({ ...base, ...server, database, advanced: { ...base.advanced, readOnly: true } })
    const initBase = createDefaultConnection('init-session', 'init commands')
    initId = await driver.connect({ ...initBase, ...server, database, advanced: { ...initBase.advanced, initCommands: 'SET @tuxsql_init = 42' } })
  })

  afterAll(async () => {
    if (readOnlyId) await driver.disconnect(readOnlyId)
    if (initId) await driver.disconnect(initId)
    if (adminId) { await driver.executeSql(adminId, `DROP DATABASE IF EXISTS \`${database}\``); await driver.disconnect(adminId) }
  })

  it('every concurrent pooled connection of a read-only profile reports transaction_read_only = 1', async () => {
    const probe = 'SELECT CONNECTION_ID() AS id, @@SESSION.transaction_read_only AS ro, SLEEP(0.3) AS s'
    const rows = (await Promise.all([1, 2, 3, 4].map(() => driver.queryRows(readOnlyId, probe)))).map((result) => result[0])
    expect(new Set(rows.map((row) => row?.id)).size).toBeGreaterThan(1)
    for (const row of rows) expect(Number(row?.ro)).toBe(1)
  }, 15_000)

  it('the server rejects a write hidden from the keyword filter on any pooled connection', async () => {
    // The client-side keyword regex never sees DELETE when the statement is assembled on the server.
    const hidden = "SET @tuxsql_q = CONCAT('DELE', 'TE FROM t'); PREPARE tuxsql_ro FROM @tuxsql_q; EXECUTE tuxsql_ro; DEALLOCATE PREPARE tuxsql_ro"
    await Promise.allSettled([1, 2, 3, 4].map(() => driver.queryRows(readOnlyId, 'SELECT SLEEP(0.3)')))
    const attempts = await Promise.allSettled([1, 2, 3, 4].map(() => driver.executeSql(readOnlyId, `SELECT SLEEP(0.2); ${hidden}`)))
    const remaining = await driver.queryRows(adminId, `SELECT COUNT(*) AS total FROM \`${database}\`.t`)
    expect(Number(remaining[0]?.total)).toBe(3)
    expect(attempts.every((attempt) => attempt.status === 'rejected')).toBe(true)
  }, 15_000)

  it('a read-only profile cannot switch its own session back to read-write', async () => {
    await expect(driver.executeSql(readOnlyId, 'SET SESSION TRANSACTION READ WRITE')).rejects.toThrow(/read-only/)
    await expect(driver.executeSql(readOnlyId, 'SET @@SESSION.transaction_read_only = 0')).rejects.toThrow(/read-only/)
  })

  it('init commands apply to every pooled connection, not only the first one', async () => {
    const rows = (await Promise.all([1, 2, 3].map(() => driver.queryRows(initId, 'SELECT CONNECTION_ID() AS id, @tuxsql_init AS v, SLEEP(0.3) AS s')))).map((result) => result[0])
    expect(new Set(rows.map((row) => row?.id)).size).toBeGreaterThan(1)
    for (const row of rows) expect(Number(row?.v)).toBe(42)
  }, 15_000)

  it('a legitimate SELECT keeps working on the read-only profile', async () => {
    const result = await driver.executeSql(readOnlyId, 'SELECT id FROM t ORDER BY id')
    expect(result[0]?.rows.map((row) => row.id)).toEqual([1, 2, 3])
  })
})
