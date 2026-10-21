import { describe, expect, it, vi } from 'vitest'
import { applySecurityPlan, buildSecurityPlan, getUserSecurityDetails, previewSecurityPlan, securitySql, supportedPrivileges, type SecurityChange } from '../../src/modules/security/index.js'
import { cloneAccessChanges } from '../../src/modules/security/clone.js'
import type { SqlClient } from '../../src/modules/sql.js'

function client(overrides: Partial<SqlClient> = {}): SqlClient {
  return { query: vi.fn(async () => []), execute: vi.fn(async () => undefined), ...overrides }
}

describe('security manager backend', () => {
  it('uses the privilege set reported by the connected MySQL server build', () => {
    expect(supportedPrivileges([{ Privilege: 'SELECT' }, { Privilege: 'BACKUP_ADMIN' }, { Privilege: 'SELECT' }])).toEqual(['BACKUP_ADMIN', 'SELECT'])
  })
  it('copies direct grants and default role assignments when cloning access', () => {
    const changes = cloneAccessChanges({
      account: { user: 'source', host: '%' }, grants: [], privileges: [
        { privilege: 'SELECT', databaseName: 'app', tableName: 'users', columnName: 'name', grantable: 'NO' },
        { privilege: 'UPDATE', databaseName: 'app', tableName: 'users', columnName: 'name', grantable: 'NO' },
        { privilege: 'PROCESS', grantable: 'YES' }
      ], grantedRoles: [{ user: 'read_role', host: '%' }], defaultRoles: [{ user: 'read_role', host: '%' }]
    }, { user: 'clone', host: 'localhost' })
    expect(changes).toEqual([
      { kind: 'grant', scope: { kind: 'column', database: 'app', table: 'users', columns: ['name'] }, privileges: ['SELECT', 'UPDATE'], grantOption: false, grantee: { user: 'clone', host: 'localhost' } },
      { kind: 'grant', scope: { kind: 'global' }, privileges: ['PROCESS'], grantOption: true, grantee: { user: 'clone', host: 'localhost' } },
      { kind: 'grantRole', role: { user: 'read_role', host: '%' }, grantee: { user: 'clone', host: 'localhost' }, default: true }
    ])
  })

  it('escapes account identifiers and masks passwords in preview SQL', () => {
    const plan = buildSecurityPlan([{ kind: 'createUser', account: { user: "u'", host: '10.%' }, password: "secret'\\value" }])
    expect(plan.statements[0].sql).toContain("'u'''@'10.%'")
    expect(plan.statements[0].sql).toContain("secret''\\\\value")
    expect(previewSecurityPlan(plan)).not.toContain('secret')
    expect(previewSecurityPlan(plan)).toContain('<senha>')
  })

  it('escapes db/table/column names and generates privilege scripts', () => {
    const sql = securitySql({ kind: 'grant', privileges: ['SELECT', 'UPDATE'], scope: { kind: 'column', database: 'db`name', table: 'tab', columns: ['c`1', 'c2'] }, grantee: { user: 'reader', host: '%' }, grantOption: true })
    expect(sql).toBe('GRANT SELECT (`c``1`, `c2`), UPDATE (`c``1`, `c2`) ON `db``name`.`tab` TO \'reader\'@\'%\' WITH GRANT OPTION;')
  })

  it('requires confirmation and reports partial results without printing secrets', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error("Access denied for 'user'@'host'" )).mockResolvedValueOnce(undefined)
    const db = client({ execute })
    expect(() => buildSecurityPlan([{ kind: 'dropUser', account: { user: 'a', host: '%' } }])).toThrow('confirmação')
    const plan = buildSecurityPlan([{ kind: 'dropUser', account: { user: 'a', host: '%' } }, { kind: 'revokeRole', role: { user: 'r', host: '%' }, grantee: { user: 'a', host: '%' } }], { confirm: true })
    await expect(applySecurityPlan(db, plan, false as true)).rejects.toThrow('confirmação')
    expect(execute).not.toHaveBeenCalled()
    await expect(applySecurityPlan(db, plan, true)).resolves.toEqual([{ index: 0, success: false, error: expect.any(String) }, { index: 1, success: true }])
    expect(plan.statements.map((item) => item.risk)).toEqual(['destructive', 'destructive'])
  })

  it('introspects grants, including scoped metadata and role grants', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SHOW GRANTS')) return [{ grants: "GRANT USAGE ON *.* TO 'reader'@'%'" }]
      if (sql.includes('USER_PRIVILEGES')) return []
      if (sql.includes('SCHEMA_PRIVILEGES')) return [{ grantee: "'reader'@'%'", databaseName: 'app', privilege: 'SELECT', grantable: 'NO' }]
      if (sql.includes('ROLE_EDGES') || sql.includes('default_roles')) throw new Error('roles unavailable')
      if (sql.includes('WHERE account_type')) return []
      if (sql.includes('WHERE is_role')) return []
      if (sql.includes('FROM mysql.user')) return [{ user: 'reader', host: '%', plugin: 'caching_sha2_password' }]
      return []
    })
    const details = await getUserSecurityDetails(client({ query }), { user: 'reader', host: '%' })
    expect(details.grants).toContain("GRANT USAGE ON *.* TO 'reader'@'%'")
    expect(details.privileges).toHaveLength(1)
    expect(details.grantedRoles).toEqual([])
  })

  it('supports MariaDB default role syntax in the plan', () => {
    const change: SecurityChange = { kind: 'grantRole', role: { user: 'read_role', host: '%' }, grantee: { user: 'app', host: 'localhost' }, default: true }
    expect(buildSecurityPlan([change], { serverFamily: 'mariadb' }).statements[1].sql).toContain('SET DEFAULT ROLE')
    expect(buildSecurityPlan([change], { serverFamily: 'mariadb' }).statements[1].sql).toContain(' FOR ')
  })

  it('supports admin option when granting a role', () => {
    const change: SecurityChange = { kind: 'grantRole', role: { user: 'ops', host: '%' }, grantee: { user: 'app', host: '%' }, adminOption: true }
    expect(buildSecurityPlan([change]).statements[0].sql).toBe("GRANT 'ops'@'%' TO 'app'@'%' WITH ADMIN OPTION;")
    expect(buildSecurityPlan([{ ...change, adminOption: false }]).statements[0].sql).toBe("GRANT 'ops'@'%' TO 'app'@'%';")
  })

  it('generates account limits with valid resource clauses and protects revoke previews', () => {
    const sql = securitySql({ kind: 'alterUser', account: { user: 'app', host: '%' }, changes: { limits: { MAX_QUERIES_PER_HOUR: 20 } } })
    expect(sql).toContain('WITH MAX_QUERIES_PER_HOUR 20')
    expect(() => buildSecurityPlan([{ kind: 'revoke', privileges: ['SELECT'], scope: { kind: 'global' }, grantee: { user: 'app', host: '%' } }])).toThrow('confirmação')
  })

  it('renders account options in MySQL order with one combined REQUIRE clause', () => {
    const create = securitySql({ kind: 'createUser', account: {
      user: 'app', host: '%', sslType: 'SSL', sslIssuer: 'issuer', sslSubject: 'subject',
      limits: { MAX_QUERIES_PER_HOUR: 20 }, passwordExpired: true, locked: true, comment: 'managed'
    } })
    expect(create).toBe("CREATE USER 'app'@'%' REQUIRE SSL AND ISSUER 'issuer' AND SUBJECT 'subject' WITH MAX_QUERIES_PER_HOUR 20 PASSWORD EXPIRE ACCOUNT LOCK COMMENT 'managed';")
    expect(create.match(/ REQUIRE /g)).toHaveLength(1)

    const alter = securitySql({ kind: 'alterUser', account: { user: 'app', host: '%' }, changes: {
      sslIssuer: 'issuer', sslSubject: 'subject', limits: { MAX_USER_CONNECTIONS: 3 }, passwordExpired: false, locked: false
    } })
    expect(alter).toBe("ALTER USER 'app'@'%' REQUIRE ISSUER 'issuer' AND SUBJECT 'subject' WITH MAX_USER_CONNECTIONS 3 PASSWORD EXPIRE NEVER ACCOUNT UNLOCK;")
  })

  it('blocks deleting root or the active account and requires strong confirmation for own admin revokes', () => {
    expect(() => buildSecurityPlan([{ kind: 'dropUser', account: { user: 'root', host: 'localhost' } }], { confirm: true })).toThrow('root@localhost')
    expect(() => buildSecurityPlan([{ kind: 'dropUser', account: { user: 'admin', host: '%' } }], { confirm: true, currentAccount: { user: 'admin', host: '%' } })).toThrow('conta desta conexão')
    const revoke = [{ kind: 'revoke', privileges: ['SUPER'], scope: { kind: 'global' }, grantee: { user: 'admin', host: '%' } }] as const
    expect(() => buildSecurityPlan(revoke, { confirm: true, currentAccount: { user: 'admin', host: '%' } })).toThrow('confirmação forte')
    expect(buildSecurityPlan(revoke, { confirm: true, currentAccount: { user: 'admin', host: '%' }, allowCurrentAdminRevoke: true }).statements).toHaveLength(1)
  })
})
