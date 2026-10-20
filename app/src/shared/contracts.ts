export interface ConnectionConfig {
  host: string
  port: number
  user: string
  passwordRef?: string
  database?: string
}

export interface ConnectionSummary {
  id: string
  host: string
  port: number
  user: string
  database?: string
}

export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  affectedRows: number
  insertId: number
  warningStatus: number
}

export interface DbForgeApi {
  testConnection(config: ConnectionConfig): Promise<{ serverVersion: string }>
  connect(config: ConnectionConfig): Promise<ConnectionSummary>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string): Promise<QueryResult[]>
  savePassword(key: string, password: string): Promise<void>
}

declare global {
  interface Window { dbforge: DbForgeApi }
}
