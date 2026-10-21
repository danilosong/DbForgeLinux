import { BrowserWindow, dialog, ipcMain } from 'electron'
import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createBackupSql, restoreBackup } from '../../modules/database-tools/backup.js'
import { BackupScheduleStore, cronMatches, scheduledBackupPath } from '../../modules/database-tools/scheduler.js'
import { join, resolve } from 'node:path'
import { findInvalidObjects, searchObjectText } from '../../modules/database-tools/index.js'
import { inspectDatabase } from '../../modules/schema/index.js'
import type { DatabaseObject } from '../../shared/contracts/sql.js'
import type { IpcDeps } from './registry.js'
import { formatSqlFiles, previewSqlFiles } from '../../modules/editor/batchFormatter.js'
import { executeLargeScript, type ScriptErrorAction, type ScriptEncoding } from '../../modules/database-tools/largeScript.js'

const quote = (identifier: string): string => `\`${identifier.replaceAll('`', '``')}\``
function assertTarget(connectionId: string, database: string): void { if (!connectionId || !database.trim()) throw new Error('Selecione uma conexão e um database.') }

export function registerDatabaseToolsIpc(deps: IpcDeps): void {
  const { driver, userDataDir } = deps
  const runningScripts = new Map<string, AbortController>()
  const scriptErrorResolvers = new Map<string, (action: ScriptErrorAction) => void>()
  const approvedFormatPaths = new Set<string>()
  const approvedLargeScripts = new Set<string>()
  ipcMain.handle('database-tools:format-select', async (_event, directories: boolean) => {
    const properties = directories ? ['openDirectory', 'multiSelections'] as ('openDirectory' | 'multiSelections')[] : ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[]
    const options = { title: 'Select SQL files or folders', properties, filters: directories ? undefined : [{ name: 'SQL files', extensions: ['sql'] }] }
    const selected = BrowserWindow.getFocusedWindow() ? await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, options) : await dialog.showOpenDialog(options)
    if (selected.canceled) return []
    for (const path of selected.filePaths) approvedFormatPaths.add(resolve(path))
    return selected.filePaths
  })
  ipcMain.handle('database-tools:format-run', (_event, paths: string[], backup: boolean, recursive: boolean, formatOptions: import('../../modules/editor/formatter.js').SqlFormatOptions) => { if (!paths.length || paths.some((path) => !approvedFormatPaths.has(resolve(path)))) throw new Error('Select files or folders with the native file dialog before formatting.'); return formatSqlFiles({ paths, backup, recursive, formatOptions }) })
  ipcMain.handle('database-tools:format-preview', (_event, paths: string[], recursive: boolean, formatOptions: import('../../modules/editor/formatter.js').SqlFormatOptions) => { if (!paths.length || paths.some((path) => !approvedFormatPaths.has(resolve(path)))) throw new Error('Select files or folders with the native file dialog before previewing.'); return previewSqlFiles({ paths, recursive, formatOptions }) })
  ipcMain.handle('database-tools:large-select', async () => {
    const options = { title: 'Select large SQL script', properties: ['openFile'] as ('openFile')[], filters: [{ name: 'SQL files', extensions: ['sql'] }] }
    const selected = BrowserWindow.getFocusedWindow() ? await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, options) : await dialog.showOpenDialog(options)
    const path = selected.filePaths[0]
    if (selected.canceled || !path) return null
    const info = await stat(path)
    if (!info.isFile()) throw new Error('Selected script is not a file.')
    approvedLargeScripts.add(resolve(path))
    return { path, name: path.split(/[\\/]/).at(-1) ?? path, size: info.size }
  })
  ipcMain.handle('database-tools:large-run', async (event, connectionId: string, database: string, path: string, encoding: ScriptEncoding, requestId: string) => {
    if (!connectionId || database.length > 128 || database.includes('\0')) throw new Error('Invalid connection or database selection.')
    if (!approvedLargeScripts.has(resolve(path))) throw new Error('Select a script with the native file dialog before execution.')
    if (runningScripts.has(requestId)) throw new Error('Script execution request already exists.')
    const controller = new AbortController(); runningScripts.set(requestId, controller)
    try {
      if (database) await driver.setDatabase(connectionId, database)
      const report = await executeLargeScript({ path, encoding, databaseSelected: Boolean(database), signal: controller.signal, execute: (sql) => driver.executeSql(connectionId, sql, `${requestId}:${Date.now()}`).then(() => undefined), onProgress: (progress) => event.sender.send('database-tools:large-progress', { requestId, progress }), onError: async (error) => new Promise<ScriptErrorAction>((resolve) => { scriptErrorResolvers.set(requestId, resolve); event.sender.send('database-tools:large-error', { requestId, error }); controller.signal.addEventListener('abort', () => { scriptErrorResolvers.delete(requestId); resolve('stop') }, { once: true }) }) })
      return { statements: report.statements, failures: report.errors, skipped: report.skipped, stopped: report.stopped }
    } finally { runningScripts.delete(requestId) }
  })
  ipcMain.handle('database-tools:large-cancel', (_event, requestId: string) => { runningScripts.get(requestId)?.abort() })
  ipcMain.handle('database-tools:large-error-action', (_event, requestId: string, action: ScriptErrorAction) => { const resolve = scriptErrorResolvers.get(requestId); if (resolve) { scriptErrorResolvers.delete(requestId); resolve(action) } })
  ipcMain.handle('database-tools:maintenance', async (_event, connectionId: string, database: string, operation: 'ANALYZE' | 'OPTIMIZE' | 'CHECK' | 'REPAIR' | 'CHECKSUM', tables: string[]) => {
    assertTarget(connectionId, database)
    if (!['ANALYZE', 'OPTIMIZE', 'CHECK', 'REPAIR', 'CHECKSUM'].includes(operation) || !Array.isArray(tables) || !tables.length || tables.length > 500) throw new Error('Invalid table maintenance request.')
    const allowed = new Set((await driver.listDatabaseObjects(connectionId, database)).filter((item) => item.kind === 'table').map((item) => item.name))
    const engineRows = await driver.queryRows(connectionId, 'SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [database])
    const engines = new Map(engineRows.map((row) => [String((row as Record<string, unknown>).TABLE_NAME), String((row as Record<string, unknown>).ENGINE ?? '').toUpperCase()]))
    const results: Array<{ table: string; status: string; message: string }> = []
    for (const table of tables) {
      if (!allowed.has(table)) { results.push({ table, status: 'ERROR', message: 'Table is not in the selected database.' }); continue }
      if (operation === 'REPAIR' && !['MYISAM', 'ARCHIVE', 'CSV'].includes(engines.get(table) ?? '')) { results.push({ table, status: 'SKIPPED', message: `REPAIR is unavailable for the ${engines.get(table) || 'unknown'} engine.` }); continue }
      try {
        const rows = await driver.queryRows(connectionId, `${operation} TABLE ${quote(database)}.${quote(table)}`)
        const result = rows[0] as Record<string, unknown> | undefined
        results.push({ table, status: String(result?.Msg_type ?? 'status'), message: String(result?.Msg_text ?? 'Completed.') })
      } catch (error) { results.push({ table, status: 'ERROR', message: error instanceof Error ? error.message.slice(0, 1000) : 'Maintenance operation failed.' }) }
    }
    return results
  })
  const schedules = new BackupScheduleStore(join(userDataDir, 'backup-schedules.json'))
  ipcMain.handle('database-tools:schedule:list', () => schedules.list())
  ipcMain.handle('database-tools:schedule:save', (_event, schedule: import('../../modules/database-tools/scheduler.js').BackupSchedule) => schedules.save(schedule))
  ipcMain.handle('database-tools:schedule:delete', (_event, id: string) => schedules.delete(id))
  let scheduleRunning = false
  const runSchedules = async (): Promise<void> => {
    if (scheduleRunning) return
    scheduleRunning = true
    try {
      const now = new Date(); const minute = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      for (const schedule of await schedules.list()) {
        let due = false
        try { due = schedule.enabled && schedule.lastRunMinute !== minute && cronMatches(schedule.cron, now) }
        catch (error) { console.error('Invalid scheduled backup configuration:', error instanceof Error ? error.message : 'unknown error'); continue }
        if (!due) continue
        const updated = { ...schedule, lastRunMinute: minute }
        await schedules.update(updated)
        let connectionId: string | undefined
        try {
          const record = (await deps.connectionsStore.list()).find((item) => item.id === schedule.connectionId)
          if (!record) throw new Error('Scheduled backup connection no longer exists.')
          connectionId = await driver.connect(await deps.resolveConnectionConfig(record))
          await driver.setDatabase(connectionId, schedule.database)
          const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId!, sql, parameters), schedule.database)
          const backup = await createBackupSql(schema, true, async (table, offset, limit) => driver.queryRows(connectionId!, `SELECT * FROM ${quote(schedule.database)}.${quote(table)} LIMIT ${limit} OFFSET ${offset}`))
          await mkdir(schedule.directory, { recursive: true, mode: 0o700 })
          const destination = scheduledBackupPath(schedule.directory, schedule.database, now)
          await writeFile(destination, backup.sql, { encoding: 'utf8', mode: 0o600 }); await chmod(destination, 0o600)
          const prefix = `${schedule.database.replace(/[^A-Za-z0-9_.-]/g, '_')}-`
          const files = (await readdir(schedule.directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.sql'))
          const ordered = await Promise.all(files.map(async (entry) => ({ path: join(schedule.directory, entry.name), mtime: (await stat(join(schedule.directory, entry.name))).mtimeMs })))
          ordered.sort((a, b) => b.mtime - a.mtime)
          const { unlink } = await import('node:fs/promises')
          await Promise.all(ordered.slice(schedule.retention).map((item) => unlink(item.path)))
        } catch (error) {
          console.error('Scheduled backup failed:', error instanceof Error ? error.message : 'unknown error')
        } finally { if (connectionId) await driver.disconnect(connectionId) }
      }
    } finally { scheduleRunning = false }
  }
  const scheduleRun = setInterval(() => { void runSchedules() }, 60_000)
  scheduleRun.unref()
  void runSchedules()
  ipcMain.handle('database-tools:search', async (_event, connectionId: string, database: string, query: string, options: { names: boolean; definitions: boolean; data?: boolean; objectKinds?: string[]; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }) => {
    assertTarget(connectionId, database)
    if (query.length > 256 || !options || typeof options.names !== 'boolean' || typeof options.definitions !== 'boolean' || (options.data !== undefined && typeof options.data !== 'boolean')) throw new Error('Invalid object search options.')
    const allObjects = await driver.listDatabaseObjects(connectionId, database)
    const allowedKinds = new Set(['table', 'view', 'procedure', 'function', 'trigger', 'event'])
    const kinds = options.objectKinds?.length ? options.objectKinds.filter((kind) => allowedKinds.has(kind)) : [...allowedKinds]
    const objects = allObjects.filter((object) => kinds.includes(object.kind))
    const definitions = new Map<string, string>()
    if (options?.definitions) for (const object of objects) {
      try { definitions.set(`${object.kind}:${object.name}`, await driver.showCreateObject(connectionId, database, object)) } catch { /* Search by name still works if metadata privileges are limited. */ }
    }
    const hits = searchObjectText(objects, definitions, query, options)
    if (options.data) {
      for (const object of objects.filter((item) => item.kind === 'table' || item.kind === 'view').slice(0, 200)) {
        try {
          const rows = await driver.queryRows(connectionId, `SELECT * FROM ${quote(database)}.${quote(object.name)} LIMIT 200`)
          const lines = rows.map((row) => Object.entries(row).map(([column, value]) => `${column}: ${value == null ? '' : String(value)}`).join(' | '))
          const found = searchObjectText([object], new Map([[`${object.kind}:${object.name}`, lines.join('\n')]]), query, { ...options, names: false, definitions: true }).map((hit) => ({ ...hit, field: 'data' as const }))
          hits.push(...found)
        } catch { /* A table that is not readable does not prevent searches in other objects. */ }
      }
    }
    return hits.slice(0, 10_000)
  })
  ipcMain.handle('database-tools:invalid', async (_event, connectionId: string, database: string) => {
    assertTarget(connectionId, database)
    const objects: DatabaseObject[] = (await driver.listDatabaseObjects(connectionId, database)).filter((item) => item.kind !== 'table')
    const definition = (object: DatabaseObject): Promise<string> => driver.showCreateObject(connectionId, database, object)
    const validate = async (object: DatabaseObject): Promise<void> => {
      if (object.kind === 'view') await driver.queryRows(connectionId, `SELECT * FROM ${quote(database)}.${quote(object.name)} LIMIT 0`)
    }
    return findInvalidObjects(objects, definition, validate)
  })
  ipcMain.handle('database-tools:backup', async (_event, connectionId: string, database: string, includeData: boolean) => {
    assertTarget(connectionId, database)
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), database)
    const backup = await createBackupSql(schema, includeData, async (table, offset, limit) => driver.queryRows(connectionId, `SELECT * FROM ${quote(database)}.${quote(table)} LIMIT ${limit} OFFSET ${offset}`))
    const options = { title: 'Backup Database...', defaultPath: `${database}-${new Date().toISOString().slice(0, 10)}.sql`, filters: [{ name: 'SQL backup', extensions: ['sql'] }] }
    const window = BrowserWindow.getFocusedWindow(); const selected = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (selected.canceled || !selected.filePath) return null
    await writeFile(selected.filePath, backup.sql, { encoding: 'utf8', mode: 0o600 })
    await chmod(selected.filePath, 0o600)
    return { path: selected.filePath, rows: backup.rows, skipped: backup.skipped }
  })
  ipcMain.handle('database-tools:select-backup', async () => {
    const options = { title: 'Restore Database...', properties: ['openFile'] as ('openFile')[], filters: [{ name: 'SQL backup', extensions: ['sql'] }] }
    const window = BrowserWindow.getFocusedWindow(); const selected = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    const filePath = selected.filePaths[0]
    if (selected.canceled || !filePath) return null
    if ((await stat(filePath)).size > 50 * 1024 * 1024) throw new Error('Restore script exceeds the 50 MB safety limit.')
    return { name: filePath.split(/[\\/]/).at(-1) ?? filePath, contents: await readFile(filePath, 'utf8') }
  })
  ipcMain.handle('database-tools:restore', async (_event, connectionId: string, database: string, confirmation: string, script: string, continueOnError = false) => {
    assertTarget(connectionId, database)
    if (confirmation !== database) throw new Error(`Restore requires typing the destination database name: ${database}.`)
    await driver.setDatabase(connectionId, database)
    return restoreBackup(database, confirmation, script, async (statement) => { await driver.executeSql(connectionId, statement) }, continueOnError)
  })
  ipcMain.handle('database-tools:copy', async (_event, sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, confirmation: string, includeData: boolean, dropIfExists = false) => {
    assertTarget(sourceConnectionId, sourceDatabase); assertTarget(targetConnectionId, targetDatabase)
    if (sourceConnectionId === targetConnectionId && sourceDatabase === targetDatabase) throw new Error('Source and target databases must be different.')
    const requiredConfirmation = dropIfExists ? `DROP ${targetDatabase}` : targetDatabase
    if (confirmation !== requiredConfirmation) throw new Error(`Copy requires typing this exact target confirmation: ${requiredConfirmation}.`)
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(sourceConnectionId, sql, parameters), sourceDatabase)
    const backup = await createBackupSql(schema, includeData, async (table, offset, limit) => driver.queryRows(sourceConnectionId, `SELECT * FROM ${quote(sourceDatabase)}.${quote(table)} LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(targetConnectionId, targetDatabase)
    if (dropIfExists) {
      const objects = await driver.listDatabaseObjects(targetConnectionId, targetDatabase)
      const order = ['trigger', 'event', 'procedure', 'function', 'view', 'table'] as const
      await driver.executeSql(targetConnectionId, 'SET FOREIGN_KEY_CHECKS=0')
      try {
        for (const kind of order) for (const object of objects.filter((item) => item.kind === kind)) {
          await driver.executeSql(targetConnectionId, `DROP ${kind.toUpperCase()} IF EXISTS ${quote(targetDatabase)}.${quote(object.name)}`)
        }
      } finally { await driver.executeSql(targetConnectionId, 'SET FOREIGN_KEY_CHECKS=1') }
    }
    const report = await restoreBackup(targetDatabase, targetDatabase, backup.sql, async (statement) => { await driver.executeSql(targetConnectionId, statement) })
    return { ...report, rows: backup.rows, skipped: backup.skipped }
  })
}
