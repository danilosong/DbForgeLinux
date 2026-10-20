import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { chmod, readFile, stat, writeFile } from 'node:fs/promises'
import { inspectDatabase } from '../../modules/schema/index.js'
import { buildDiagram, deserializeDiagram, serializeDiagram, VirtualRelationStore, type ERDiagram } from '../../modules/er-diagram/index.js'
import type { IpcDeps } from './registry.js'

export function registerERDiagramIpc({ driver, userDataDir }: IpcDeps): void {
  const store = new VirtualRelationStore(`${userDataDir}/er-diagram`)
  ipcMain.handle('er-diagram:load', async (_event, activeConnectionId: string, database: string, connectionId: string) => {
    if (!activeConnectionId || !connectionId || !database.trim()) throw new Error('Selecione uma conexão e um database.')
    const [schema, relations] = await Promise.all([
      inspectDatabase((sql, parameters) => driver.queryRows(activeConnectionId, sql, parameters), database),
      store.read(connectionId, database)
    ])
    return buildDiagram(schema, connectionId, relations)
  })
  ipcMain.handle('er-diagram:save-relations', async (_event, connectionId: string, database: string, relations: ERDiagram['virtualRelations']) => {
    if (!connectionId || !database || !Array.isArray(relations)) throw new Error('Dados inválidos para salvar relações virtuais.')
    await store.write(connectionId, database, relations)
    return true
  })
  ipcMain.handle('er-diagram:save-file', async (_event, diagram: ERDiagram) => {
    const options = { title: 'Save Database Diagram', defaultPath: `${diagram.database}.dbd`, filters: [{ name: 'Database Diagram', extensions: ['dbd', 'json'] }] }
    const window = BrowserWindow.getFocusedWindow()
    const target = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (target.canceled || !target.filePath) return null
    await writeFile(target.filePath, serializeDiagram(diagram), { encoding: 'utf8', mode: 0o600 })
    await chmod(target.filePath, 0o600)
    return target.filePath
  })
  ipcMain.handle('er-diagram:open-file', async () => {
    const options: OpenDialogOptions = { title: 'Open Database Diagram', properties: ['openFile'], filters: [{ name: 'Database Diagram', extensions: ['dbd', 'json'] }] }
    const window = BrowserWindow.getFocusedWindow()
    const selected = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (selected.canceled || !selected.filePaths[0]) return null
    if ((await stat(selected.filePaths[0])).size > 20 * 1024 * 1024) throw new Error('Diagram file exceeds the 20 MB safety limit.')
    return deserializeDiagram(await readFile(selected.filePaths[0], 'utf8'))
  })
}
