import { describe, expect, it, vi } from 'vitest'
import { buildDocumenterCliMysqlOptions, connectDocumenterCliMysql } from '../../src/modules/documenter/cliConnection.js'

describe('Documenter CLI MySQL connection policy', () => {
  it('requires TLS by default for remote hosts', async () => {
    const options = await buildDocumenterCliMysqlOptions('db.example.test', 3306, 'reader', undefined, 'sales', {})
    expect(options.ssl).toMatchObject({ rejectUnauthorized: false })
  })

  it('prefers TLS by default on loopback', async () => {
    const options = await buildDocumenterCliMysqlOptions('127.0.0.1', 33067, 'reader', undefined, 'mysql', {})
    expect(options.ssl).toMatchObject({ rejectUnauthorized: false })
  })

  it('allows an explicit disabled mode', async () => {
    const options = await buildDocumenterCliMysqlOptions('db.example.test', 3306, 'reader', undefined, 'sales', { TUXSQL_DB_SSL: 'disabled' })
    expect(options).not.toHaveProperty('ssl')
  })

  it('rejects unknown SSL modes', async () => {
    await expect(buildDocumenterCliMysqlOptions('db.example.test', 3306, 'reader', undefined, 'sales', { TUXSQL_DB_SSL: 'sometimes' })).rejects.toThrow('TUXSQL_DB_SSL')
  })

  it('falls back to plaintext only for an unsupported TLS handshake on loopback preferred mode', async () => {
    const connect = vi.fn().mockRejectedValueOnce(Object.assign(new Error('TLS unavailable'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })).mockResolvedValueOnce({ ok: true })
    await expect(connectDocumenterCliMysql(connect, '127.0.0.1', 33067, 'reader', undefined, 'mysql', {})).resolves.toEqual({ ok: true })
    expect(connect).toHaveBeenCalledTimes(2)
    expect(connect.mock.calls[0]?.[0].ssl).toBeDefined()
    expect(connect.mock.calls[1]?.[0]).not.toHaveProperty('ssl')
  })

  it('never downgrades a remote connection from preferred TLS', async () => {
    const failure = Object.assign(new Error('TLS unavailable'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' })
    const connect = vi.fn().mockRejectedValue(failure)
    await expect(connectDocumenterCliMysql(connect, 'db.example.test', 3306, 'reader', undefined, 'sales', { TUXSQL_DB_SSL: 'preferred' })).rejects.toBe(failure)
    expect(connect).toHaveBeenCalledOnce()
  })
})
