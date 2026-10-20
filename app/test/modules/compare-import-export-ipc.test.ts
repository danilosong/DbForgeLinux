import { describe, expect, it, vi } from 'vitest'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) }, dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() } }))
import { registerSchemaCompareIpc } from '../../src/main/ipc/schema-compare.js'
import { registerDataCompareIpc } from '../../src/main/ipc/data-compare.js'
import { registerImportExportIpc } from '../../src/main/ipc/import-export.js'

describe('comparison and import/export IPC safeguards', () => {
  it('requires explicit confirmation for destructive schema statements', async () => {
    registerSchemaCompareIpc({ driver: {} } as never)
    await expect(handlers.get('schema-compare:synchronize')!({}, 'target', 'db', 'DROP TABLE t;', false)).rejects.toThrow('Confirme a possível perda de dados')
  })
  it('requires explicit confirmation before data synchronization', async () => {
    registerDataCompareIpc({ driver: {} } as never)
    await expect(handlers.get('data-compare:synchronize')!({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], true, false)).rejects.toThrow('Confirme a sincronização')
  })
  it('rejects non-read queries from the export wizard', async () => {
    registerImportExportIpc({ driver: {} } as never)
    await expect(handlers.get('import-export:export')!({}, 'connection', 'SELECT 1; DROP TABLE users', 'csv')).rejects.toThrow('aceita apenas uma consulta SELECT')
  })
})
