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
  executeSql: (id, sql, executionId) => ipcRenderer.invoke('db:execute', id, sql, executionId),
  cancelQuery: (id, executionId) => ipcRenderer.invoke('db:cancel', id, executionId),
  listDatabaseObjects: (id, database) => ipcRenderer.invoke('db:objects', id, database),
  showCreateObject: (id, database, object) => ipcRenderer.invoke('db:show-create', id, database, object),
  setDatabase: (id, database) => ipcRenderer.invoke('db:set-database', id, database),
  beginTransaction: (id) => ipcRenderer.invoke('db:transaction-begin', id),
  commitTransaction: (id) => ipcRenderer.invoke('db:transaction-commit', id),
  rollbackTransaction: (id) => ipcRenderer.invoke('db:transaction-rollback', id),
  openSqlFile: () => ipcRenderer.invoke('file:open-sql'),
  saveSqlFile: (path, contents) => ipcRenderer.invoke('file:save-sql', path, contents)
}

contextBridge.exposeInMainWorld('dbforge', api)
