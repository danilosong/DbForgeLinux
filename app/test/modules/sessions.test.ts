import { describe, expect, it, vi } from 'vitest'
import { compareStatus, compareVariableSnapshots, getServerStatus, getServerVariables, killSessions, listSessions, serverVariableSql, setServerVariable } from '../../src/modules/sessions/index.js'
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
    await expect(killSessions(db, [3], 'query', { confirm: false as true, currentId: 1 })).rejects.toThrow('explicit confirmation')
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
    const db = client({ execute, query: vi.fn(async () => [{ Variable_name: 'port', Value: '3306' }, { Variable_name: 'max_connections', Value: '151' }, { Variable_name: 'sql_mode', Value: 'STRICT_TRANS_TABLES,ANSI' }]) })
    const snapshot = await getServerVariables(db, 'GLOBAL')
    expect(await getServerStatus(db, 'GLOBAL')).toEqual({ port: '3306', max_connections: '151', sql_mode: 'STRICT_TRANS_TABLES,ANSI' })
    expect(snapshot.variables.find((item) => item.name === 'port')?.dynamic).toBe(false)
    expect(snapshot.variables.find((item) => item.name === 'max_connections')?.type).toBe('number')
    await expect(setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, dynamic: true, type: 'number', min: 1, max: 100 })).rejects.toThrow('outside the allowed range')
    await expect(setServerVariable(db, 'read_only; DROP USER x', 'ON', 'GLOBAL', { confirm: true, dynamic: true })).rejects.toThrow('Variable name is invalid')
    await setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, confirmation: 'max_connections', dynamic: true, type: 'number' })
    expect(execute).toHaveBeenCalledExactlyOnceWith('SET GLOBAL max_connections = 200')
    await expect(setServerVariable(db, 'port', 3307, 'GLOBAL', { confirm: true, dynamic: true })).rejects.toThrow('is static')
  })

  it('requires the variable name typed back for SET GLOBAL, PERSIST and PERSIST_ONLY, never for SET SESSION', async () => {
    const execute = vi.fn(async () => undefined)
    const db = client({ execute })
    for (const confirmation of [undefined, '', 'MAX_CONNECTIONS', 'max_connections ']) {
      await expect(setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, confirmation, dynamic: true, type: 'number' })).rejects.toThrow('Type the variable name max_connections')
      await expect(setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, confirmation, mode: 'persist', dynamic: true, type: 'number' })).rejects.toThrow('Type the variable name')
    }
    await expect(setServerVariable(db, 'innodb_log_file_size', 1, 'GLOBAL', { confirm: true, mode: 'persist-only', dynamic: false, type: 'number' })).rejects.toThrow('Type the variable name')
    expect(execute).not.toHaveBeenCalled()
    await setServerVariable(db, 'sql_mode', 'ANSI', 'SESSION', { confirm: true, dynamic: true, type: 'string' })
    await setServerVariable(db, 'max_connections', 200, 'GLOBAL', { confirm: true, confirmation: 'max_connections', mode: 'persist', dynamic: true, type: 'number' })
    await setServerVariable(db, 'innodb_log_file_size', 1, 'GLOBAL', { confirm: true, confirmation: 'innodb_log_file_size', mode: 'persist-only', dynamic: false, type: 'number' })
    expect(execute.mock.calls.map(([sql]) => sql)).toEqual(["SET SESSION sql_mode = 'ANSI'", 'SET PERSIST max_connections = 200', 'SET PERSIST_ONLY innodb_log_file_size = 1'])
  })

  it('previews exactly the statement that runs and keeps static/scope rules', () => {
    expect(serverVariableSql('max_connections', 200, 'GLOBAL', { dynamic: true, type: 'number' })).toBe('SET GLOBAL max_connections = 200')
    expect(serverVariableSql('max_connections', 200, 'GLOBAL', { dynamic: true, persist: true, type: 'number' })).toBe('SET PERSIST max_connections = 200')
    expect(() => serverVariableSql('port', 3307, 'GLOBAL', { dynamic: false })).toThrow('is static')
    expect(() => serverVariableSql('max_connections', 1, 'SESSION', { dynamic: true, mode: 'persist' })).toThrow('only accepts global')
  })

  it('compares variables and status counters', () => {
    const before = { capturedAt: 'a', scope: 'GLOBAL' as const, variables: [{ name: 'x', value: '1', scope: 'GLOBAL' as const, dynamic: true, type: 'number' as const }] }
    const after = { capturedAt: 'b', scope: 'GLOBAL' as const, variables: [{ name: 'x', value: '2', scope: 'GLOBAL' as const, dynamic: true, type: 'number' as const }] }
    expect(compareVariableSnapshots(before, after)).toEqual([{ name: 'x', oldValue: '1', newValue: '2', scope: 'GLOBAL', dynamic: true }])
    expect(compareStatus({ Questions: '10', Threads: '2' }, { Questions: '16', Threads: '2' })).toEqual({ Questions: 6 })
  })
})
