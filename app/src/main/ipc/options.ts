import { BrowserWindow, dialog, ipcMain } from 'electron'
import { chmod, writeFile } from 'node:fs/promises'
import { importSettingsFile, mergeSettings, SettingsStore } from '../../modules/options/index.js'

export function registerOptionsIpc(store: SettingsStore): void {
  ipcMain.handle('options:load', () => store.load())
  ipcMain.handle('options:save', (_event, settings: unknown) => store.save(settings))
  ipcMain.handle('options:reset', () => store.reset())
  ipcMain.handle('options:export', async (_event, settings: unknown) => {
    const value = mergeSettings(settings)
    const options = { title: 'Export Settings', defaultPath: 'dbforgelinux-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] }
    const window = BrowserWindow.getFocusedWindow(); const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await chmod(result.filePath, 0o600)
    return result.filePath
  })
  ipcMain.handle('options:import', async () => {
    const options = { title: 'Import Settings', properties: ['openFile'] as ('openFile')[], filters: [{ name: 'JSON', extensions: ['json'] }] }
    const window = BrowserWindow.getFocusedWindow(); const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return importSettingsFile(result.filePaths[0], store)
  })
}
