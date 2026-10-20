import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { createBackupSql, restoreBackup } from '../../modules/database-tools/backup.js'
import { findInvalidObjects, searchObjectText } from '../../modules/database-tools/index.js'
import { inspectDatabase } from '../../modules/schema/index.js'
import type { DatabaseObject } from '../../shared/contracts/sql.js'
import type { IpcDeps } from './registry.js'

const quote = (identifier: string): string => `\`${identifier.replaceAll('`', '``')}\``
function assertTarget(connectionId: string, database: string): void { if (!connectionId || !database.trim()) throw new Error('Selecione uma conexão e um database.') }

export function registerDatabaseToolsIpc({ driver }: IpcDeps): void {
  ipcMain.handle('database-tools:search', async (_event, connectionId: string, database: string, query: string, options: { names: boolean; definitions: boolean; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }) => {
    assertTarget(connectionId, database)
    const objects = await driver.listDatabaseObjects(connectionId, database)
    const definitions = new Map<string, string>()
    if (options?.definitions) for (const object of objects) {
      try { definitions.set(`${object.kind}:${object.name}`, await driver.showCreateObject(connectionId, database, object)) } catch { /* Search by name still works if metadata privileges are limited. */ }
    }
    return searchObjectText(objects, definitions, query, options)
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
  ipcMain.handle('database-tools:copy', async (_event, sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, confirmation: string, includeData: boolean) => {
    assertTarget(sourceConnectionId, sourceDatabase); assertTarget(targetConnectionId, targetDatabase)
    if (sourceConnectionId === targetConnectionId && sourceDatabase === targetDatabase) throw new Error('Source and target databases must be different.')
    if (confirmation !== targetDatabase) throw new Error(`Copy requires typing the target database name: ${targetDatabase}.`)
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(sourceConnectionId, sql, parameters), sourceDatabase)
    const backup = await createBackupSql(schema, includeData, async (table, offset, limit) => driver.queryRows(sourceConnectionId, `SELECT * FROM ${quote(sourceDatabase)}.${quote(table)} LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(targetConnectionId, targetDatabase)
    const report = await restoreBackup(targetDatabase, confirmation, backup.sql, async (statement) => { await driver.executeSql(targetConnectionId, statement) })
    return { ...report, rows: backup.rows, skipped: backup.skipped }
  })
}
