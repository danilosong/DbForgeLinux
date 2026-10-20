import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { compareSchemas, inspectDatabase } from '../../src/modules/schema/index.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('schema synchronization integration', () => {
  const driver = new MysqlDriver()
  let connectionId: string
  const suffix = `${process.pid}_${Date.now()}`
  const schemaA = `schema_a_${suffix}`
  const schemaB = `schema_b_${suffix}`

  afterAll(async () => {
    if (!connectionId) return
    await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${schemaA}\`; DROP DATABASE IF EXISTS \`${schemaB}\`;`)
    await driver.disconnect(connectionId)
  })

  it('synchronizes two databases and confirms equal introspection', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection('schema-integration', 'Schema integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only'
    })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${schemaA}\`; CREATE DATABASE \`${schemaB}\`; CREATE TABLE \`${schemaA}\`.parent (id INT NOT NULL PRIMARY KEY); CREATE TABLE \`${schemaB}\`.parent (id INT NOT NULL PRIMARY KEY, label VARCHAR(40) NOT NULL DEFAULT 'x'); CREATE TABLE \`${schemaB}\`.child (id INT NOT NULL PRIMARY KEY, parent_id INT NOT NULL, CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES \`${schemaB}\`.parent(id) ON DELETE CASCADE);`)

    const query = (sql: string, parameters?: unknown[]) => driver.queryRows(connectionId, sql, parameters)
    const [source, target] = await Promise.all([inspectDatabase(query, schemaA), inspectDatabase(query, schemaB)])
    const comparison = compareSchemas(source, target)
    expect(comparison.differences.length).toBeGreaterThan(0)
    for (const statement of comparison.script.split(/;\s*(?:\n|$)/).map((item) => item.trim()).filter(Boolean)) {
      await driver.executeSql(connectionId, `${statement};`)
    }
    const synchronized = await inspectDatabase(query, schemaA)
    expect(compareSchemas(synchronized, target).differences).toEqual([])
  }, 30000)
})
