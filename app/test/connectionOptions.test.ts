import { describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { buildMysqlOptions, buildSshOptions, buildSslOptions } from '../src/main/db/connectionOptions.js'

describe('connection option builders', () => {
  it('builds verified TLS options with certificates and identity checks', async () => {
    const options = await buildSslOptions({
      mode: 'verify-identity',
      caPath: '/certs/ca.pem',
      certPath: '/certs/client.pem',
      keyPath: '/certs/client.key',
      cipher: 'TLS_AES_256_GCM_SHA384',
      minVersion: 'TLSv1.2'
    }, 'db.example.test', async (path) => Buffer.from(path))

    expect(options).toMatchObject({
      rejectUnauthorized: true,
      ca: Buffer.from('/certs/ca.pem'),
      cert: Buffer.from('/certs/client.pem'),
      key: Buffer.from('/certs/client.key'),
      ciphers: 'TLS_AES_256_GCM_SHA384',
      minVersion: 'TLSv1.2',
      servername: 'db.example.test'
    })
  })

  it('requires a CA for certificate verification and omits SSL when disabled', async () => {
    await expect(buildSslOptions({ mode: 'verify-ca' }, 'localhost')).rejects.toThrow('CA obrigatório')
    await expect(buildSslOptions({ mode: 'disabled' }, 'localhost')).resolves.toBeUndefined()
  })

  it('maps SSH password, key and agent authentication options', () => {
    const base = { enabled: true, host: 'ssh.example', port: 22, user: 'db-user', remoteHost: 'db', remotePort: 3306, keepAliveSeconds: 30 }
    expect(buildSshOptions({ ...base, authMethod: 'password', password: 'ssh-secret' })).toMatchObject({ host: 'ssh.example', username: 'db-user', password: 'ssh-secret', keepaliveInterval: 30000 })
    expect(buildSshOptions({ ...base, authMethod: 'private-key', privateKey: Buffer.from('key'), passphrase: 'phrase' })).toMatchObject({ privateKey: Buffer.from('key'), passphrase: 'phrase' })
    expect(buildSshOptions({ ...base, authMethod: 'agent' }, '/tmp/ssh-agent.sock')).toMatchObject({ agent: '/tmp/ssh-agent.sock' })
    expect(() => buildSshOptions({ ...base, authMethod: 'agent' }, '')).toThrow('SSH_AUTH_SOCK')
  })

  it('maps connection and advanced settings to mysql2 without returning vault references', async () => {
    const record = { ...createDefaultConnection('one', 'Test'), passwordRef: 'vault-secret', password: 'never-serialize' } as ReturnType<typeof createDefaultConnection> & { password: string }
    const options = await buildMysqlOptions({ ...record, password: 'driver-only' })
    expect(options).toMatchObject({ host: 'localhost', port: 3306, user: 'root', password: 'driver-only', charset: 'utf8mb4', connectTimeout: 15000, enableKeepAlive: false, keepAliveInitialDelay: 240000, multipleStatements: true })
    expect(options).not.toHaveProperty('passwordRef')
    const socketOptions = await buildMysqlOptions({ ...record, socketPath: '/tmp/mysql.sock', advanced: { ...record.advanced, keepAliveEnabled: true } })
    expect(socketOptions).toMatchObject({ socketPath: '/tmp/mysql.sock', enableKeepAlive: true })
  })

  it('rejects simultaneous SSH and HTTP transports', async () => {
    const record = createDefaultConnection('one', 'Test')
    await expect(buildMysqlOptions({ ...record, ssh: { ...record.ssh, enabled: true }, http: { ...record.http, enabled: true } })).rejects.toThrow('mutuamente exclusivos')
    await expect(buildMysqlOptions({ ...record, http: { ...record.http, enabled: true } })).resolves.toMatchObject({ host: 'localhost', port: 3306 })
  })
})
