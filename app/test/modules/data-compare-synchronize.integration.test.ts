import { afterAll, describe, expect, it, vi } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { registerDataCompareIpc } from '../../src/main/ipc/data-compare.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => handlers.set(name, handler) } }))

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('Data Compare synchronization transaction integration', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('data_sync')
  let connectionId = ''
  const config = { ...createDefaultConnection(mysqlTestPrefix('connection'), 'Data Compare integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only' }

  afterAll(async () => { if (connectionId) { try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``) } finally { await driver.disconnect(connectionId) } } })

  it('rolls back before/apply/after together on failure and still completes a valid sync', async () => {
    connectionId = await driver.connect(config)
    await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\`; CREATE TABLE \`${database}\`.source_items (id INT PRIMARY KEY); CREATE TABLE \`${database}\`.target_items (id INT PRIMARY KEY); INSERT INTO \`${database}\`.source_items VALUES (3); INSERT INTO \`${database}\`.target_items VALUES (1);`)
    registerDataCompareIpc({ driver } as never)
    const synchronize = handlers.get('data-compare:synchronize')!
    const failed = await synchronize({}, connectionId, database, 'source_items', connectionId, database, 'target_items', ['id'], ['id'], false, true, [{ id: 3 }], undefined, `INSERT INTO \`${database}\`.target_items VALUES (3)`, `INSERT INTO \`${database}\`.target_items VALUES (4)`)
    expect(failed).toMatchObject({ failed: 1 })
    expect((await driver.queryRows(connectionId, `SELECT id FROM \`${database}\`.target_items ORDER BY id`)).map((row) => row.id)).toEqual([1])

    const valid = await synchronize({}, connectionId, database, 'source_items', connectionId, database, 'target_items', ['id'], ['id'], false, true, [{ id: 3 }], undefined)
    expect(valid).toMatchObject({ succeeded: 1, failed: 0 })
    expect(await driver.queryRows(connectionId, `SELECT id FROM \`${database}\`.target_items WHERE id=3`)).toEqual([{ id: 3 }])
  }, 30_000)
})
