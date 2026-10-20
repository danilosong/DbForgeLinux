import type { ConnectionRecord, ConnectionTestResult, HttpTunnelConfig, QueryResult, SshConfig } from '../../shared/contracts.js'

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
}
