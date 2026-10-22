import { BrowserWindow, dialog, ipcMain } from 'electron'
import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IpcDeps } from './registry.js'
import { createTable, diffTables } from '../../modules/schema/ddl.js'
import { SchemaUpdateStore, splitSchemaScript } from '../../modules/schema-update/index.js'
import { UserSnippetStore } from '../../modules/editor/snippetStore.js'
import type { SchemaUpdateInput } from '../../modules/schema-update/index.js'
import type { UserSnippet } from '../../modules/editor/snippetStore.js'
import type { TableModel } from '../../modules/schema/model.js'
import { readBoundedRegularFile } from '../../modules/security/boundedFile.js'

export function registerExtraToolsIpc(deps: IpcDeps): void {
  const { driver, userDataDir } = deps
  const updates = new SchemaUpdateStore(join(userDataDir, 'schema-updates.json'))
  const snippets = new UserSnippetStore(join(userDataDir, 'snippets', 'user.json'))
  ipcMain.handle('schema-update:list', () => updates.list())
  ipcMain.handle('schema-update:queue', (_event, input: SchemaUpdateInput) => updates.add(input))
  ipcMain.handle('schema-update:queue-table', async (_event, connectionId: string, database: string, original: TableModel | null, target: TableModel) => {
    if (!connectionId || !database.trim() || target.kind !== 'table') throw new Error('Table schema update is invalid.')
    const statements = original ? diffTables(original, target, database, true) : [createTable(target, database)]
    if (!statements.length) throw new Error('There are no pending table changes to queue.')
    return updates.add({ connectionId, database, source: `Table Designer · ${target.name}`, script: statements.join('\n') })
  })
  ipcMain.handle('schema-update:remove', async (_event, ids: string[]) => updates.remove(ids))
  ipcMain.handle('schema-update:execute', async (_event, ids: string[], confirmed: boolean) => {
    if (confirmed !== true) throw new Error('Confirm the schema update script before execution.')
    const selected = (await updates.list()).filter((item) => ids.includes(item.id))
    if (!selected.length) throw new Error('Select at least one queued schema change.')
    if (new Set(selected.map((item) => `${item.connectionId}\0${item.database}`)).size !== 1) throw new Error('Execute changes for one target database at a time.')
    const savedConnectionId = selected[0]!.connectionId; const database = selected[0]!.database
    const statements = selected.flatMap((item) => splitSchemaScript(item.script))
    const errors: string[] = []; let succeeded = 0
    const record = (await deps.connectionsStore.list()).find((item) => item.id === savedConnectionId)
    if (!record) throw new Error('The queued target connection no longer exists.')
    const connectionId = await driver.connect(await deps.resolveConnectionConfig(record))
    try {
      await driver.setDatabase(connectionId, database)
      await driver.withSplitterCompatibleSqlMode(connectionId, async (execute) => {
        for (const statement of statements) {
          try { await execute(statement); succeeded++ }
          catch (error) { errors.push(error instanceof Error ? error.message : 'Schema update failed.'); break }
        }
      })
    } finally { await driver.disconnect(connectionId) }
    if (!errors.length) await updates.remove(selected.map((item) => item.id))
    return { succeeded, failed: errors.length, errors }
  })

  ipcMain.handle('snippets:list', () => snippets.list())
  ipcMain.handle('snippets:save', (_event, value: Partial<UserSnippet>) => snippets.save(value))
  ipcMain.handle('snippets:delete', (_event, id: string) => snippets.delete(id))
  ipcMain.handle('snippets:import', async (_event, locale: 'en' | 'pt-BR') => {
    const portuguese = locale === 'pt-BR'
    const options = { title: portuguese ? 'Importar trechos SQL' : 'Import SQL snippets', properties: ['openFile'] as ('openFile')[], filters: [{ name: portuguese ? 'Arquivo JSON de trechos' : 'Snippet JSON', extensions: ['json', 'snippet'] }] }
    const window = BrowserWindow.getFocusedWindow(); const selected = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    const path = selected.filePaths[0]
    if (selected.canceled || !path) return null
    const source = await readBoundedRegularFile(path, 5 * 1024 * 1024)
    const count = await snippets.import(source.toString('utf8')); return { count }
  })
  ipcMain.handle('snippets:export', async (_event, locale: 'en' | 'pt-BR') => {
    const portuguese = locale === 'pt-BR'
    const options = { title: portuguese ? 'Exportar trechos SQL' : 'Export SQL snippets', defaultPath: 'tuxsql-snippets.json', filters: [{ name: portuguese ? 'Arquivo JSON de trechos' : 'Snippet JSON', extensions: ['json'] }] }
    const window = BrowserWindow.getFocusedWindow(); const selected = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (selected.canceled || !selected.filePath) return null
    await writeFile(selected.filePath, await snippets.export(), { encoding: 'utf8', mode: 0o600 }); await chmod(selected.filePath, 0o600); return selected.filePath
  })
}
