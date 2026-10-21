import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { buildCreateDatabaseDdl } from '../../src/modules/object-editors/database.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('create database editor MySQL integration', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('create_database_editor')
  let connectionId = ''
  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``) }
    finally { await driver.disconnect(connectionId) }
  })

  it('applies the generated DDL and resolves the created database metadata', async () => {
    const config = { ...createDefaultConnection(database, 'Create database editor integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' }
    connectionId = await driver.connect(config)
    const sql = buildCreateDatabaseDdl(database, 'utf8mb4')
    await driver.executeSql(connectionId, sql)
    const schemas = await driver.listDatabases(connectionId)
    expect(schemas).toContain(database)
    const [metadata] = await driver.queryRows(connectionId, 'SELECT DEFAULT_CHARACTER_SET_NAME AS charset FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [database])
    expect(metadata?.charset).toBe('utf8mb4')
  })
})
