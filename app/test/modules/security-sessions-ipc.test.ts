import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcDeps } from '../../src/main/ipc/registry.js'

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => ipc.handlers.set(name, handler) } }))

import { registerSecurityIpc } from '../../src/main/ipc/security.js'
import { registerSessionsIpc } from '../../src/main/ipc/sessions.js'

function handler(name: string): (...args: unknown[]) => unknown {
  const item = ipc.handlers.get(name)
  if (!item) throw new Error(`Missing IPC handler: ${name}`)
  return item
}

beforeEach(() => ipc.handlers.clear())

describe('Security and Sessions IPC', () => {
  it('previews and applies user changes without exposing a password in the preview', async () => {
    registerSecurityIpc({ driver: {
      queryRows: vi.fn(async (_id: string, sql: string) => sql.includes('CURRENT_USER') ? [{ account: 'admin@localhost' }] : []),
      executeSql: vi.fn(async () => [])
    } as unknown as IpcDeps['driver'] } as IpcDeps)
    const changes = [{ kind: 'createUser', account: { user: 'app', host: '%' }, password: 'secret' }] as const
    const plan = await handler('security:preview')({}, 'connection', [...changes]) as { statements: Array<{ previewSql: string }> }
    expect(plan.statements[0].previewSql).not.toContain('secret')
    expect(plan.statements[0].previewSql).toContain('<password>')
    const applied = await handler('security:apply')({}, 'connection', [...changes], true) as Array<{ success: boolean }>
    expect(applied).toEqual([{ index: 0, success: true }])
  })

  it('blocks deleting the authenticated account in IPC preview', async () => {
    registerSecurityIpc({ driver: {
      queryRows: vi.fn(async () => [{ account: 'admin@localhost' }]), executeSql: vi.fn(async () => [])
    } as unknown as IpcDeps['driver'] } as IpcDeps)
    await expect(handler('security:preview')({}, 'connection', [{ kind: 'dropUser', account: { user: 'admin', host: 'localhost' } }])).rejects.toThrow('account used by this connection')
  })

  it('requires confirmation and protects the current session before KILL', async () => {
    const executeSql = vi.fn(async () => [])
    registerSessionsIpc({ driver: {
      queryRows: vi.fn(async (_id: string, sql: string) => {
        if (sql.includes('CONNECTION_ID')) return [{ id: 1 }]
        if (sql.startsWith('SELECT p.ID')) return [{ id: 1, user: 'admin', command: 'Query' }, { id: 2, user: 'worker', command: 'Query' }]
        return []
      }), executeSql
    } as unknown as IpcDeps['driver'] } as IpcDeps)
    await expect(handler('sessions:kill')({}, 'connection', [1, 2], 'session', false)).rejects.toThrow('explicit confirmation')
    const results = await handler('sessions:kill')({}, 'connection', [1, 2], 'session', true) as Array<{ id: number; success: boolean }>
    expect(results.map((item) => item.success)).toEqual([false, true])
    expect(executeSql).toHaveBeenCalledExactlyOnceWith('connection', 'KILL 2')

    const readOnlyExecute = vi.fn(async () => [])
    registerSessionsIpc({ driver: {
      queryRows: vi.fn(async (_id: string, sql: string) => sql.includes('transaction_read_only') ? [{ readOnly: 1 }] : []), executeSql: readOnlyExecute
    } as unknown as IpcDeps['driver'] } as IpcDeps)
    await expect(handler('sessions:kill')({}, 'connection', [2], 'session', true)).rejects.toThrow('read-only')
    expect(readOnlyExecute).not.toHaveBeenCalled()
  })

  it('uses server metadata for variable changes and rejects static variables', async () => {
    const executeSql = vi.fn(async () => [])
    const queryRows = vi.fn(async (_id: string, sql: string) => sql.startsWith('SELECT VERSION()') ? [{ version: '8.4.0' }] : sql.startsWith('SHOW GLOBAL VARIABLES') ? [{ Variable: 'max_connections', Value: '151' }, { Variable: 'port', Value: '3306' }] : [])
    registerSessionsIpc({ driver: { queryRows, executeSql } as unknown as IpcDeps['driver'] } as IpcDeps)
    await expect(handler('sessions:set-variable')({}, 'connection', { name: 'max_connections', oldValue: '151', newValue: '200', scope: 'GLOBAL', dynamic: true }, { confirm: true })).rejects.toThrow('Type the variable name')
    expect(executeSql).not.toHaveBeenCalled()
    const preview = await handler('sessions:preview-variable')({}, 'connection', { name: 'max_connections', oldValue: '151', newValue: '200', scope: 'GLOBAL', dynamic: true }, { persist: false }) as { sql: string; oldValue: string; requiresTypedConfirmation: boolean }
    expect(preview).toEqual({ sql: 'SET GLOBAL max_connections = 200', oldValue: '151', requiresTypedConfirmation: true })
    await handler('sessions:set-variable')({}, 'connection', { name: 'max_connections', oldValue: '151', newValue: '200', scope: 'GLOBAL', dynamic: true }, { confirm: true, confirmation: 'max_connections' })
    expect(executeSql).toHaveBeenCalledExactlyOnceWith('connection', 'SET GLOBAL max_connections = 200')
    await expect(handler('sessions:set-variable')({}, 'connection', { name: 'port', oldValue: '3306', newValue: '3307', scope: 'GLOBAL', dynamic: true }, { confirm: true, confirmation: 'port' })).rejects.toThrow('static')
    expect(executeSql).toHaveBeenCalledExactlyOnceWith('connection', 'SET GLOBAL max_connections = 200')
    await expect(handler('sessions:set-variable')({}, 'connection', { name: 'max_connections', oldValue: '151', newValue: '200', scope: 'GLOBAL', dynamic: true }, { confirm: true, mode: 'drop-everything', confirmation: 'max_connections' })).rejects.toThrow('Unsupported variable apply mode')
  })
})
