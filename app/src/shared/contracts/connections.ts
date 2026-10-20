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
