import { readFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import type { ConnectConfig } from 'ssh2'
import type { ConnectionOptions } from 'mysql2/promise'
import type { ConnectionRecord, SshConfig, SshInteractiveChallenge } from '../../shared/contracts.js'
import type { DriverConnectionConfig } from './DbDriver.js'

export type ResolvedSshConfig = SshConfig & {
  password?: string
  passphrase?: string
  privateKey?: Buffer
  keyboardInteractivePrompt?: (challenge: SshInteractiveChallenge) => Promise<string[] | null>
}

export function buildSshOptions(config: ResolvedSshConfig, agentSocket = process.env.SSH_AUTH_SOCK): ConnectConfig {
  const options: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.user,
    keepaliveInterval: Math.max(0, config.keepAliveSeconds) * 1000,
    keepaliveCountMax: 3,
    readyTimeout: 15000
  }
  if (config.authMethod === 'password') {
    if (!config.password) throw new Error('An SSH password is required for this authentication method.')
    options.password = config.password
    if (config.keyboardInteractive) options.tryKeyboard = true
  } else if (config.authMethod === 'private-key') {
    if (!config.privateKey) throw new Error('The SSH private key file could not be read.')
    options.privateKey = config.privateKey
    if (config.passphrase) options.passphrase = config.passphrase
    if (config.keyboardInteractive) options.tryKeyboard = true
  } else {
    if (!agentSocket) throw new Error('SSH_AUTH_SOCK is not set; start ssh-agent or choose another authentication method.')
    options.agent = agentSocket
  }
  return options
}

export async function buildSslOptions(
  ssl: ConnectionRecord['ssl'],
  hostname: string,
  loadFile: (path: string) => Promise<Buffer> = (path) => readFile(path)
): Promise<ConnectionOptions['ssl']> {
  if (ssl.mode === 'disabled') return undefined
  const verifyCa = ssl.mode === 'verify-ca'
  const verifyIdentity = ssl.mode === 'verify-identity'
  if (verifyCa && !ssl.caPath) throw new Error('A CA certificate is required to verify the TLS certificate.')
  if (Boolean(ssl.certPath) !== Boolean(ssl.keyPath)) {
    throw new Error('Provide both the TLS client certificate and its matching key.')
  }

  const result: Record<string, unknown> = { rejectUnauthorized: verifyCa || verifyIdentity }
  if (ssl.caPath) result.ca = await loadFile(ssl.caPath)
  if (ssl.certPath) result.cert = await loadFile(ssl.certPath)
  if (ssl.keyPath) result.key = await loadFile(ssl.keyPath)
  if (ssl.cipher) result.ciphers = ssl.cipher
  if (ssl.minVersion && ssl.minVersion !== 'auto') result.minVersion = ssl.minVersion
  if (verifyIdentity) result.servername = hostname
  return result as ConnectionOptions['ssl']
}

export function isLoopbackMysqlTarget(host: string, socketPath?: string): boolean {
  if (socketPath?.trim()) return true
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (normalized === 'localhost' || normalized === '::1') return true
  if (isIP(normalized) === 4) return Number(normalized.split('.')[0]) === 127
  return normalized.startsWith('::ffff:127.') && isIP(normalized.slice(7)) === 4
}

export async function buildMysqlOptions(
  config: DriverConnectionConfig,
  endpoint?: { host: string; port: number }
): Promise<ConnectionOptions> {
  if (config.ssh.enabled && config.http.enabled) throw new Error('SSH and HTTP tunneling cannot be enabled at the same time.')

  const options: ConnectionOptions = {
    host: endpoint?.host ?? config.host,
    port: endpoint?.port ?? config.port,
    user: config.user,
    password: config.password,
    database: config.database || undefined,
    socketPath: config.socketPath || undefined,
    charset: config.advanced.charset,
    connectTimeout: config.advanced.connectionTimeoutSeconds * 1000,
    enableKeepAlive: config.advanced.keepAliveEnabled ?? config.advanced.keepAliveSeconds > 0,
    keepAliveInitialDelay: Math.max(0, config.advanced.pingTimeoutSeconds ?? 240) * 1000,
    multipleStatements: config.advanced.multipleStatements,
    compress: config.advanced.compression,
    supportBigNumbers: true,
    typeCast: config.advanced.tinyInt1isBit ? (field, next) => {
      if (field.type === 'TINY' && field.length === 1) {
        const value = field.string()
        return value === null ? null : value === '1'
      }
      return next()
    } : undefined
  }
  if (config.advanced.timeZone && config.advanced.timeZone.toUpperCase() !== 'SERVER') {
    options.timezone = config.advanced.timeZone.toUpperCase() === 'LOCAL' ? 'local' : config.advanced.timeZone
  }
  options.ssl = await buildSslOptions(config.ssl, config.host)
  for (const parameter of config.advanced.customParameters) {
    if (parameter.key && !['host', 'port', 'user', 'password', 'database', 'socketPath', 'ssl'].includes(parameter.key)) {
      (options as Record<string, unknown>)[parameter.key] = parameter.value
    }
  }
  return options
}
