import { beforeEach, describe, expect, it, vi } from 'vitest'

const mysqlMock = vi.hoisted(() => ({
  createPool: vi.fn(),
  query: vi.fn(),
  getConnection: vi.fn(),
  end: vi.fn(),
  release: vi.fn()
}))

vi.mock('mysql2/promise', () => ({
  default: { createPool: mysqlMock.createPool }
}))

import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'

describe('MysqlDriver.executeSql', () => {
  let driver: MysqlDriver
  let connectionId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mysqlMock.createPool.mockReturnValue({
      query: mysqlMock.query,
      getConnection: mysqlMock.getConnection,
      end: mysqlMock.end
    })
    mysqlMock.getConnection.mockResolvedValue({ release: mysqlMock.release })
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

    await expect(driver.executeSql(connectionId, 'SELECT 1; INSERT ...; UPDATE ...;')).resolves.toEqual([
      { columns: ['id', 'label'], rows, affectedRows: 0, insertId: 0, warningStatus: 0 },
      { columns: [], rows: [], affectedRows: 1, insertId: 7, warningStatus: 0 },
      { columns: [], rows: [], affectedRows: 2, insertId: 0, warningStatus: 1 }
    ])
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
})
