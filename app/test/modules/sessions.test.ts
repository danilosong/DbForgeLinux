import { describe, expect, it, vi } from 'vitest'
import { compareStatus, compareVariableSnapshots, getServerVariables, killSessions, listSessions, setServerVariable } from '../../src/modules/sessions/index.js'
import type { SqlClient } from '../../src/modules/sql.js'

function client(overrides: Partial<SqlClient> = {}): SqlClient {
  return { query: vi.fn(async () => []), execute: vi.fn(async () => undefined), ...overrides }
}

describe('sessions and server variables backend', () => {
  it('maps processlist rows and applies search and Sleep filters', async () => {
    const db = client({ query: vi.fn(async (sql) => {
      if (sql.startsWith('SELECT p.ID')) throw new Error('performance schema disabled')
      return [{ Id: 1, User: 'root', Host: 'localhost', db: 'app', Command: 'Query', Time: 9, State: 'executing', Info: 'SELECT 1' }, { Id: 2, User: 'worker', Command: 'Sleep', Time: 100, Info: null }]
    }) })
    const result = await listSessions(db, { hideSleep: true, search: 'select', currentId: 1 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 1, database: 'app', query: 'SELECT 1', current: true })
  })

  it('requires confirmation, protects own/system sessions, and kills eligible sessions explicitly', async () => {
    const execute = vi.fn(async () => undefined)
    const db = client({ execute, query: vi.fn(async (sql) => {
      if (sql.startsWith('SELECT p.ID')) throw new Error('fallback processlist')
      return [{ Id: 1, User: 'root', Command: 'Query' }, { Id: 2, User: 'system user', Command: 'Daemon' }, { Id: 3, User: 'worker', Command: 'Query' }]
    }) })
    await expect(killSessions(db, [3], 'query', { confirm: false as true, currentId: 1 })).rejects.toThrow('confirmação')
    const results = await killSessions(db, [1, 2, 3], 'query', { confirm: true, currentId: 1 })
    expect(results.map((item) => item.success)).toEqual([false, false, true])
    expect(execute).toHaveBeenCalledExactlyOnceWith('KILL QUERY 3')
  })

  it('keeps the performance schema query enabled and treats event_scheduler as a system thread', async () => {
    const execute = vi.fn(async () => undefined)
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT p.ID')) return [
        { id: 4, user: 'event_scheduler', command: 'Daemon', rowsExamined: 12 },
        { id: 5, user: 'worker', command: 'Query', rowsExamined: 7 }
      ]
      return []
    })
    const db = client({ query, execute })
    const listed = await listSessions(db)
    expect(query.mock.calls[0][0]).not.toContain('PROCESSLIST_MEMORY')
    expect(listed[0]).toMatchObject({ id: 4, system: true, rowsExamined: 12 })
    const killed = await killSessions(db, [4, 5], 'session', { confirm: true, currentId: 1 })
    expect(killed.map((item) => item.success)).toEqual([false, true])
    expect(execute).toHaveBeenCalledExactlyOnceWith('KILL 5')
  })

  it('marks static variables and validates global SET values', async () => {
    const execute = vi.fn(async () => undefined)
    const db = client({ execute, query: vi.fn(async () => [{ Variable: 'port', Value: '3306' }, { Variable: 'max_connections', Value: '151' }, { Variable: 'sql_mode', Value: 'STRICT_TRANS_TABLES,ANSI' }]) })
    const snapshot = await getServerVariables(db, 'GLOBAL')
    expect(snapshot.variables.find((item) => item.name === 'port')?.dynamic).toBe(false)
    expect(snapshot.variables.find((item) => item.name === 'max_connections')?.type).toBe('number')
    await expect(setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, dynamic: true, type: 'number', min: 1, max: 100 })).rejects.toThrow('intervalo')
    await expect(setServerVariable(db, 'read_only; DROP USER x', 'ON', 'GLOBAL', { confirm: true, dynamic: true })).rejects.toThrow('Nome de variável')
    await setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, dynamic: true, type: 'number' })
    expect(execute).toHaveBeenCalledExactlyOnceWith('SET GLOBAL max_connections = 200')
    await expect(setServerVariable(db, 'port', 3307, 'GLOBAL', { confirm: true, dynamic: true })).rejects.toThrow('estática')
  })

  it('compares variables and status counters', () => {
    const before = { capturedAt: 'a', scope: 'GLOBAL' as const, variables: [{ name: 'x', value: '1', scope: 'GLOBAL' as const, dynamic: true, type: 'number' as const }] }
    const after = { capturedAt: 'b', scope: 'GLOBAL' as const, variables: [{ name: 'x', value: '2', scope: 'GLOBAL' as const, dynamic: true, type: 'number' as const }] }
    expect(compareVariableSnapshots(before, after)).toEqual([{ name: 'x', oldValue: '1', newValue: '2', scope: 'GLOBAL', dynamic: true }])
    expect(compareStatus({ Questions: '10', Threads: '2' }, { Questions: '16', Threads: '2' })).toEqual({ Questions: 6 })
  })
})
