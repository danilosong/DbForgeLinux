import { ipcRenderer } from 'electron'
import type { SchemaCompareApi } from '../../shared/contracts/schema-compare.js'
export const schemaCompareApi: SchemaCompareApi = {
  compareSchemas: (sourceId, sourceDb, targetId, targetDb, includeDrops) => ipcRenderer.invoke('schema-compare:compare', sourceId, sourceDb, targetId, targetDb, includeDrops),
  synchronizeSchema: (targetId, targetDb, script, confirmed) => ipcRenderer.invoke('schema-compare:synchronize', targetId, targetDb, script, confirmed)
}
