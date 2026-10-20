import type { QueryResult } from '../../shared/contracts.js'

export interface DriverConnectionConfig {
  host: string
  port: number
  user: string
  password?: string
  database?: string
}

export interface DbDriver {
  testConnection(config: DriverConnectionConfig): Promise<{ serverVersion: string }>
  connect(config: DriverConnectionConfig): Promise<string>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string): Promise<QueryResult[]>
}
