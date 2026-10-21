import type { DocumenterAccount } from './index.js'

interface PrivilegeRow { grantee: string; scope: 'GLOBAL' | 'OBJECT'; privilege: string; object_name?: string }
export type AccountPrivilegeQuery = (sql: string, parameters?: unknown[]) => Promise<Array<Record<string, unknown>>>

export async function inspectDocumenterAccounts(queryRows: AccountPrivilegeQuery, database: string): Promise<DocumenterAccount[]> {
  const rows = await queryRows(`
    SELECT GRANTEE AS grantee, 'GLOBAL' AS scope, PRIVILEGE_TYPE AS privilege, NULL AS object_name
      FROM information_schema.USER_PRIVILEGES
    UNION ALL
    SELECT GRANTEE AS grantee, 'OBJECT' AS scope, PRIVILEGE_TYPE AS privilege,
      CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) AS object_name
      FROM information_schema.TABLE_PRIVILEGES WHERE TABLE_SCHEMA=?
    UNION ALL
    SELECT GRANTEE AS grantee, 'OBJECT' AS scope, PRIVILEGE_TYPE AS privilege,
      CONCAT(TABLE_SCHEMA, '.', TABLE_NAME, '.', COLUMN_NAME) AS object_name
      FROM information_schema.COLUMN_PRIVILEGES WHERE TABLE_SCHEMA=?
    ORDER BY grantee, scope, object_name, privilege`, [database, database]) as unknown as PrivilegeRow[]
  const grouped = new Map<string, DocumenterAccount>()
  for (const row of rows) {
    if (typeof row.grantee !== 'string' || typeof row.privilege !== 'string') continue
    const account = grouped.get(row.grantee) ?? { grantee: row.grantee, globalPrivileges: [], scopedPrivileges: [] }
    const privilege = row.scope === 'GLOBAL' ? row.privilege : `${row.object_name ?? database}: ${row.privilege}`
    const list = row.scope === 'GLOBAL' ? account.globalPrivileges : account.scopedPrivileges
    if (!list.includes(privilege)) list.push(privilege)
    grouped.set(row.grantee, account)
  }
  return [...grouped.values()]
}
