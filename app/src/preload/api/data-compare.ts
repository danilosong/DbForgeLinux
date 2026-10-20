import { ipcRenderer } from 'electron'
import type { DataCompareApi } from '../../shared/contracts/data-compare.js'
export const dataCompareApi: DataCompareApi = {
  compareData: (sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes) => ipcRenderer.invoke('data-compare:compare', sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes),
  synchronizeData: (sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes, confirmed, selectedKeys) => ipcRenderer.invoke('data-compare:synchronize', sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keys, columns, allowDeletes, confirmed, selectedKeys)
}
