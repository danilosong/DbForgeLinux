import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => handlers.set(name, handler) } }))
import { registerTasksIpc } from '../../src/main/ipc/tasks.js'
import { RecentTasksStore } from '../../src/main/modules/tasks/RecentTasksStore.js'

describe('recent tasks IPC', () => {
  it('records, lists, reorders and deletes whitelisted task metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-task-ipc-'))
    try {
      registerTasksIpc(new RecentTasksStore(join(dir, 'recent-tasks.json')))
      const record = handlers.get('tasks:recent:record')!
      const list = handlers.get('tasks:recent:list')!
      const remove = handlers.get('tasks:recent:delete')!
      await record({}, { kind: 'backup', title: 'Daily backup', detail: 'inventory', password: 'must not persist' })
      await record({}, { kind: 'export', title: 'api_key=hidden', detail: 'token:abc123' })
      await record({}, { kind: 'import', title: 'CSV import', detail: 'inventory' })
      const latest = await record({}, { kind: 'backup', title: 'Daily backup', detail: 'inventory updated' }) as { id: string }
      expect(await list({})).toMatchObject([{ kind: 'backup', detail: 'inventory updated' }, { kind: 'import' }, { kind: 'export', title: 'api_key=[redacted]', detail: 'token=[redacted]' }])
      expect(await readFile(join(dir, 'recent-tasks.json'), 'utf8')).not.toContain('must not persist')
      expect(await readFile(join(dir, 'recent-tasks.json'), 'utf8')).not.toContain('abc123')
      expect(await readFile(join(dir, 'recent-tasks.json'), 'utf8')).not.toContain('api_key=hidden')
      await remove({}, latest.id)
      expect(await list({})).toMatchObject([{ kind: 'import' }, { kind: 'export', title: 'api_key=[redacted]' }])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it('rejects unknown task kinds and malformed deletion identifiers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-task-invalid-'))
    try {
      registerTasksIpc(new RecentTasksStore(join(dir, 'recent-tasks.json')))
      await expect(handlers.get('tasks:recent:record')!({}, { kind: 'shell', title: 'run', detail: '' })).rejects.toThrow('Invalid task type')
      await expect(handlers.get('tasks:recent:delete')!({}, '../secrets')).rejects.toThrow('Invalid task id')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
