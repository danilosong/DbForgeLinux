import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { MysqlDriver } from './db/MysqlDriver.js'
import { ConnectionsStore } from './connections/ConnectionsStore.js'
import type { DriverConnectionConfig } from './db/DbDriver.js'
import { PasswordVault } from './security/PasswordVault.js'
import type { ConnectionRecord } from '../shared/contracts.js'

const driver = new MysqlDriver()
let vault: PasswordVault
let connectionsStore: ConnectionsStore

function registerIpc(): void {
  ipcMain.handle('connections:list', () => connectionsStore.list())
  ipcMain.handle('connections:save', async (_event, record: ConnectionRecord) => {
    const old = (await connectionsStore.list()).find((item) => item.id === record.id)
    await connectionsStore.save(record)
    if (old) {
      const inUse = new Set((await connectionsStore.list()).flatMap(secretRefs))
      for (const reference of secretRefs(old)) if (!inUse.has(reference)) await vault.delete(reference)
    }
  })
  ipcMain.handle('connections:delete', async (_event, id: string) => {
    const records = await connectionsStore.list()
    const removed = records.find((record) => record.id === id)
    await connectionsStore.delete(id)
    if (removed) {
      const inUse = new Set((await connectionsStore.list()).flatMap(secretRefs))
      for (const reference of secretRefs(removed)) if (!inUse.has(reference)) await vault.delete(reference)
    }
  })
  ipcMain.handle('db:test', async (_event, record: ConnectionRecord) => driver.testConnection(await resolveConnectionConfig(record)))
  ipcMain.handle('db:connect', async (_event, record: ConnectionRecord) => {
    const id = await driver.connect(await resolveConnectionConfig(record))
    return {
      id,
      recordId: record.id,
      name: record.name,
      host: record.host,
      port: record.port,
      user: record.user,
      database: record.database,
      environment: record.environment,
      color: record.color
    }
  })
  ipcMain.handle('db:disconnect', (_event, id: string) => driver.disconnect(id))
  ipcMain.handle('db:databases', (_event, id: string) => driver.listDatabases(id))
  ipcMain.handle('db:tables', (_event, id: string, database: string) => driver.listTables(id, database))
  ipcMain.handle('db:execute', (_event, id: string, sql: string, executionId?: string) => driver.executeSql(id, sql, executionId))
  ipcMain.handle('db:cancel', (_event, id: string, executionId: string) => driver.cancelQuery(id, executionId))
  ipcMain.handle('db:objects', (_event, id: string, database: string) => driver.listDatabaseObjects(id, database))
  ipcMain.handle('db:show-create', (_event, id: string, database: string, object) => driver.showCreateObject(id, database, object))
  ipcMain.handle('db:set-database', (_event, id: string, database: string) => driver.setDatabase(id, database))
  ipcMain.handle('db:transaction-begin', (_event, id: string) => driver.beginTransaction(id))
  ipcMain.handle('db:transaction-commit', (_event, id: string) => driver.commitTransaction(id))
  ipcMain.handle('db:transaction-rollback', (_event, id: string) => driver.rollbackTransaction(id))
  ipcMain.handle('file:open-sql', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? undefined
    const options: OpenDialogOptions = { properties: ['openFile'], filters: [{ name: 'SQL', extensions: ['sql'] }, { name: 'All files', extensions: ['*'] }] }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return { path: result.filePaths[0], contents: await readFile(result.filePaths[0], 'utf8') }
  })
  ipcMain.handle('file:save-sql', async (_event, path: string | undefined, contents: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? undefined
    let destination = path
    if (!destination) {
      const options: SaveDialogOptions = { defaultPath: 'query.sql', filters: [{ name: 'SQL', extensions: ['sql'] }] }
      const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      destination = result.filePath
    }
    await writeFile(destination, contents, { encoding: 'utf8', mode: 0o600 })
    return destination
  })
  ipcMain.handle('vault:save', (_event, key: string, password: string) => vault.save(key, password))
  ipcMain.handle('vault:delete', (_event, key: string) => vault.delete(key))
}

async function resolveConnectionConfig(record: ConnectionRecord): Promise<DriverConnectionConfig> {
  const [password, sshPassword, sshPassphrase, httpPassword, proxyPassword] = await Promise.all([
    resolveSecret(record.passwordRef),
    resolveSecret(record.ssh.passwordRef),
    resolveSecret(record.ssh.passphraseRef),
    resolveSecret(record.http.passwordRef),
    resolveSecret(record.http.proxyPasswordRef)
  ])
  return {
    ...record,
    password: password ?? undefined,
    ssh: { ...record.ssh, password: sshPassword ?? undefined, passphrase: sshPassphrase ?? undefined },
    http: { ...record.http, password: httpPassword ?? undefined, proxyPassword: proxyPassword ?? undefined }
  }
}

function resolveSecret(reference: string | undefined): Promise<string | null> {
  return reference ? vault.get(reference) : Promise.resolve(null)
}

function secretRefs(record: ConnectionRecord): string[] {
  return [
    record.passwordRef,
    record.ssh.passwordRef,
    record.ssh.passphraseRef,
    record.http.passwordRef,
    record.http.proxyPasswordRef
  ].filter((reference): reference is string => Boolean(reference))
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
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
  connectionsStore = new ConnectionsStore(join(app.getPath('userData'), 'connections.json'))
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
