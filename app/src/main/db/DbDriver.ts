import type { ConnectionRecord, ConnectionTestResult, DatabaseObject, HttpTunnelConfig, QueryResult, SshConfig, SshInteractiveChallenge } from '../../shared/contracts.js'

export type SqlValue = string | number | bigint | boolean | Date | Buffer | null

export interface DbTransaction {
  execute(sql: string, values?: readonly SqlValue[]): Promise<{ affectedRows: number; insertId: number; warnings?: string[] }>
}

export interface DriverConnectionConfig extends ConnectionRecord {
  password?: string
  ssh: SshConfig & { password?: string; passphrase?: string; privateKey?: Buffer; keyboardInteractivePrompt?: (challenge: SshInteractiveChallenge) => Promise<string[] | null> }
  http: HttpTunnelConfig & { password?: string; proxyPassword?: string }
}

export interface DbDriver {
  testConnection(config: DriverConnectionConfig): Promise<ConnectionTestResult>
  connect(config: DriverConnectionConfig): Promise<string>
  connectionSecurity?(connectionId: string): { tlsVersion?: string; tlsVerified: boolean; sshTunnel: boolean; httpTunnel: boolean; httpTunnelSecure: boolean; httpTunnelRemote: boolean }
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string, executionId?: string, timeoutSeconds?: number): Promise<QueryResult[]>
  queryRows(connectionId: string, sql: string, parameters?: unknown[]): Promise<Array<Record<string, unknown>>>
  cancelQuery(connectionId: string, executionId: string): Promise<void>
  listDatabaseObjects(connectionId: string, database: string): Promise<DatabaseObject[]>
  showCreateObject(connectionId: string, database: string, object: DatabaseObject): Promise<string>
  setDatabase(connectionId: string, database: string): Promise<void>
  beginTransaction(connectionId: string): Promise<void>
  commitTransaction(connectionId: string): Promise<void>
  rollbackTransaction(connectionId: string): Promise<void>
  executeParameterized(connectionId: string, sql: string, values: readonly SqlValue[], signal?: AbortSignal): Promise<{ affectedRows: number; insertId: number; warnings?: string[] }>
  streamRows(connectionId: string, sql: string, values?: readonly SqlValue[], signal?: AbortSignal, timeoutSeconds?: number, executionId?: string, splitterCompatible?: boolean): AsyncIterable<Record<string, unknown>>
  withTransaction<T>(connectionId: string, operation: (transaction: DbTransaction) => Promise<T>, signal?: AbortSignal): Promise<T>
  withSavepoint<T>(connectionId: string, operation: () => Promise<T>): Promise<T>
}
