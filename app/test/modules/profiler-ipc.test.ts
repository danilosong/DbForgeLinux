import { beforeEach, describe, expect, it, vi } from 'vitest'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) } }))
import { registerProfilerIpc } from '../../src/main/ipc/profiler.js'

describe('profiler IPC', () => {
 beforeEach(() => handlers.clear())
 it('returns and stores a profile from the active connection', async () => {
  registerProfilerIpc({ driver: { queryRows: async (_id: string, sql: string) => sql.startsWith('EXPLAIN') ? [{ plan: JSON.stringify({ query_block: { table: { table_name: 'items', access_type: 'ALL' } } }) }] : sql.startsWith('SHOW SESSION STATUS') ? [{ Variable_name: 'Rows_read', Value: '1' }] : [] } } as never)
  const run=handlers.get('profiler:profile')!;const result=await run({},'active-1','SELECT * FROM items') as {plan:{roots:unknown[]}}
  expect(result.plan.roots).toHaveLength(1);expect(await handlers.get('profiler:history')!({},'active-1')).toHaveLength(1)
 })
})
