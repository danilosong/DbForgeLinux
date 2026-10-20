import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { MysqlDriver } from './db/MysqlDriver.js'
import { PasswordVault } from './security/PasswordVault.js'
import type { ConnectionConfig } from '../shared/contracts.js'

const driver = new MysqlDriver()
let vault: PasswordVault

function registerIpc(): void {
  ipcMain.handle('db:test', (_event, config: ConnectionConfig) => driver.testConnection(config))
  ipcMain.handle('db:connect', async (_event, config: ConnectionConfig) => {
    const id = await driver.connect(config)
    return { id, host: config.host, port: config.port, user: config.user, database: config.database }
  })
  ipcMain.handle('db:disconnect', (_event, id: string) => driver.disconnect(id))
  ipcMain.handle('db:databases', (_event, id: string) => driver.listDatabases(id))
  ipcMain.handle('db:tables', (_event, id: string, database: string) => driver.listTables(id, database))
  ipcMain.handle('db:execute', (_event, id: string, sql: string) => driver.executeSql(id, sql))
  ipcMain.handle('vault:save', (_event, key: string, password: string) => vault.save(key, password))
  ipcMain.handle('vault:get', (_event, key: string) => vault.get(key))
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  vault = new PasswordVault(join(app.getPath('userData'), 'vault'))
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
