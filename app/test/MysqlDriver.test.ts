import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'

const mysqlMock = vi.hoisted(() => ({
  createConnection: vi.fn(),
  createCorePool: vi.fn(),
  createPool: vi.fn(),
  query: vi.fn(),
  getConnection: vi.fn(),
  getCoreConnection: vi.fn(),
  end: vi.fn(),
  release: vi.fn()
}))

vi.mock('mysql2', () => ({ createPool: mysqlMock.createCorePool }))
vi.mock('mysql2/promise', () => ({
  default: { createConnection: mysqlMock.createConnection, createPool: mysqlMock.createPool }
}))

import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'

describe('MysqlDriver.executeSql', () => {
  let driver: MysqlDriver
  let connectionId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mysqlMock.query.mockResolvedValue([[{ Value: 'TLS_AES_256_GCM_SHA384' }], []])
    mysqlMock.createCorePool.mockReturnValue({
      promise: () => ({
        query: mysqlMock.query,
        getConnection: mysqlMock.getConnection,
        end: mysqlMock.end,
        execute: vi.fn()
      }),
      getConnection: mysqlMock.getCoreConnection
    })
    mysqlMock.getConnection.mockResolvedValue({ release: mysqlMock.release })
    mysqlMock.getCoreConnection.mockImplementation((callback: (error: Error | null, connection: unknown) => void) => callback(null, {
      threadId: 77,
      query: vi.fn(() => ({ stream: () => Readable.from([{ id: 1 }, { id: 2 }, { id: 3 }]) })),
      release: mysqlMock.release
    }))
    driver = new MysqlDriver()
    connectionId = await driver.connect(createDefaultConnection('mock', 'Mock'))
  })

  it('mapeia resultados de SELECT, INSERT e UPDATE em statements múltiplos', async () => {
    const rows = [{ id: 7, label: 'row' }]
    mysqlMock.query.mockResolvedValue([[
      rows,
      { affectedRows: 1, insertId: 7, warningStatus: 0 },
      { affectedRows: 2, insertId: 0, warningStatus: 1 }
    ], []])

    const result = await driver.executeSql(connectionId, 'SELECT 1; INSERT ...; UPDATE ...;')
    expect(result).toMatchObject([
      { columns: ['id', 'label'], rows, affectedRows: 0, insertId: 0, warningStatus: 0 },
      { columns: [], rows: [], affectedRows: 1, insertId: 7, warningStatus: 0 },
      { columns: [], rows: [], affectedRows: 2, insertId: 0, warningStatus: 1 }
    ])
    expect(result[0]?.executionTimeMs).toBeGreaterThanOrEqual(0)
    expect(result[0]?.fetchTimeMs).toBe(0)
    expect(result.slice(1).every((item) => item.executionTimeMs === 0)).toBe(true)
  })

  it('propaga erros de sintaxe do servidor', async () => {
    const syntaxError = new Error('You have an error in your SQL syntax')
    mysqlMock.query.mockRejectedValue(syntaxError)

    await expect(driver.executeSql(connectionId, 'SELEC FROM')).rejects.toBe(syntaxError)
  })

  it('envia KILL QUERY para a sessão da execução ativa', async () => {
    let rejectQuery: ((error: Error) => void) | undefined
    mysqlMock.getConnection.mockResolvedValue({
      threadId: 77,
      query: vi.fn(() => new Promise((_resolve, reject) => { rejectQuery = reject })),
      release: mysqlMock.release
    })
    mysqlMock.query.mockImplementation(async (sql: string) => {
      if (sql === 'KILL QUERY 77') {
        const error = Object.assign(new Error('Query interrupted'), { code: 'ER_QUERY_INTERRUPTED' })
        rejectQuery?.(error)
      }
      return [[], []]
    })
    const execution = driver.executeSql(connectionId, 'SELECT SLEEP(10)', 'active-execution')
    await Promise.resolve()
    await Promise.resolve()
    await driver.cancelQuery(connectionId, 'active-execution')
    await expect(execution).rejects.toMatchObject({ code: 'ER_QUERY_INTERRUPTED' })
    expect(mysqlMock.query).toHaveBeenCalledWith('KILL QUERY 77')
  })

  it('interrompe um stream de resultados assim que o sinal é abortado', async () => {
    const controller = new AbortController()
    const iterator = driver.streamRows(connectionId, 'SELECT id FROM t', [], controller.signal)[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({ value: { id: 1 }, done: false })
    controller.abort()
    await expect(iterator.next()).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('cancela a consulta no servidor quando um stream é abortado', async () => {
    const controller = new AbortController()
    const iterator = driver.streamRows(connectionId, 'SELECT id FROM t', [], controller.signal, undefined, 'stream-execution')[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({ value: { id: 1 }, done: false })
    controller.abort()
    await expect(iterator.next()).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(mysqlMock.query).toHaveBeenCalledWith('KILL QUERY 77'))
  })
})

describe('MysqlDriver TLS policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mysqlMock.createCorePool.mockReturnValue({
      promise: () => ({ query: mysqlMock.query, getConnection: mysqlMock.getConnection, end: mysqlMock.end, execute: vi.fn() }),
      getConnection: mysqlMock.getCoreConnection
    })
    mysqlMock.query.mockResolvedValue([[{ Value: '' }], []])
    mysqlMock.getConnection.mockResolvedValue({ release: vi.fn(), query: vi.fn().mockResolvedValue([[], []]) })
  })

  it('retries without TLS for loopback in preferred mode after an unsupported handshake', async () => {
    const downgrade = Object.assign(new Error('TLS is not supported'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })
    const connection = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith('SELECT VERSION')) return [[{ version: '8.4.0' }], []]
        if (sql.startsWith('SHOW DATABASES')) return [[{ Database: 'mysql' }], []]
        return [[{ Value: '' }], []]
      }),
      end: vi.fn()
    }
    mysqlMock.createConnection.mockRejectedValueOnce(downgrade).mockResolvedValueOnce(connection)
    const driver = new MysqlDriver()

    const result = await driver.testConnection(createDefaultConnection('tls-default'))

    expect(result.tlsVersion).toBeUndefined()
    expect(mysqlMock.createConnection).toHaveBeenCalledTimes(2)
    expect(mysqlMock.createConnection.mock.calls[0]?.[0]).toMatchObject({ ssl: { rejectUnauthorized: false } })
    expect(mysqlMock.createConnection.mock.calls[1]?.[0]).toMatchObject({ ssl: undefined })
  })

  it('does not downgrade a remote preferred connection when the server has no TLS', async () => {
    const downgrade = Object.assign(new Error('TLS is not supported'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })
    mysqlMock.createConnection.mockRejectedValue(downgrade)
    const config = { ...createDefaultConnection('tls-remote'), host: 'db.example.test' }
    const driver = new MysqlDriver()

    await expect(driver.testConnection(config)).rejects.toThrow('This server does not offer TLS')

    expect(mysqlMock.createConnection).toHaveBeenCalledTimes(1)
  })

  it('does not retry required TLS without verification or encryption', async () => {
    const downgrade = Object.assign(new Error('TLS is not supported'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })
    mysqlMock.createConnection.mockRejectedValue(downgrade)
    const config = { ...createDefaultConnection('tls-required'), ssl: { mode: 'required' as const } }
    const driver = new MysqlDriver()

    await expect(driver.testConnection(config)).rejects.toThrow()

    expect(mysqlMock.createConnection).toHaveBeenCalledTimes(1)
    expect(mysqlMock.createConnection.mock.calls[0]?.[0]).toMatchObject({ ssl: { rejectUnauthorized: false } })
  })

  it('does not downgrade a remote connection in connect()', async () => {
    const downgrade = Object.assign(new Error('TLS is not supported'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })
    mysqlMock.getConnection.mockRejectedValueOnce(downgrade)
    const driver = new MysqlDriver()
    const config = { ...createDefaultConnection('tls-connect-remote'), host: 'db.example.test' }

    await expect(driver.connect(config)).rejects.toThrow('This server does not offer TLS')

    expect(mysqlMock.createCorePool).toHaveBeenCalledTimes(1)
  })
})
