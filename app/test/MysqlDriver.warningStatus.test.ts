import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createCorePool: vi.fn(), createPool: vi.fn(), query: vi.fn(), getConnection: vi.fn(), end: vi.fn() }))
vi.mock('mysql2', () => ({ createPool: mocks.createCorePool }))
vi.mock('mysql2/promise', () => ({ default: { createPool: mocks.createPool } }))

import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'

describe('MysqlDriver import warning collection', () => {
  let driver: MysqlDriver
  let connectionId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.query.mockResolvedValue([[{ Value: '' }], []])
    mocks.getConnection.mockResolvedValue({ release: vi.fn() })
    mocks.createCorePool.mockReturnValue({ on: vi.fn(), promise: () => ({ query: mocks.query, getConnection: mocks.getConnection, end: mocks.end, execute: vi.fn() }) })
    driver = new MysqlDriver()
    connectionId = await driver.connect(createDefaultConnection('warnings', 'Warnings'))
  })

  it('reads SHOW WARNINGS on the same transaction session after a write reports warnings', async () => {
    const query = vi.fn().mockResolvedValue([[{ Level: 'Warning', Code: 1265, Message: 'Data truncated for column value.' }], []])
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue([{ affectedRows: 1, insertId: 0, warningStatus: 1 }, []]),
      query,
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn()
    }
    mocks.getConnection.mockResolvedValue(connection)

    const result = await driver.withTransaction(connectionId, (transaction) => transaction.execute('INSERT INTO items VALUES (?)', ['value']))

    expect(query).toHaveBeenCalledWith('SHOW WARNINGS')
    expect(result.warnings).toEqual(['Warning 1265: Data truncated for column value.'])
    expect(connection.commit).toHaveBeenCalledOnce()
  })
})
