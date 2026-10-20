import { contextBridge, ipcRenderer } from 'electron'
import type { DbForgeApi } from '../shared/contracts.js'

const api: DbForgeApi = {
  getConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (record) => ipcRenderer.invoke('connections:save', record),
  deleteConnection: (id) => ipcRenderer.invoke('connections:delete', id),
  savePassword: (key, password) => ipcRenderer.invoke('vault:save', key, password),
  deletePassword: (key) => ipcRenderer.invoke('vault:delete', key),
  testConnection: (config) => ipcRenderer.invoke('db:test', config),
  connect: (config) => ipcRenderer.invoke('db:connect', config),
  disconnect: (id) => ipcRenderer.invoke('db:disconnect', id),
  listDatabases: (id) => ipcRenderer.invoke('db:databases', id),
  listTables: (id, database) => ipcRenderer.invoke('db:tables', id, database),
  executeSql: (id, sql) => ipcRenderer.invoke('db:execute', id, sql)
}

contextBridge.exposeInMainWorld('dbforge', api)
