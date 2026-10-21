import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { compareData, type DataCompareEndpoint, type SyncStatement } from '../../src/modules/data-compare/index.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'

describe.skipIf(!enabled)('data comparison synchronization integration', () => {
  const driver = new MysqlDriver()
  let connectionId = ''
  const prefix = mysqlTestPrefix('data_compare')
  const sourceDatabase = `${prefix}_source`
  const targetDatabase = `${prefix}_target`

  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${sourceDatabase}\`; DROP DATABASE IF EXISTS \`${targetDatabase}\`;`) } finally { await driver.disconnect(connectionId) }
  })

  it('compares, applies parameterized sync statements transactionally, then compares equal', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection(mysqlTestPrefix('connection'), 'Data Compare integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067),
      user: 'root',
      password: 'integration-only'
    })
    await driver.executeSql(connectionId,
      `CREATE DATABASE \`${sourceDatabase}\`; CREATE DATABASE \`${targetDatabase}\`; ` +
      `CREATE TABLE \`${sourceDatabase}\`.items (id INT NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL); ` +
      `CREATE TABLE \`${targetDatabase}\`.items (id INT NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL); ` +
      `INSERT INTO \`${sourceDatabase}\`.items VALUES (1, 'updated'), (2, 'source only'); ` +
      `INSERT INTO \`${targetDatabase}\`.items VALUES (1, 'old'), (3, 'target only');`)

    const endpoint = (database: string): DataCompareEndpoint => ({ connectionId, database, table: 'items', driver })
    const statements: SyncStatement[] = []
    const initial = await compareData({
      source: endpoint(sourceDatabase), target: endpoint(targetDatabase), keyColumns: ['id'], columns: ['id', 'label'], allowDeletes: true,
      onStatement: (statement) => { statements.push(statement) }
    })
    expect(initial).toMatchObject({ compared: 3, same: 0, different: 1, sourceOnly: 1, targetOnly: 1, statements: 3 })
    expect(statements.every(({ sql }) => !sql.includes('updated') && sql.includes('?'))).toBe(true)
    await driver.withTransaction(connectionId, async (transaction) => {
      for (const statement of statements) await transaction.execute(statement.sql, statement.values)
    })

    const final = await compareData({ source: endpoint(sourceDatabase), target: endpoint(targetDatabase), keyColumns: ['id'], columns: ['id', 'label'] })
    expect(final).toMatchObject({ compared: 2, same: 2, different: 0, sourceOnly: 0, targetOnly: 0, statements: 0 })
  }, 30_000)
})
