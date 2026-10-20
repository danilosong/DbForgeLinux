import type { ConnectionConfig, QueryResult } from '../../shared/contracts.js'

export interface DbDriver {
  testConnection(config: ConnectionConfig): Promise<{ serverVersion: string }>
  connect(config: ConnectionConfig): Promise<string>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string): Promise<QueryResult[]>
}
