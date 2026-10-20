export interface SqlExecutionHistoryEntry {
  id: string
  timestamp: string
  connection: string
  database?: string
  sql: string
  elapsedMs: number
  success: boolean
  rowCount?: number
  error?: string
}

export interface SqlExecutionHistoryQuery { search?: string; limit?: number }

export type HistoryApi = {
  listSqlExecutionHistory(query?: SqlExecutionHistoryQuery): Promise<SqlExecutionHistoryEntry[]>
  recordSqlExecutionHistory(entry: SqlExecutionHistoryEntry): Promise<void>
}

