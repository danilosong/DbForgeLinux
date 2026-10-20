import { ipcRenderer } from 'electron'
import type { DatabaseToolsApi } from '../../shared/contracts/database-tools.js'
export const databaseToolsApi: DatabaseToolsApi = {
  searchDatabaseObjects: (connectionId, database, query, options) => ipcRenderer.invoke('database-tools:search', connectionId, database, query, options),
  findInvalidDatabaseObjects: (connectionId, database) => ipcRenderer.invoke('database-tools:invalid', connectionId, database),
  backupDatabase: (connectionId, database, includeData) => ipcRenderer.invoke('database-tools:backup', connectionId, database, includeData),
  selectBackupToRestore: () => ipcRenderer.invoke('database-tools:select-backup'),
  restoreDatabaseBackup: (connectionId, database, confirmation, script, continueOnError) => ipcRenderer.invoke('database-tools:restore', connectionId, database, confirmation, script, continueOnError),
  copyDatabase: (sourceConnectionId, sourceDatabase, targetConnectionId, targetDatabase, confirmation, includeData) => ipcRenderer.invoke('database-tools:copy', sourceConnectionId, sourceDatabase, targetConnectionId, targetDatabase, confirmation, includeData)
}
