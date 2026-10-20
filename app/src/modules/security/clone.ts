import type { AccountRef, PrivilegeScope, SecurityChange, UserSecurityDetails } from './index.js'

/** Builds grants and role assignments needed to clone a user's access to another account. */
export function cloneAccessChanges(source: UserSecurityDetails, target: AccountRef): SecurityChange[] {
  const groups = new Map<string, { scope: PrivilegeScope; privileges: Set<string>; grantOption: boolean; columnPrivileges: Map<string, Set<string>> }>()
  for (const row of source.privileges) {
    const privilege = String(row.privilege ?? '')
    if (!privilege) continue
    let scope: PrivilegeScope
    if (row.routineName) scope = { kind: 'routine', database: String(row.databaseName), routine: String(row.routineName), routineType: String(row.routineType).toUpperCase() === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE' }
    else if (row.columnName) scope = { kind: 'column', database: String(row.databaseName), table: String(row.tableName), columns: [String(row.columnName)] }
    else if (row.tableName) scope = { kind: 'table', database: String(row.databaseName), table: String(row.tableName) }
    else if (row.databaseName) scope = { kind: 'database', database: String(row.databaseName) }
    else scope = { kind: 'global' }
    const grantOption = String(row.grantable ?? '').toUpperCase() === 'YES'
    const baseScope = scope.kind === 'column' ? { kind: 'column', database: scope.database, table: scope.table, columns: [] } satisfies PrivilegeScope : scope
    const key = JSON.stringify(baseScope) + `:${grantOption}`
    const group = groups.get(key) ?? { scope: baseScope, privileges: new Set<string>(), grantOption, columnPrivileges: new Map<string, Set<string>>() }
    if (scope.kind === 'column') {
      const columns = group.columnPrivileges.get(privilege) ?? new Set<string>()
      columns.add(String(row.columnName)); group.columnPrivileges.set(privilege, columns)
    } else group.privileges.add(privilege)
    groups.set(key, group)
  }
  const grants: SecurityChange[] = []
  for (const { scope, privileges, grantOption, columnPrivileges } of groups.values()) {
    if (scope.kind !== 'column') {
      grants.push({ kind: 'grant', scope, privileges: [...privileges], grantOption, grantee: target })
      continue
    }
    const sameColumnSets = new Map<string, { columns: string[]; privileges: string[] }>()
    for (const [privilege, values] of columnPrivileges) {
      const columns = [...values].sort()
      const set = sameColumnSets.get(JSON.stringify(columns)) ?? { columns, privileges: [] }
      set.privileges.push(privilege); sameColumnSets.set(JSON.stringify(columns), set)
    }
    for (const { columns, privileges: columnPrivilegesList } of sameColumnSets.values()) grants.push({ kind: 'grant', scope: { ...scope, columns }, privileges: columnPrivilegesList, grantOption, grantee: target })
  }
  const defaults = new Set(source.defaultRoles.map((role) => `${role.user}@${role.host}`))
  const roles = source.grantedRoles.map((role) => ({ kind: 'grantRole', role, grantee: target, default: defaults.has(`${role.user}@${role.host}`) }) satisfies SecurityChange)
  return [...grants, ...roles]
}
