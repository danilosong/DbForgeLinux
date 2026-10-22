import { afterAll, describe, expect, it } from 'vitest'
import { Readable } from 'node:stream'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { importData } from '../../src/modules/data-export-import/index.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('repopulate transaction safety integration', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('repopulate')
  let connectionId = ''
  const config = { ...createDefaultConnection(mysqlTestPrefix('connection'), 'Repopulate integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only' }
  afterAll(async () => { if (connectionId) { try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``) } finally { await driver.disconnect(connectionId) } } })

  it('preserves prior rows after a malformed third CSV line and replaces them for a valid file', async () => {
    connectionId = await driver.connect(config)
    await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\`; CREATE TABLE \`${database}\`.items (id INT PRIMARY KEY, name VARCHAR(40)); INSERT INTO \`${database}\`.items VALUES (1, 'old-one'), (2, 'old-two');`)
    const common = { driver, connectionId, table: `${database}.items`, format: 'csv' as const, options: { mode: 'repopulate' as const, transactional: false } }
    await expect(importData({ ...common, source: Readable.from(['id,name\n3,parsed\n4,"broken']) })).rejects.toThrow()
    expect(await driver.queryRows(connectionId, `SELECT id,name FROM \`${database}\`.items ORDER BY id`)).toEqual([{ id: 1, name: 'old-one' }, { id: 2, name: 'old-two' }])

    const report = await importData({ ...common, source: Readable.from(['id,name\n3,replaced\n']) })
    expect(report).toMatchObject({ read: 1, inserted: 1, errors: 0 })
    expect(await driver.queryRows(connectionId, `SELECT id,name FROM \`${database}\`.items ORDER BY id`)).toEqual([{ id: 3, name: 'replaced' }])
  }, 30_000)
})
