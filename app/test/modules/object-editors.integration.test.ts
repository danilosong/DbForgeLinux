import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { inspectDatabase, diffTables } from '../../src/modules/schema/index.js'
import { buildRoutineTemplate } from '../../src/modules/object-editors/index.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('object editors MySQL integration', () => {
  const driver = new MysqlDriver()
  const testPrefix = mysqlTestPrefix('object_editor')
  const databaseName = testPrefix
  const tableName = `${testPrefix}_table`
  let connectionId = ''
  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${databaseName}\``) } finally { await driver.disconnect(connectionId) }
  })

  it('introspects a table, generates ALTER from its diff, and applies the DDL', async () => {
    const config = { ...createDefaultConnection(testPrefix, 'Object editor integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only' }
    connectionId = await driver.connect(config)
    await driver.executeSql(connectionId, `CREATE DATABASE \`${databaseName}\`; CREATE TABLE \`${databaseName}\`.\`${tableName}\` (id INT NOT NULL PRIMARY KEY) ENGINE=InnoDB`)
    const database = await inspectDatabase((sql, values) => driver.queryRows(connectionId, sql, values), databaseName)
    const original = database.tables.find((item) => item.name === tableName)
    expect(original?.columns.map((column) => column.name)).toEqual(['id'])
    const edited = { ...original!, columns: [...original!.columns, { name: 'label', type: 'VARCHAR(64)', nullable: true }] }
    const ddl = diffTables(original!, edited, databaseName, true)
    expect(ddl.join('\n')).toContain('ADD COLUMN `label` VARCHAR(64)')
    await driver.executeSql(connectionId, ddl[0]!)
    const updated = await inspectDatabase((sql, values) => driver.queryRows(connectionId, sql, values), databaseName)
    expect(updated.tables.find((item) => item.name === tableName)?.columns.map((column) => column.name)).toEqual(['id', 'label'])
  })

  it('deploys routine templates with explicit definer, SQL access, determinism and parameters', async () => {
    const config = { ...createDefaultConnection(testPrefix, 'Object editor integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' }
    if (!connectionId) connectionId = await driver.connect(config)
    await driver.executeSql(connectionId, `CREATE DATABASE IF NOT EXISTS \`${databaseName}\``)
    const procedure = buildRoutineTemplate({ connectionId, database: databaseName, kind: 'procedure', name: `${testPrefix}_proc` }, { definer: 'CURRENT_USER', sqlAccess: 'CONTAINS SQL', deterministic: false, parameters: [{ name: 'customer_id', mode: 'IN', type: 'INT' }] })
    const functionSql = buildRoutineTemplate({ connectionId, database: databaseName, kind: 'function', name: `${testPrefix}_func` }, { definer: 'CURRENT_USER', sqlAccess: 'NO SQL', deterministic: true, parameters: [] })
    await driver.executeSql(connectionId, procedure)
    await driver.executeSql(connectionId, functionSql)
    const objects = await driver.listDatabaseObjects(connectionId, databaseName)
    expect(objects.filter((item) => ['procedure', 'function'].includes(item.kind)).map((item) => `${item.kind}:${item.name}`)).toEqual(expect.arrayContaining([`procedure:${testPrefix}_proc`, `function:${testPrefix}_func`]))
  })
})
