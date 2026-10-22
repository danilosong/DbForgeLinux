import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => ipc.handlers.set(name, handler) } }))

import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { registerDataGeneratorIpc } from '../../src/main/ipc/data-generator.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
const server = { host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' }

describe.skipIf(!enabled)('Data Generator against a Production-tagged connection', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('dg_production')
  let prodId = ''
  let devId = ''
  const count = async (): Promise<number> => Number((await driver.queryRows(devId, `SELECT COUNT(*) AS n FROM \`${database}\`.items`))[0]?.n)
  const generate = (connectionId: string, extra: Record<string, unknown> = {}): Promise<unknown> => Promise.resolve(ipc.handlers.get('data-generator:generate')!({}, { connectionId, database, tables: ['items'], rowsPerTable: 4, generators: {}, seed: 1, confirmed: true, ...extra }))

  beforeAll(async () => {
    devId = await driver.connect({ ...createDefaultConnection('dg-dev', 'dev'), ...server, environment: 'dev' })
    await driver.executeSql(devId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(devId, `CREATE TABLE \`${database}\`.items (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(40) NOT NULL)`)
    prodId = await driver.connect({ ...createDefaultConnection('dg-prod', 'prod'), ...server, environment: 'prod' })
    registerDataGeneratorIpc({ driver } as never)
  })

  afterAll(async () => {
    if (prodId) await driver.disconnect(prodId)
    if (devId) { await driver.executeSql(devId, `DROP DATABASE IF EXISTS \`${database}\``); await driver.disconnect(devId) }
  })

  it('writes nothing on Production without the explicit release and the typed database name', async () => {
    await expect(generate(prodId)).rejects.toThrow('blocked on Production')
    await expect(generate(prodId, { allowProduction: true, productionConfirmation: 'other' })).rejects.toThrow('Type the database name')
    expect(await count()).toBe(0)
  })

  it('generates on Production once released and confirmed, and on a non-Production connection as before', async () => {
    await generate(prodId, { allowProduction: true, productionConfirmation: database })
    expect(await count()).toBe(4)
    await generate(devId)
    expect(await count()).toBe(8)
  })
})
