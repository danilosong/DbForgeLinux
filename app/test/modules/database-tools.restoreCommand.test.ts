import { describe, expect, it } from 'vitest'
import { buildRestoreCommandLine } from '../../src/modules/database-tools/restoreCommand.js'

describe('buildRestoreCommandLine', () => {
  it('quotes shell values and leaves the password to the client prompt', () => {
    const command = buildRestoreCommandLine({ host: "db'server", port: 3307, user: 'qa user', database: 'schema-test', backupPath: "/tmp/test's backup.sql" })
    expect(command).toContain("--host='db'\\''server'")
    expect(command).toContain("--user='qa user'")
    expect(command).toContain("'schema-test' < '/tmp/test'\\''s backup.sql'")
    expect(command).toContain('--password ')
    expect(command).not.toMatch(/--password\S/)
    expect(command).not.toMatch(/password=[^\s]/i)
  })

  it('rejects invalid ports and relative backup paths', () => {
    expect(() => buildRestoreCommandLine({ host: 'localhost', port: 0, user: 'tester', database: 'db', backupPath: '/tmp/dump.sql' })).toThrow(/invalid/i)
    expect(() => buildRestoreCommandLine({ host: 'localhost', port: 3306, user: 'tester', database: 'db', backupPath: 'dump.sql' })).toThrow(/invalid/i)
  })
})
