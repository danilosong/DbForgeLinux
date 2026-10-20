import { ipcRenderer } from 'electron'
import type { DataCompareApi } from '../../shared/contracts/data-compare.js'
export const dataCompareApi: DataCompareApi = {
  compareData: (sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns) => ipcRenderer.invoke('data-compare:compare', sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns),
  synchronizeData: (sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes, confirmed) => ipcRenderer.invoke('data-compare:synchronize', sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes, confirmed)
}
