import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcDeps } from '../src/main/ipc/registry.js'

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => ipc.handlers.set(name, handler) } }))

import { registerConnectionsIpc } from '../src/main/ipc/connections.js'

beforeEach(() => ipc.handlers.clear())

describe('connection and password vault IPC', () => {
  it('registers save and delete calls for the secure password vault', async () => {
    const vault = { save: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) }
    registerConnectionsIpc({ vault, connectionsStore: {} } as IpcDeps)

    await ipc.handlers.get('vault:save')!({}, 'temporary-ref', 'test-only-password')
    await ipc.handlers.get('vault:delete')!({}, 'temporary-ref')

    expect(vault.save).toHaveBeenCalledExactlyOnceWith('temporary-ref', 'test-only-password')
    expect(vault.delete).toHaveBeenCalledExactlyOnceWith('temporary-ref')
  })
})
