import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) } }))
import { registerGridDataIpc } from '../src/main/ipc/grid-data.js'
import type { IpcDeps } from '../src/main/ipc/registry.js'

describe('grid master-detail IPC', () => {
  beforeEach(() => handlers.clear())
  it('discovers foreign keys and queries details with quoted identifiers and bound master values', async () => {
    const queryRows = vi.fn(async (_id: string, sql: string) => sql.includes('information_schema')
      ? [{ detailTable: 'line items', detailColumn: 'order`id', masterColumn: 'id', relationName: 'fk_order' }]
      : [{ id: 4 }])
    registerGridDataIpc({ driver: { queryRows } as unknown as IpcDeps['driver'] } as IpcDeps)
    const handler = handlers.get('grid-data:master-detail')!
    const master = { database: 'shop', table: 'orders', keyColumns: ['id'], columns: [] }
    await expect(handler({}, 'conn', master, { id: 12 })).resolves.toEqual([{ name: 'fk_order', table: 'line items', rows: [{ id: 4 }], truncated: false }])
    expect(queryRows.mock.calls[1]?.[1]).toContain('`shop`.`line items`')
    expect(queryRows.mock.calls[1]?.[1]).toContain('`order``id` <=> ?')
    expect(queryRows.mock.calls[1]?.[2]).toEqual([12])
  })
})
