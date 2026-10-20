import { ipcMain } from 'electron'
import type { SqlExecutionHistoryEntry, SqlExecutionHistoryQuery } from '../../shared/contracts/history.js'
import type { SqlExecutionHistoryStore } from '../history/SqlExecutionHistoryStore.js'

export function registerHistoryIpc(store: SqlExecutionHistoryStore): void {
  ipcMain.handle('history:list', (_event, query?: SqlExecutionHistoryQuery) => store.list(query))
  ipcMain.handle('history:record', (_event, entry: SqlExecutionHistoryEntry) => store.record(entry))
}
