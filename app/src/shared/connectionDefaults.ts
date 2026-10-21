import type { ConnectionRecord } from './contracts.js'

export function createDefaultConnection(id: string, name = ''): ConnectionRecord {
  return {
    id,
    name,
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    user: 'root',
    environment: 'none',
    ssl: { mode: 'preferred', minVersion: 'auto' },
    ssh: {
      enabled: false,
      host: '',
      port: 22,
      user: '',
      authMethod: 'password',
      remoteHost: 'localhost',
      remotePort: 3306,
      keepAliveSeconds: 30,
      hostFingerprint: undefined
    },
    http: { enabled: false, url: '', timeoutSeconds: 30, rejectUnauthorized: true, keepAlive: true, useBase64: true, useCredentials: false },
    advanced: {
      connectionTimeoutSeconds: 15,
      commandTimeoutSeconds: 0,
      charset: 'utf8mb4',
      timeZone: 'SERVER',
      initCommands: '',
      keepAliveSeconds: 0,
      keepAliveEnabled: false,
      pingTimeoutSeconds: 240,
      detectCharacterSet: false,
      compression: false,
      multipleStatements: true,
      tinyInt1isBit: true,
      readOnly: false,
      autoReconnect: true,
      customParameters: []
    }
  }
}
