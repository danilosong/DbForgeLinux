import type { ConnectionOptions } from 'mysql2/promise'
import type { SslMode } from '../../shared/contracts/connections.js'
import { buildSslOptions, isLoopbackMysqlTarget } from '../../main/db/connectionOptions.js'

const sslModes = new Set<SslMode>(['disabled', 'preferred', 'required', 'verify-ca', 'verify-identity'])

function resolveSslMode(host: string, env: NodeJS.ProcessEnv): SslMode {
  const requestedMode = env.TUXSQL_DB_SSL?.trim()
  const configuredMode = requestedMode ? requestedMode as SslMode : undefined
  if (configuredMode && !sslModes.has(configuredMode)) throw new Error('TUXSQL_DB_SSL must be disabled, preferred, required, verify-ca, or verify-identity.')
  return configuredMode ?? (isLoopbackMysqlTarget(host) ? 'preferred' : 'required')
}

export async function buildDocumenterCliMysqlOptions(
  host: string,
  port: number,
  user: string,
  password: string | undefined,
  database: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<ConnectionOptions> {
  const mode = resolveSslMode(host, env)
  const ssl = await buildSslOptions({ mode, caPath: env.TUXSQL_DB_SSL_CA?.trim() || undefined }, host)
  return {
    host, port, user, password, database,
    connectTimeout: 10_000,
    multipleStatements: false,
    ...(ssl ? { ssl } : {})
  }
}

export async function connectDocumenterCliMysql<T>(
  connect: (options: ConnectionOptions) => Promise<T>,
  host: string,
  port: number,
  user: string,
  password: string | undefined,
  database: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<T> {
  const options = await buildDocumenterCliMysqlOptions(host, port, user, password, database, env)
  try { return await connect(options) }
  catch (error) {
    const mode = resolveSslMode(host, env)
    const tlsUnavailable = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'HANDSHAKE_NO_SSL_SUPPORT'
    if (mode !== 'preferred' || !isLoopbackMysqlTarget(host) || !tlsUnavailable) throw error
    const plainOptions = Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'ssl')) as ConnectionOptions
    return connect(plainOptions)
  }
}
