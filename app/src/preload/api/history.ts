import { ipcRenderer } from 'electron'
import type { HistoryApi } from '../../shared/contracts/history.js'

export const historyApi: HistoryApi = {
  listSqlExecutionHistory: (query) => ipcRenderer.invoke('history:list', query),
  recordSqlExecutionHistory: (entry) => ipcRenderer.invoke('history:record', entry)
}
