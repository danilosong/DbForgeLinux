export type DatabaseType = 'mysql' | 'mariadb'
export type SslMode = 'disabled' | 'preferred' | 'required' | 'verify-ca' | 'verify-identity'
export type SshAuthMethod = 'password' | 'private-key' | 'agent'
export type ConnectionEnvironment = 'none' | 'dev' | 'test' | 'prod' | 'custom'

export interface SslConfig {
  mode: SslMode
  caPath?: string
  certPath?: string
  keyPath?: string
  cipher?: string
  minVersion?: 'auto' | 'TLSv1.2' | 'TLSv1.3'
}

export interface SshConfig {
  enabled: boolean
  host: string
  port: number
  user: string
  authMethod: SshAuthMethod
  passwordRef?: string
  privateKeyFile?: string
  passphraseRef?: string
  remoteHost: string
  remotePort: number
  localPort?: number
  keepAliveSeconds: number
  hostFingerprint?: string
}

export interface HttpTunnelConfig {
  enabled: boolean
  url: string
  user?: string
  passwordRef?: string
  proxyHost?: string
  proxyPort?: number
  proxyUser?: string
  proxyPasswordRef?: string
  timeoutSeconds: number
  rejectUnauthorized: boolean
}

export interface AdvancedConnectionConfig {
  connectionTimeoutSeconds: number
  commandTimeoutSeconds: number
  charset: string
  collation?: string
  timeZone?: string
  sqlMode?: string
  initCommands: string
  keepAliveSeconds: number
  compression: boolean
  multipleStatements: boolean
  tinyInt1isBit: boolean
  readOnly: boolean
  autoReconnect: boolean
  customParameters: Array<{ key: string; value: string }>
}

/** Persisted connection metadata. Secret values live only in PasswordVault. */
export interface ConnectionRecord {
  id: string
  name: string
  type: DatabaseType
  host: string
  port: number
  socketPath?: string
  user: string
  passwordRef?: string
  database?: string
  color?: string
  environment: ConnectionEnvironment
  environmentLabel?: string
  category?: string
  comment?: string
  ssl: SslConfig
  ssh: SshConfig
  http: HttpTunnelConfig
  advanced: AdvancedConnectionConfig
  lastUsedAt?: string
}

export interface ConnectionSummary {
  id: string
  recordId: string
  name: string
  host: string
  port: number
  user: string
  database?: string
  environment: ConnectionEnvironment
  color?: string
}

export interface ConnectionTestResult {
  serverVersion: string
  elapsedMs: number
  tlsVersion?: string
  sshTunnel: boolean
}

export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  affectedRows: number
  insertId: number
  warningStatus: number
}

export type DatabaseObjectKind = 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event'
export interface DatabaseObject { name: string; kind: DatabaseObjectKind }
export interface SqlFile { path: string; contents: string }

export interface DbForgeApi {
  getConnections(): Promise<ConnectionRecord[]>
  saveConnection(record: ConnectionRecord): Promise<void>
  deleteConnection(id: string): Promise<void>
  savePassword(key: string, password: string): Promise<void>
  deletePassword(key: string): Promise<void>
  testConnection(record: ConnectionRecord): Promise<ConnectionTestResult>
  connect(record: ConnectionRecord): Promise<ConnectionSummary>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string, executionId?: string): Promise<QueryResult[]>
  cancelQuery(connectionId: string, executionId: string): Promise<void>
  listDatabaseObjects(connectionId: string, database: string): Promise<DatabaseObject[]>
  showCreateObject(connectionId: string, database: string, object: DatabaseObject): Promise<string>
  setDatabase(connectionId: string, database: string): Promise<void>
  beginTransaction(connectionId: string): Promise<void>
  commitTransaction(connectionId: string): Promise<void>
  rollbackTransaction(connectionId: string): Promise<void>
  openSqlFile(): Promise<SqlFile | null>
  saveSqlFile(path: string | undefined, contents: string): Promise<string | null>
}

declare global {
  interface Window { dbforge: DbForgeApi }
}
