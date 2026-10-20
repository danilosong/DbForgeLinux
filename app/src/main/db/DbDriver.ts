import type { ConnectionRecord, ConnectionTestResult, HttpTunnelConfig, QueryResult, SshConfig } from '../../shared/contracts.js'

export type SqlValue = string | number | bigint | boolean | Date | Buffer | null

export interface DbTransaction {
  execute(sql: string, values?: readonly SqlValue[]): Promise<{ affectedRows: number; insertId: number }>
}

export interface DriverConnectionConfig extends ConnectionRecord {
  password?: string
  ssh: SshConfig & { password?: string; passphrase?: string; privateKey?: Buffer }
  http: HttpTunnelConfig & { password?: string; proxyPassword?: string }
}

export interface DbDriver {
  testConnection(config: DriverConnectionConfig): Promise<ConnectionTestResult>
  connect(config: DriverConnectionConfig): Promise<string>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string): Promise<QueryResult[]>
  executeParameterized(connectionId: string, sql: string, values: readonly SqlValue[], signal?: AbortSignal): Promise<{ affectedRows: number; insertId: number }>
  streamRows(connectionId: string, sql: string, values?: readonly SqlValue[], signal?: AbortSignal): AsyncIterable<Record<string, unknown>>
  withTransaction<T>(connectionId: string, operation: (transaction: DbTransaction) => Promise<T>, signal?: AbortSignal): Promise<T>
  queryRows(connectionId: string, sql: string, parameters?: unknown[]): Promise<Array<Record<string, unknown>>>
}
