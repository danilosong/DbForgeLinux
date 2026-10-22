import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { IpcDeps } from './registry.js'
import { inspectDatabase, compareSchemas, assertSchemaUpdateScript } from '../../modules/schema/index.js'
import { parseSchemaSnapshot, readScriptsFolder, createSchemaSnapshot, assertDatabaseModel } from '../../modules/schema/offline.js'
import { readBoundedRegularFile } from '../../modules/security/boundedFile.js'

export function registerSchemaCompareIpc({ driver }: IpcDeps): void {
  ipcMain.handle('schema-compare:inspect', (_event, connectionId: string, database: string) => {
    if (!connectionId || !database) throw new Error('Select a database to inspect.')
    return inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), database)
  })
  ipcMain.handle('schema-compare:compare', async (_event, sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, includeDrops = false) => {
    if (!sourceConnectionId || !targetConnectionId || !sourceDatabase || !targetDatabase) throw new Error('Selecione origem e destino antes de comparar.')
    const [source, target] = await Promise.all([
      inspectDatabase((sql, parameters) => driver.queryRows(sourceConnectionId, sql, parameters), sourceDatabase),
      inspectDatabase((sql, parameters) => driver.queryRows(targetConnectionId, sql, parameters), targetDatabase)
    ])
    // compareSchemas emits a script that copies its second argument into the first.
    const result = compareSchemas(target, source, { includeDrops })
    return { ...result, source, target }
  })
  ipcMain.handle('schema-compare:load-offline', async (event, kind: 'Scripts Folder' | 'Snapshot') => {
    if (kind !== 'Scripts Folder' && kind !== 'Snapshot') throw new Error('Unsupported offline schema source.')
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = kind === 'Scripts Folder'
      ? { title: 'Select DDL scripts folder', properties: ['openDirectory'] as Array<'openDirectory'> }
      : { title: 'Open schema snapshot', properties: ['openFile'] as Array<'openFile'>, filters: [{ name: 'Schema snapshot', extensions: ['snap', 'json'] }] }
    const selection = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (selection.canceled || !selection.filePaths[0]) return null
    return kind === 'Scripts Folder' ? readScriptsFolder(selection.filePaths[0]) : parseSchemaSnapshot((await readBoundedRegularFile(selection.filePaths[0], 32 * 1024 * 1024)).toString('utf8'))
  })
  ipcMain.handle('schema-compare:compare-models', async (_event, source: unknown, target: unknown, includeDrops = false) => {
    assertDatabaseModel(source); assertDatabaseModel(target)
    const result = compareSchemas(target, source, { includeDrops: includeDrops === true })
    return { ...result, source, target }
  })
  ipcMain.handle('schema-compare:save-snapshot', async (_event, connectionId: string, database: string) => {
    if (!connectionId || !database) throw new Error('Select a database before creating its snapshot.')
    const selection = await dialog.showSaveDialog({ title: 'Save schema snapshot', defaultPath: `${database}.snap`, filters: [{ name: 'Schema snapshot', extensions: ['snap'] }] })
    if (selection.canceled || !selection.filePath) return false
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), database)
    await writeFile(selection.filePath, `${JSON.stringify(createSchemaSnapshot(schema), null, 2)}\n`, { mode: 0o600, flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
      await writeFile(selection.filePath!, `${JSON.stringify(createSchemaSnapshot(schema), null, 2)}\n`, { mode: 0o600 })
    })
    return true
  })
  ipcMain.handle('schema-compare:synchronize', async (_event, targetConnectionId: string, targetDatabase: string, script: string, confirmDestructive: boolean) => {
    if (!targetConnectionId || !targetDatabase || !script.trim()) throw new Error('Nenhum script selecionado para sincronização.')
    if (/\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(script) && !confirmDestructive) throw new Error('Confirme a possível perda de dados antes de sincronizar.')
    // The target is supplied separately so accidental USE statements cannot redirect writes.
    const statements = assertSchemaUpdateScript(script)
    const errors: string[] = []
    let succeeded = 0
    await driver.setDatabase(targetConnectionId, targetDatabase)
    await driver.withSplitterCompatibleSqlMode(targetConnectionId, async (execute) => {
      for (const statement of statements) {
        try {
          await execute(statement)
          succeeded++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Falha ao executar statement.')
          break
        }
      }
    })
    return { succeeded, failed: errors.length, errors }
  })
}
