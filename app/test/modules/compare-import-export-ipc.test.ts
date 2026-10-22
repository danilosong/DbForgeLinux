import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { handlers, showSaveDialog, showOpenDialog, showMessageBox, getPath } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>(), showSaveDialog: vi.fn(), showOpenDialog: vi.fn(), showMessageBox: vi.fn(), getPath: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) }, dialog: { showSaveDialog, showOpenDialog, showMessageBox }, BrowserWindow: { fromWebContents: () => null }, app: { getPath } }))
import { app } from 'electron'
import { registerSchemaCompareIpc } from '../../src/main/ipc/schema-compare.js'
import { registerDataCompareIpc } from '../../src/main/ipc/data-compare.js'
import { registerImportExportIpc } from '../../src/main/ipc/import-export.js'

describe('comparison and import/export IPC safeguards', () => {
  it('requires explicit confirmation for destructive schema statements', async () => {
    const driver = { queryRows: vi.fn(async (_connectionId: string, sql: string) => /information_schema\.SCHEMATA/i.test(sql) ? [{ charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }] : []) }
    registerSchemaCompareIpc({ driver } as never)
    await expect(handlers.get('schema-compare:synchronize')!({}, 'target', 'db', 'DROP TABLE t;', false)).rejects.toThrow('Confirm the potential data loss')
  })
  it('collects same-session server warnings after schema synchronization statements', async () => {
    const executed: string[] = []
    const driver = {
      queryRows: vi.fn(async (_connectionId: string, sql: string) => /information_schema\.SCHEMATA/i.test(sql) ? [{ charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }] : []),
      setDatabase: vi.fn(),
      withSplitterCompatibleSqlMode: async (_id: string, operation: (execute: (sql: string) => Promise<unknown[]>) => Promise<unknown>) => operation(async (sql) => {
        executed.push(sql)
        return sql === 'SHOW WARNINGS' ? [{ rows: [{ Level: 'Warning', Code: 1051, Message: 'Unknown table.' }] }] : [{ warningStatus: 1, rows: [] }]
      })
    }
    registerSchemaCompareIpc({ driver } as never)
    const result = await handlers.get('schema-compare:synchronize')!({}, 'target', 'demo', 'CREATE TABLE `demo`.`items` (`id` INT);', false)
    expect(executed).toEqual(['CREATE TABLE `demo`.`items` (`id` INT)', 'SHOW WARNINGS'])
    expect(result).toMatchObject({ succeeded: 1, failed: 0, warnings: ['Warning · statement 1 · Warning 1051: Unknown table.'] })
  })
  it('requires destructive confirmation for narrowing schema MODIFY but permits widening', async () => {
    const executed: string[] = []
    const driver = {
      queryRows: async (_id: string, sql: string) => {
        if (sql.includes('information_schema.SCHEMATA')) return [{ charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }]
        if (sql.includes('information_schema.TABLES')) return [{ name: 'items', engine: 'InnoDB', collation: 'utf8mb4_0900_ai_ci', charset: 'utf8mb4', comment: '', options: '' }]
        if (sql.includes('information_schema.COLUMNS')) return [{ tableName: 'items', name: 'value', type: 'varchar(255)', nullable: 'NO', defaultValue: null, extra: '', comment: '' }]
        return []
      },
      setDatabase: vi.fn(),
      withSplitterCompatibleSqlMode: async (_id: string, operation: (execute: (sql: string) => Promise<unknown[]>) => Promise<unknown>) => operation(async (sql) => { executed.push(sql); return [{ warningStatus: 0, rows: [] }] })
    }
    registerSchemaCompareIpc({ driver } as never)
    const synchronize = handlers.get('schema-compare:synchronize')!
    await expect(synchronize({}, 'target', 'demo', 'ALTER TABLE `demo`.items MODIFY COLUMN `value` VARCHAR(50) NOT NULL;', false)).rejects.toThrow('Confirm the potential data loss')
    const result = await synchronize({}, 'target', 'demo', 'ALTER TABLE `demo`.items MODIFY COLUMN `value` VARCHAR(500) NOT NULL;', false)
    expect(result).toMatchObject({ succeeded: 1, failed: 0 })
    expect(executed).toEqual(['ALTER TABLE `demo`.items MODIFY COLUMN `value` VARCHAR(500) NOT NULL'])
  })
  it('requires explicit confirmation before data synchronization', async () => {
    registerDataCompareIpc({ driver: {} } as never)
    await expect(handlers.get('data-compare:synchronize')!({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], true, false)).rejects.toThrow('Confirm synchronization')
  })
  it('requires typing the exact destination database when deletion is enabled', async () => {
    const driver = {
      connectionEnvironment: () => 'dev',
      streamRows: async function* () { },
      withTransaction: async (_id: string, operation: (tx: { execute: () => Promise<{ affectedRows: number; insertId: number }> }) => Promise<unknown>) => operation({ execute: async () => ({ affectedRows: 0, insertId: 0 }) })
    }
    registerDataCompareIpc({ driver } as never)
    const synchronize = handlers.get('data-compare:synchronize')!
    await expect(synchronize({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], true, true)).rejects.toThrow('Type the destination database name')
    await expect(synchronize({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], true, true, [], undefined, '', '', 'wrong')).rejects.toThrow('Type the destination database name')
    await expect(synchronize({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], true, true, [], undefined, '', '', 'tdb')).resolves.toMatchObject({ failed: 0 })
  })
  it('runs before and after statements through the same destination transaction', async () => {
    const trace: string[] = []
    const driver = {
      connectionEnvironment: () => 'dev',
      streamRows: async function* () { },
      withTransaction: async (_id: string, operation: (tx: { execute: (sql: string) => Promise<{ affectedRows: number; insertId: number }> }) => Promise<unknown>) => {
        trace.push('begin')
        const result = await operation({ execute: async (sql) => { trace.push(sql); return { affectedRows: 0, insertId: 0 } } })
        trace.push('commit')
        return result
      }
    }
    registerDataCompareIpc({ driver } as never)
    await handlers.get('data-compare:synchronize')!({}, 's', 'sdb', 'st', 't', 'tdb', 'tt', ['id'], [], false, true, undefined, undefined, 'INSERT before', 'INSERT after')
    expect(trace).toEqual(['begin', 'INSERT before', 'INSERT after', 'commit'])
  })
  it('rejects non-read queries from the export wizard', async () => {
    registerImportExportIpc({ driver: {} } as never)
    await expect(handlers.get('import-export:export')!({}, 'connection', 'SELECT 1; DROP TABLE users', 'csv')).rejects.toThrow('accept one SELECT query only')
  })

  it('previews and imports the file selected by the native dialog without opening it twice', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-import-ipc-'))
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

  it('writes a safe SQL import script to the path chosen by the user', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-import-script-'))
    try {
      const file = join(directory, 'source.json'); const output = join(directory, 'generated.sql')
      await writeFile(file, JSON.stringify([{ id: 9, label: "quoted ' value" }]))
      showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file] })
      showSaveDialog.mockResolvedValue({ canceled: false, filePath: output })
      registerImportExportIpc({ driver: {} } as never)
      const event = { sender: { id: 24, isDestroyed: () => false, send: vi.fn() } }
      await handlers.get('import-export:select-source')!(event, 'script-job', 'json', {})
      const result = await handlers.get('import-export:script')!(event, 'items', 'json', 'append', [], {}, 'script-job')
      expect(result).toMatchObject({ path: output, rows: 1 })
      const escapedQuote = String.fromCharCode(92, 39)
      expect(await readFile(output, 'utf8')).toContain(`'quoted ${escapedQuote} value'`)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('asks through the main process after each failed row when prompt policy is selected', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-import-prompt-'))
    try {
      const file = join(directory, 'source.json')
      await writeFile(file, '[{"id":1},{"id":2}]')
      showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file] })
      showMessageBox.mockResolvedValue({ response: 0 })
      const driver = {
        withTransaction: async (_id: string, operation: (transaction: { execute: (_sql: string, values: readonly unknown[]) => Promise<{ affectedRows: number; insertId: number }> }) => Promise<unknown>) => operation({
          execute: async (_sql, values) => { if (values[0] === 1) throw new Error('row rejected'); return { affectedRows: 1, insertId: 2 } }
        })
      }
      registerImportExportIpc({ driver } as never)
      const event = { sender: { id: 25, isDestroyed: () => false, send: vi.fn() } }
      await handlers.get('import-export:select-source')!(event, 'prompt-job', 'json', {})
      const result = await handlers.get('import-export:import')!(event, 'connection', 'items', 'json', 'append', [], { onRowError: 'prompt' }, 'prompt-job')
      expect(result).toMatchObject({ read: 2, inserted: 1, errors: 1 })
      expect(showMessageBox).toHaveBeenCalledOnce()
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('stores sanitized templates under userData', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-template-ipc-'))
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
