import { ipcRenderer } from 'electron'
import type { SchemaCompareApi } from '../../shared/contracts/schema-compare.js'
export const schemaCompareApi: SchemaCompareApi = {
  inspectSchema: (connectionId, database) => ipcRenderer.invoke('schema-compare:inspect', connectionId, database),
  compareSchemas: (sourceId, sourceDb, targetId, targetDb, includeDrops) => ipcRenderer.invoke('schema-compare:compare', sourceId, sourceDb, targetId, targetDb, includeDrops),
  loadOfflineSchema: (kind) => ipcRenderer.invoke('schema-compare:load-offline', kind),
  compareSchemaModels: (source, target, includeDrops) => ipcRenderer.invoke('schema-compare:compare-models', source, target, includeDrops),
  saveSchemaSnapshot: (connectionId, database) => ipcRenderer.invoke('schema-compare:save-snapshot', connectionId, database),
  synchronizeSchema: (targetId, targetDb, script, confirmed) => ipcRenderer.invoke('schema-compare:synchronize', targetId, targetDb, script, confirmed)
}
