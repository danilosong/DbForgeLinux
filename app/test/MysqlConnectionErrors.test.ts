import { describe, expect, it } from 'vitest'
import { mapMysqlConnectionError } from '../src/main/db/MysqlDriver.js'

describe('MySQL connection error messages', () => {
  it('maps rejected credentials without including the secret', () => {
    const message = mapMysqlConnectionError({ code: 'ER_ACCESS_DENIED_ERROR', message: "Access denied for user 'root' (using password: YES) secret-value" }, 'db.local', true).message
    expect(message).toContain('1045')
    expect(message).toContain('password supplied: yes')
    expect(message).not.toContain('secret-value')
    expect(mapMysqlConnectionError({ errno: 1045 }, 'db.local', false).message).toContain('password supplied: no')
  })

  it.each(['ECONNREFUSED', 'ENOTFOUND'])('maps %s to a connection error', (code) => {
    expect(mapMysqlConnectionError({ code }, 'db.local', false).message).toContain('2003')
  })

  it('maps socket timeouts using the configured connection timeout', () => {
    const error = mapMysqlConnectionError({ code: 'ETIMEDOUT' }, 'db.local', false, 15)
    expect(error.message).toContain('2003')
    expect(error.message).toContain('15 second')
  })
})
