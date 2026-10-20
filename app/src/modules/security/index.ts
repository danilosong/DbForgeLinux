import type { SqlClient, SqlRow } from '../sql.js'
import { accountName, quoteIdentifier, quoteString, stringValue } from '../sql.js'

export type PrivilegeScope =
  | { kind: 'global' }
  | { kind: 'database'; database: string }
  | { kind: 'table'; database: string; table: string }
  | { kind: 'column'; database: string; table: string; columns: string[] }
  | { kind: 'routine'; database: string; routine: string; routineType: 'PROCEDURE' | 'FUNCTION' }

export interface AccountRef { user: string; host: string }
export interface UserAccount extends AccountRef {
  plugin?: string
  locked?: boolean
  passwordExpired?: boolean
  sslType?: string
  sslIssuer?: string
  sslSubject?: string
  comment?: string
  limits?: Partial<Record<'MAX_QUERIES_PER_HOUR' | 'MAX_UPDATES_PER_HOUR' | 'MAX_CONNECTIONS_PER_HOUR' | 'MAX_USER_CONNECTIONS', number>>
  isRole?: boolean
}
export interface GrantedPrivilege { scope: PrivilegeScope; privilege: string; grantOption?: boolean }
export interface UserSecurityDetails { account: UserAccount; grants: string[]; privileges: SqlRow[]; grantedRoles: AccountRef[]; defaultRoles: AccountRef[] }
export type SecurityChange =
  | { kind: 'createUser'; account: UserAccount; password?: string }
  | { kind: 'alterUser'; account: AccountRef; changes: Partial<Omit<UserAccount, 'user' | 'host'>>; password?: string }
  | { kind: 'dropUser'; account: AccountRef }
  | { kind: 'grant'; privileges: string[]; scope: PrivilegeScope; grantee: AccountRef; grantOption?: boolean }
  | { kind: 'revoke'; privileges: string[]; scope: PrivilegeScope; grantee: AccountRef; grantOptionOnly?: boolean }
  | { kind: 'grantRole'; role: AccountRef; grantee: AccountRef; default?: boolean }
  | { kind: 'revokeRole'; role: AccountRef; grantee: AccountRef }

export interface PlannedStatement { sql: string; previewSql: string; risk: 'normal' | 'privileged' | 'destructive' }
export interface SecurityPlan { statements: PlannedStatement[] }
export interface SecurityPlanOptions {
  serverFamily?: 'mysql' | 'mariadb'; confirm?: true; currentAccount?: AccountRef; allowCurrentAdminRevoke?: true
}

const limitKeys = ['MAX_QUERIES_PER_HOUR', 'MAX_UPDATES_PER_HOUR', 'MAX_CONNECTIONS_PER_HOUR', 'MAX_USER_CONNECTIONS'] as const
const account = (ref: AccountRef): string => accountName(ref.user, ref.host)

export async function listAccounts(client: SqlClient): Promise<UserAccount[]> {
  const attempts = [
    'SELECT User AS user, Host AS host, plugin, account_locked AS locked, password_expired AS passwordExpired, ssl_type AS sslType, ssl_cipher AS sslCipher, x509_issuer AS sslIssuer, x509_subject AS sslSubject, max_questions AS MAX_QUERIES_PER_HOUR, max_updates AS MAX_UPDATES_PER_HOUR, max_connections AS MAX_CONNECTIONS_PER_HOUR, max_user_connections AS MAX_USER_CONNECTIONS, account_type AS accountType, is_role AS isRole FROM mysql.user ORDER BY User, Host',
    'SELECT User AS user, Host AS host, plugin, account_locked AS locked, password_expired AS passwordExpired, ssl_type AS sslType, ssl_cipher AS sslCipher, x509_issuer AS sslIssuer, x509_subject AS sslSubject, max_questions AS MAX_QUERIES_PER_HOUR, max_updates AS MAX_UPDATES_PER_HOUR, max_connections AS MAX_CONNECTIONS_PER_HOUR, max_user_connections AS MAX_USER_CONNECTIONS FROM mysql.user ORDER BY User, Host',
    'SELECT User AS user, Host AS host FROM mysql.user ORDER BY User, Host'
  ]
  let rows: SqlRow[] | undefined
  for (const sql of attempts) {
    try { rows = await client.query(sql); break } catch { /* Older servers expose fewer account columns. */ }
  }
  if (!rows) throw new Error('Não foi possível listar contas; são necessários privilégios de leitura em mysql.user.')
  const roleKeys = new Set((await readRoles(client)).map((role) => `${role.user}@${role.host}`))
  return rows.map((row) => ({
    user: String(row.user ?? ''), host: String(row.host ?? '%'), plugin: stringValue(row.plugin),
    locked: row.locked == null ? undefined : yes(row.locked), passwordExpired: row.passwordExpired == null ? undefined : yes(row.passwordExpired),
    sslType: stringValue(row.sslType), sslIssuer: stringValue(row.sslIssuer), sslSubject: stringValue(row.sslSubject), comment: stringValue(row.comment), isRole: yes(row.isRole) || String(row.accountType).toUpperCase() === 'ROLE' || roleKeys.has(`${String(row.user)}@${String(row.host)}`),
    limits: pickLimits(row)
  }))
}

export async function getUserSecurityDetails(client: SqlClient, ref: AccountRef): Promise<UserSecurityDetails> {
  const accounts = await listAccounts(client)
  const selected = accounts.find((item) => item.user === ref.user && item.host === ref.host)
  if (!selected) throw new Error(`A conta ${ref.user}@${ref.host} não foi encontrada.`)
  const grantsRows = await client.query(`SHOW GRANTS FOR ${account(ref)}`)
  const grants = grantsRows.map((row) => String(Object.values(row)[0] ?? '')).filter(Boolean)
  const privileges = await readPrivileges(client, ref)
  const roles = await readRoleGrants(client, ref)
  return { account: selected, grants, privileges, grantedRoles: roles.granted, defaultRoles: roles.defaults }
}

export async function readPrivileges(client: SqlClient, ref?: AccountRef): Promise<SqlRow[]> {
  const [global, schemas, tables, columns, routines] = await Promise.all([
    client.query('SELECT GRANTEE AS grantee, PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.USER_PRIVILEGES').catch(() => []),
    client.query('SELECT GRANTEE AS grantee, TABLE_SCHEMA AS databaseName, PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.SCHEMA_PRIVILEGES').catch(() => []),
    client.query('SELECT GRANTEE AS grantee, TABLE_SCHEMA AS databaseName, TABLE_NAME AS tableName, PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.TABLE_PRIVILEGES').catch(() => []),
    client.query('SELECT GRANTEE AS grantee, TABLE_SCHEMA AS databaseName, TABLE_NAME AS tableName, COLUMN_NAME AS columnName, PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable FROM information_schema.COLUMN_PRIVILEGES').catch(() => []),
    client.query("SELECT CONCAT(QUOTE(User), '@', QUOTE(Host)) AS grantee, Db AS databaseName, Routine_name AS routineName, Routine_type AS routineType, Proc_priv AS privilege, 'NO' AS grantable FROM mysql.procs_priv").catch(() => [])
  ])
  const all = [...global, ...schemas, ...tables, ...columns, ...routines]
  if (!ref) return all
  const expected = `${quoteString(ref.user)}@${quoteString(ref.host)}`
  return all.filter((row) => String(row.grantee ?? '').replace(/\s/g, '') === expected)
}

export function buildSecurityPlan(changes: readonly SecurityChange[], options: SecurityPlanOptions = {}): SecurityPlan {
  const family = options.serverFamily ?? 'mysql'
  for (const change of changes) validateChange(change, options)
  return { statements: changes.flatMap((change) => securitySqls(change, family, options.confirm).map((sql) => ({ sql, previewSql: maskSecrets(sql), risk: riskFor(change) }))) }
}

export async function applySecurityPlan(client: SqlClient, plan: SecurityPlan, confirm: true): Promise<Array<{ index: number; success: boolean; error?: string }>> {
  if (confirm !== true) throw new Error('A aplicação de alterações de segurança exige confirmação explícita.')
  const results: Array<{ index: number; success: boolean; error?: string }> = []
  for (const [index, statement] of plan.statements.entries()) {
    try { await client.execute(statement.sql); results.push({ index, success: true }) }
    catch (error) { results.push({ index, success: false, error: maskSecrets(error instanceof Error ? error.message : String(error)) }) }
  }
  return results
}

export function previewSecurityPlan(plan: SecurityPlan): string { return plan.statements.map((item) => item.previewSql).join('\n\n') }

export function securitySql(change: SecurityChange, options: { confirm?: true } = {}): string {
  if (requiresConfirmation(change) && options.confirm !== true) throw new Error('DROP USER e REVOKE exigem confirmação explícita para gerar SQL.')
  switch (change.kind) {
    case 'createUser': {
      const options = userOptions(change.account)
      const auth = change.password === undefined ? '' : ` IDENTIFIED BY ${quoteString(change.password)}`
      const plugin = change.account.plugin ? ` IDENTIFIED WITH ${quoteIdentifier(change.account.plugin)}${change.password === undefined ? '' : ` BY ${quoteString(change.password)}`}` : auth
      return `CREATE USER ${account(change.account)}${plugin}${options};`
    }
    case 'alterUser': {
      const options = userOptions({ ...change.changes, limits: undefined })
      const auth = change.password === undefined ? '' : ` IDENTIFIED BY ${quoteString(change.password)}`
      const plugin = change.changes.plugin ? ` IDENTIFIED WITH ${quoteIdentifier(change.changes.plugin)}${change.password === undefined ? '' : ` BY ${quoteString(change.password)}`}` : auth
      const limits = renderLimits(change.changes.limits)
      return `ALTER USER ${account(change.account)}${plugin}${options}${limits ? ` WITH${limits}` : ''};`
    }
    case 'dropUser': return `DROP USER ${account(change.account)};`
    case 'grant': {
      const grantOption = change.grantOption ? ' WITH GRANT OPTION' : ''
      return `GRANT ${renderPrivileges(change.privileges, change.scope)} ON ${renderScope(change.scope)} TO ${account(change.grantee)}${grantOption};`
    }
    case 'revoke': {
      const permissions = change.grantOptionOnly ? 'GRANT OPTION' : renderPrivileges(change.privileges, change.scope)
      return `REVOKE ${permissions} ON ${renderScope(change.scope)} FROM ${account(change.grantee)};`
    }
    case 'grantRole': return `GRANT ${account(change.role)} TO ${account(change.grantee)};`
    case 'revokeRole': return `REVOKE ${account(change.role)} FROM ${account(change.grantee)};`
  }
}

function securitySqls(change: SecurityChange, family: 'mysql' | 'mariadb', confirm?: true): string[] {
  const sql = securitySql(change, { confirm })
  if (change.kind === 'grantRole' && change.default) return [sql, `SET DEFAULT ROLE ${account(change.role)} ${family === 'mariadb' ? 'FOR' : 'TO'} ${account(change.grantee)};`]
  return [sql]
}

function requiresConfirmation(change: SecurityChange): boolean {
  return change.kind === 'dropUser' || change.kind === 'revoke' || change.kind === 'revokeRole'
}

function validateChange(change: SecurityChange, options: SecurityPlanOptions): void {
  if (change.kind === 'dropUser') {
    if (change.account.user.toLowerCase() === 'root' && change.account.host.toLowerCase() === 'localhost') throw new Error('A exclusão de root@localhost está bloqueada.')
    if (options.currentAccount && sameAccount(change.account, options.currentAccount)) throw new Error('Não é permitido excluir a conta desta conexão.')
  }
  if (change.kind === 'revoke' && options.currentAccount && sameAccount(change.grantee, options.currentAccount) && change.scope.kind === 'global' && change.privileges.some((privilege) => ['ALL', 'ALL PRIVILEGES', 'SUPER', 'CREATE USER', 'GRANT OPTION'].includes(privilege.toUpperCase())) && options.allowCurrentAdminRevoke !== true) {
    throw new Error('Revogar privilégios administrativos da conta atual exige confirmação forte.')
  }
}

function sameAccount(left: AccountRef, right: AccountRef): boolean { return left.user === right.user && left.host === right.host }

async function readRoles(client: SqlClient): Promise<AccountRef[]> {
  try {
    const rows = await client.query('SELECT User AS user, Host AS host FROM mysql.user WHERE account_type = \'ROLE\'')
    return rows.map((row) => ({ user: String(row.user), host: String(row.host ?? '%') }))
  } catch {
    try { return (await client.query('SELECT User AS user, Host AS host FROM mysql.user WHERE is_role = \'Y\'')).map((row) => ({ user: String(row.user), host: String(row.host ?? '%') })) }
    catch { return [] }
  }
}

async function readRoleGrants(client: SqlClient, ref: AccountRef): Promise<{ granted: AccountRef[]; defaults: AccountRef[] }> {
  const granted: AccountRef[] = []
  const defaults: AccountRef[] = []
  try {
    const rows = await client.query('SELECT FROM_USER AS roleUser, FROM_HOST AS roleHost, TO_USER AS granteeUser, TO_HOST AS granteeHost FROM mysql.role_edges WHERE TO_USER = ? AND TO_HOST = ?', [ref.user, ref.host])
    for (const row of rows) granted.push({ user: String(row.roleUser), host: String(row.roleHost ?? '%') })
  } catch {
    try {
      const rows = await client.query("SELECT rm.Role AS roleUser, COALESCE(ru.Host, '%') AS roleHost FROM mysql.roles_mapping rm LEFT JOIN mysql.user ru ON ru.User = rm.Role AND ru.is_role = 'Y' WHERE rm.User = ? AND rm.Host = ?", [ref.user, ref.host])
      for (const row of rows) granted.push({ user: String(row.roleUser), host: String(row.roleHost ?? '%') })
    } catch { /* Roles are unavailable on older server versions or without privileges. */ }
  }
  try {
    const rows = await client.query('SELECT DEFAULT_ROLE_USER AS roleUser, DEFAULT_ROLE_HOST AS roleHost FROM mysql.default_roles WHERE USER = ? AND HOST = ?', [ref.user, ref.host])
    for (const row of rows) defaults.push({ user: String(row.roleUser), host: String(row.roleHost ?? '%') })
  } catch {
    try {
      const rows = await client.query("SELECT rm.Role AS roleUser, COALESCE(ru.Host, '%') AS roleHost FROM mysql.roles_mapping rm LEFT JOIN mysql.user ru ON ru.User = rm.Role AND ru.is_role = 'Y' WHERE rm.User = ? AND rm.Host = ? AND rm.default_role = 'Y'", [ref.user, ref.host])
      for (const row of rows) defaults.push({ user: String(row.roleUser), host: String(row.roleHost ?? '%') })
    } catch { /* MariaDB and MySQL versions differ in default-role metadata. */ }
  }
  return { granted, defaults }
}

function renderScope(scope: PrivilegeScope): string {
  if (scope.kind === 'global') return '*.*'
  const database = quoteIdentifier(scope.database)
  if (scope.kind === 'database') return `${database}.*`
  if (scope.kind === 'table' || scope.kind === 'column') return `${database}.${quoteIdentifier(scope.table)}`
  return `${scope.routineType} ${database}.${quoteIdentifier(scope.routine)}`
}

function renderPrivileges(privileges: string[], scope: PrivilegeScope): string {
  if (!privileges.length) throw new Error('Informe ao menos um privilégio.')
  const normalized = privileges.map((item) => item.toUpperCase())
  for (const privilege of normalized) if (!/^[A-Z][A-Z0-9_ ]*$/.test(privilege)) throw new Error(`Privilégio inválido: ${privilege}`)
  if (scope.kind === 'column') {
    if (!scope.columns.length) throw new Error('Informe ao menos uma coluna para o escopo.')
    const byPrivilege = new Map<string, string[]>()
    for (const column of scope.columns) for (const privilege of normalized) {
      const columns = byPrivilege.get(privilege) ?? []
      columns.push(quoteIdentifier(column))
      byPrivilege.set(privilege, columns)
    }
    return [...byPrivilege].map(([privilege, columns]) => `${privilege} (${columns.join(', ')})`).join(', ')
  }
  return normalized.join(', ')
}

function userOptions(accountValue: Partial<UserAccount>): string {
  const options: string[] = []
  if (accountValue.locked !== undefined) options.push(accountValue.locked ? ' ACCOUNT LOCK' : ' ACCOUNT UNLOCK')
  if (accountValue.passwordExpired !== undefined) options.push(accountValue.passwordExpired ? ' PASSWORD EXPIRE' : ' PASSWORD EXPIRE NEVER')
  if (accountValue.sslType === 'ANY' || accountValue.sslType === 'SSL') options.push(' REQUIRE SSL')
  else if (accountValue.sslType === 'X509') options.push(' REQUIRE X509')
  else if (accountValue.sslType === 'NONE') options.push(' REQUIRE NONE')
  if (accountValue.sslIssuer) options.push(` REQUIRE ISSUER ${quoteString(accountValue.sslIssuer)}`)
  if (accountValue.sslSubject) options.push(` REQUIRE SUBJECT ${quoteString(accountValue.sslSubject)}`)
  if (accountValue.comment) options.push(` COMMENT ${quoteString(accountValue.comment)}`)
  const limits = renderLimits(accountValue.limits)
  return options.join('') + (limits ? ` WITH${limits}` : '')
}

function renderLimits(limits: UserAccount['limits']): string {
  return limitKeys.map((key) => {
    const value = limits?.[key]
    if (value === undefined) return ''
    if (!Number.isInteger(value) || value < 0) throw new Error(`${key} deve ser um inteiro não negativo.`)
    return ` ${key} ${value}`
  }).join('')
}

function riskFor(change: SecurityChange): PlannedStatement['risk'] {
  if (change.kind === 'dropUser' || change.kind === 'revoke' || change.kind === 'revokeRole') return 'destructive'
  if (change.kind === 'grant' && (change.grantOption || change.scope.kind === 'global' || change.privileges.some((privilege) => ['ALL', 'ALL PRIVILEGES', 'SUPER', 'CREATE USER'].includes(privilege.toUpperCase())))) return 'privileged'
  return 'normal'
}

function maskSecrets(sql: string): string { return sql.replace(/(IDENTIFIED\s+(?:WITH\s+`[^`]+`\s+)?BY\s+)'(?:\\\\.|''|[^'])*'/gi, '$1\'<senha>\'') }
function yes(value: unknown): boolean { return value === true || value === 1 || String(value).toUpperCase() === 'Y' || String(value).toUpperCase() === 'YES' }
function pickLimits(row: SqlRow): UserAccount['limits'] {
  const limits: NonNullable<UserAccount['limits']> = {}
  for (const key of limitKeys) if (row[key] != null) limits[key] = Number(row[key])
  return Object.keys(limits).length ? limits : undefined
}

export type { SqlRow }
