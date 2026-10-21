import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({ getAllWindows: vi.fn(() => [] as Array<{ webContents: { id: number }; isDestroyed: () => boolean }>) }))
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: electron.getAllWindows }, ipcMain: {} }))

import { IPC_CHANNEL_SCHEMAS, isTrustedIpcFrame, validateIpcArguments, wrapIpcHandler, type GuardEvent } from '../src/main/ipc/guard.js'

const config = { rendererFile: '/app/out/renderer/index.html' }

describe('IPC runtime guard', () => {
  beforeEach(() => electron.getAllWindows.mockReset())

  it('defines schemas for every registered invoke channel', () => {
    const directory = join(process.cwd(), 'src/main/ipc')
    const files = readdirSync(directory).filter(file => file.endsWith('.ts'))
    const declared = new Set<string>()
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8')
      for (const match of source.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)) declared.add(match[1]!)
    }
    expect([...declared].sort()).toEqual(Object.keys(IPC_CHANNEL_SCHEMAS).sort())
  })

  it('rejects malformed arguments, unsafe paths, wrong enums and missing confirmations', () => {
    expect(() => validateIpcArguments('db:execute', ['connection', 12])).toThrow(/must be a string/)
    expect(() => validateIpcArguments('db:execute', ['connection', 'SELECT 1', 'x', 'demo', 'extra'])).toThrow(/expects/)
    expect(() => validateIpcArguments('service-control:action', ['mysqld.service', 'delete'])).toThrow(/allowed value/)
    expect(() => validateIpcArguments('file:open-sql-path', ['../../etc/passwd'])).toThrow(/absolute path/)
    expect(() => validateIpcArguments('source-control:write-script', ['/tmp/repo', '../escape.sql', 'SELECT 1'])).toThrow(/confined relative path/)
    expect(() => validateIpcArguments('sessions:kill', ['connection', [17], 'query', false])).toThrow(/confirmation/)
    expect(() => validateIpcArguments('db:execute', ['connection', 'x'.repeat(20 * 1024 * 1024 + 1)])).toThrow(/size limit/)
    const descriptor = { database: 'shop', table: 'orders', keyColumns: ['id'], columns: [{ name: 'id', dataType: 'int', columnType: 'int', nullable: false, defaultValue: null, extra: '' }] }
    expect(() => validateIpcArguments('grid-editing:apply', ['connection', descriptor, [{ kind: 'delete', original: { id: 1 } }], false])).not.toThrow()
    expect(() => validateIpcArguments('grid-editing:apply', ['connection', {}, [], false])).toThrow(/database is required/)
    expect(() => validateIpcArguments('grid-editing:apply', ['c', { database: 'd', table: 't', keyColumns: [], columns: [], runSql: true }, [], true])).toThrow(/not allowed/)
    expect(() => validateIpcArguments('report-pivot:build', ['job', { rows: [], columns: [], values: [{ field: 'x', aggregation: 'explode' }] }])).toThrow(/invalid/)
    const backupOptions = { includeStructure: true, includeData: true, objectKinds: ['table'], singleTransaction: true, includeRoutines: true, includeTriggers: true, includeEvents: false, extendedInserts: true, charset: 'utf8mb4', includeDefiner: true, includeDrop: true, dropIfExists: true, includeUse: true, noAutoValueOnZero: true, lockTables: false, flushLogs: false, errorPolicy: 'abort', directory: '/tmp/backup', fileName: 'nightly', appendTimestamp: true, autoDeleteDays: 30, autoDeleteCount: 10, zip: true, compressionLevel: 6, comment: '' }
    expect(() => validateIpcArguments('database-tools:backup:run', ['connection', 'shop', backupOptions, 'job'])).not.toThrow()
    expect(() => validateIpcArguments('database-tools:backup:run', ['connection', 'shop', { ...backupOptions, rawSql: 'DROP DATABASE shop' }, 'job'])).toThrow(/not allowed/)
    expect(() => validateIpcArguments('grid-data:master-detail', ['connection', { database: 'shop', table: 'orders' }, { id: 7 }])).not.toThrow()
    expect(() => validateIpcArguments('grid-editing:apply', ['connection', {}, [], 'yes'])).toThrow(/boolean/)
    expect(() => validateIpcArguments('import-export:import', ['c', 'db.table', 'csv', 'append', [], {}, 'job'])).not.toThrow()
    expect(() => validateIpcArguments('import-export:script', ['db.table', 'text', 'repopulate', [], {}, 'job'])).not.toThrow()
    const newTableOptions = { skipLines: 2, headerPosition: 1, autoDelimiter: true, createTable: { database: 'test_db', name: 'imported', columns: [{ name: 'id', type: 'BIGINT', primaryKey: true }] } }
    expect(() => validateIpcArguments('import-export:import', ['c', 'test_db.imported', 'csv', 'append', [], newTableOptions, 'job'])).not.toThrow()
    expect(() => validateIpcArguments('import-export:script', ['test_db.imported', 'csv', 'append', [], { ...newTableOptions, createTable: { ...newTableOptions.createTable, columns: [{ name: 'id', type: 'INT; DROP TABLE x', primaryKey: true }] } }, 'job'])).toThrow(/invalid/)
    expect(() => validateIpcArguments('import-export:select-source', ['job', 'csv', { skipLines: -1 }])).toThrow(/skipLines/)
    expect(() => validateIpcArguments('import-export:import', ['c', 'test_db.imported', 'csv', 'append', [], { ...newTableOptions, createTable: { ...newTableOptions.createTable, extra: true } }, 'job'])).toThrow(/not allowed/)
  })

  it('allows explicit NULL routine parameters while rejecting other debugger argument types', () => {
    expect(() => validateIpcArguments('routine-debugger:start', [{ connectionId: 'c', database: 'd', name: 'p' }, ['value', null], [], true, true])).not.toThrow()
    expect(() => validateIpcArguments('routine-debugger:start', [{ connectionId: 'c', database: 'd', name: 'p' }, ['value', 3], [], true, true])).toThrow(/must be a string/)
  })

  it('rejects external origins, subframes and senders without an app window', () => {
    const mainFrame = { url: 'https://evil.example/' }
    const event = { sender: { id: 8, mainFrame }, senderFrame: mainFrame } as GuardEvent
    electron.getAllWindows.mockReturnValue([{ webContents: { id: 8 }, isDestroyed: () => false }])
    expect(isTrustedIpcFrame(event, { ...config, rendererUrl: 'http://localhost:5173' })).toBe(false)
    expect(isTrustedIpcFrame({ ...event, senderFrame: { url: 'file:///app/out/renderer/child.html' } }, config)).toBe(false)
    electron.getAllWindows.mockReturnValue([])
    expect(isTrustedIpcFrame({ ...event, senderFrame: { url: pathToFileURL(config.rendererFile).href } }, config)).toBe(false)
  })

  it('accepts only the trusted main frame owned by an app window', () => {
    const url = pathToFileURL(config.rendererFile).href
    const frame = { url }
    electron.getAllWindows.mockReturnValue([{ webContents: { id: 9 }, isDestroyed: () => false }])
    expect(isTrustedIpcFrame({ sender: { id: 9, mainFrame: frame }, senderFrame: frame }, config)).toBe(true)
  })

  it('rate limits kill, drop, restore, mutating SQL and Git IPC calls', async () => {
    const event = { sender: { id: 91, mainFrame: { url: 'file:///trusted' } }, senderFrame: { url: 'file:///trusted' } } as GuardEvent
    const handler = wrapIpcHandler('sessions:kill', () => 'ok', config, () => true)
    for (let i = 0; i < 8; i++) await handler(event, 'connection', [1], 'query', true)
    expect(() => handler(event, 'connection', [1], 'query', true)).toThrow(/rate limit/)

    let senderId = 93
    for (const [channel, args] of [
      ['object-editor:mutate', [{ connectionId: 'c', database: 'd', kind: 'table', name: 't' }, 'drop']],
      ['database-tools:restore', ['c', 'd', 'd', 'CREATE TABLE t (id INT)']],
      ['db:execute', ['c', 'DROP TABLE t']],
      ['grid-editing:apply', ['c', { database: 'd', table: 't', keyColumns: ['id'], columns: [{ name: 'id', dataType: 'int', columnType: 'int', nullable: false, defaultValue: null, extra: '' }] }, [{ kind: 'delete', original: { id: 1 } }], true]],
      ['schema-update:execute', [['queued-change'], true]],
    ] as const) {
      const operation = wrapIpcHandler(channel, () => 'ok', config, () => true)
      const operationEvent = { ...event, sender: { ...event.sender, id: senderId++ } }
      for (let i = 0; i < 8; i++) await operation(operationEvent, ...args)
      expect(() => operation(operationEvent, ...args)).toThrow(/rate limit/)
    }

    const git = wrapIpcHandler('source-control:push', () => 'ok', config, () => true)
    const gitEvent = { ...event, sender: { ...event.sender, id: 92 } }
    for (let i = 0; i < 8; i++) await git(gitEvent, '/tmp/repo', true)
    expect(() => git(gitEvent, '/tmp/repo', true)).toThrow(/rate limit/)
  })
})
