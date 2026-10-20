import { ipcRenderer } from 'electron'
import type { ExtraToolsApi } from '../../shared/contracts/extra-tools.js'

export const extraToolsApi: ExtraToolsApi = {
  listSchemaUpdates: () => ipcRenderer.invoke('schema-update:list'),
  queueSchemaUpdate: (input) => ipcRenderer.invoke('schema-update:queue', input),
  queueTableSchemaUpdate: (connectionId, database, original, target) => ipcRenderer.invoke('schema-update:queue-table', connectionId, database, original, target),
  removeSchemaUpdates: (ids) => ipcRenderer.invoke('schema-update:remove', ids),
  executeSchemaUpdates: (ids, confirmed) => ipcRenderer.invoke('schema-update:execute', ids, confirmed),
  listUserSnippets: () => ipcRenderer.invoke('snippets:list'),
  saveUserSnippet: (value) => ipcRenderer.invoke('snippets:save', value),
  deleteUserSnippet: (id) => ipcRenderer.invoke('snippets:delete', id),
  importUserSnippets: (locale) => ipcRenderer.invoke('snippets:import', locale),
  exportUserSnippets: (locale) => ipcRenderer.invoke('snippets:export', locale),
  getBackupSchedules: () => ipcRenderer.invoke('database-tools:schedule:list'),
  saveBackupSchedule: (schedule) => ipcRenderer.invoke('database-tools:schedule:save', schedule),
  deleteBackupSchedule: (id) => ipcRenderer.invoke('database-tools:schedule:delete', id)
}
