import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { handlers, showSaveDialog, showOpenDialog, getPath } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>(), showSaveDialog: vi.fn(), showOpenDialog: vi.fn(), getPath: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) }, dialog: { showSaveDialog, showOpenDialog }, app: { getPath } }))
import { app } from 'electron'
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

  it('previews and imports the file selected by the native dialog without opening it twice', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-import-ipc-'))
    try {
      const file = join(directory, 'source.json')
      await writeFile(file, '[{"source_id":4}]')
      showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file] })
      const statements: string[] = []
      const driver = {
        withTransaction: async (_id: string, operation: (transaction: { execute: () => Promise<{ affectedRows: number; insertId: number }> }) => Promise<void>) => operation({ execute: async () => { statements.push('insert'); return { affectedRows: 1, insertId: 1 } } })
      }
      registerImportExportIpc({ driver } as never)
      const event = { sender: { id: 23, isDestroyed: () => false, send: vi.fn() } }
      const selected = await handlers.get('import-export:select-source')!(event, 'job-1', 'json', {})
      expect(selected.preview.columns).toEqual(['source_id'])
      const imported = await handlers.get('import-export:import')!(event, 'connection', 'items', 'json', 'append', [], {}, 'job-1')
      expect(imported.inserted).toBe(1)
      expect(statements).toEqual(['insert'])
      expect(showOpenDialog).toHaveBeenCalledTimes(1)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('stores sanitized templates under userData', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-template-ipc-'))
    try {
      vi.mocked(app.getPath).mockReturnValue(directory)
      registerImportExportIpc({ driver: {} } as never)
      const saved = await handlers.get('import-export:templates:save')!({}, { name: 'Daily', direction: 'import', format: 'csv', table: 'items', connectionPassword: 'secret', options: { delimiter: ';' } })
      const listed = await handlers.get('import-export:templates:list')!({})
      expect(listed).toEqual([saved])
      expect(await readFile(join(directory, 'data-tasks', 'templates.json'), 'utf8')).not.toContain('secret')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
