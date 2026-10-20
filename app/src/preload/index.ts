import { contextBridge, ipcRenderer } from 'electron'
import type { DbForgeApi } from '../shared/contracts.js'

const api: DbForgeApi = {
  testConnection: (config) => ipcRenderer.invoke('db:test', config),
  connect: (config) => ipcRenderer.invoke('db:connect', config),
  disconnect: (id) => ipcRenderer.invoke('db:disconnect', id),
  listDatabases: (id) => ipcRenderer.invoke('db:databases', id),
  listTables: (id, database) => ipcRenderer.invoke('db:tables', id, database),
  executeSql: (id, sql) => ipcRenderer.invoke('db:execute', id, sql),
  savePassword: (key, password) => ipcRenderer.invoke('vault:save', key, password)
}

contextBridge.exposeInMainWorld('dbforge', api)
