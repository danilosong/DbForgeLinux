import type { SqlClient, SqlRow } from '../sql.js'
import { numberValue, quoteString, stringValue } from '../sql.js'

export interface SessionInfo {
  id: number; user?: string; host?: string; database?: string; command?: string; timeSeconds: number; state?: string; query?: string
  current?: boolean; system?: boolean; memoryBytes?: number; rowsExamined?: number; stale?: boolean
}
export interface SessionFilters { hideSleep?: boolean; onlyMine?: boolean; search?: string; currentUser?: string; currentId?: number }
export interface SessionDetails { session: SessionInfo; locks: SqlRow[]; locksAvailable: boolean }
export type KillMode = 'query' | 'session'
export interface VariableInfo { name: string; value: string; scope: 'GLOBAL' | 'SESSION' | 'BOTH'; dynamic: boolean; category?: string; description?: string; defaultValue?: string; type: 'boolean' | 'number' | 'enum' | 'string'; enumValues?: string[]; min?: number; max?: number; modified?: boolean }
export type VariableMetadata = Partial<Pick<VariableInfo, 'scope' | 'dynamic' | 'category' | 'description' | 'defaultValue' | 'type' | 'enumValues' | 'min' | 'max'>>
export interface VariableSnapshot { capturedAt: string; scope: 'GLOBAL' | 'SESSION'; variables: VariableInfo[] }
export interface VariableChange { name: string; oldValue: string; newValue: string; scope: 'GLOBAL' | 'SESSION'; dynamic: boolean }

const staticVariables = new Set(['basedir', 'datadir', 'plugin_dir', 'port', 'socket', 'version', 'version_comment', 'server_uuid', 'lower_case_table_names', 'innodb_page_size', 'log_bin', 'log_bin_basename', 'log_bin_index'])
const boolValues = new Set(['ON', 'OFF', 'TRUE', 'FALSE', '1', '0', 'YES', 'NO'])
const booleanVariables = new Set(['read_only', 'super_read_only', 'event_scheduler', 'skip_name_resolve', 'skip_networking', 'offline_mode', 'require_secure_transport', 'log_bin'])
const enumValues: Record<string, string[]> = {
  binlog_format: ['ROW', 'STATEMENT', 'MIXED'],
  transaction_isolation: ['READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE'],
  tx_isolation: ['READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE']
}

export async function listSessions(client: SqlClient, filters: SessionFilters = {}): Promise<SessionInfo[]> {
  let rows: SqlRow[]
  try {
    rows = await client.query('SELECT p.ID AS id, p.USER AS user, p.HOST AS host, p.DB AS databaseName, p.COMMAND AS command, p.TIME AS timeSeconds, p.STATE AS state, p.INFO AS queryText, t.PROCESSLIST_ID AS threadId, es.ROWS_EXAMINED AS rowsExamined FROM information_schema.PROCESSLIST p LEFT JOIN performance_schema.threads t ON t.PROCESSLIST_ID = p.ID LEFT JOIN performance_schema.events_statements_current es ON es.THREAD_ID = t.THREAD_ID ORDER BY p.ID')
  } catch {
    rows = await client.query('SHOW FULL PROCESSLIST')
  }
  const sessions = rows.map((row) => {
    const id = numberValue(row.id ?? row.ID ?? row.Id)
    return {
      id, user: stringValue(row.user ?? row.User), host: stringValue(row.host ?? row.Host), database: stringValue(row.databaseName ?? row.DB ?? row.db),
      command: stringValue(row.command ?? row.Command), timeSeconds: numberValue(row.timeSeconds ?? row.Time), state: stringValue(row.state ?? row.State),
      query: stringValue(row.queryText ?? row.Info ?? row.info), current: id === filters.currentId || (filters.currentUser !== undefined && String(row.user ?? row.User) === filters.currentUser),
      system: !row.user && !row.User || ['system user', 'event_scheduler'].includes(String(row.user ?? row.User).toLowerCase()),
      memoryBytes: row.memoryBytes == null ? undefined : numberValue(row.memoryBytes), rowsExamined: row.rowsExamined == null ? undefined : numberValue(row.rowsExamined)
    } satisfies SessionInfo
  })
  const search = filters.search?.toLocaleLowerCase()
  return sessions.filter((item) => (!filters.hideSleep || item.command?.toLowerCase() !== 'sleep') && (!filters.onlyMine || item.current) && (!search || [item.user, item.host, item.database, item.command, item.state, item.query].some((value) => value?.toLocaleLowerCase().includes(search))))
}

export async function getSessionDetails(client: SqlClient, id: number): Promise<SessionDetails> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Session ID is invalid.')
  const sessions = await listSessions(client)
  const session = sessions.find((item) => item.id === id)
  if (!session) throw new Error(`Session ${id} was not found.`)
  try {
    const locks = await client.query('SELECT * FROM sys.innodb_lock_waits WHERE waiting_pid = ? OR blocking_pid = ?', [id, id])
    return { session, locks, locksAvailable: true }
  } catch {
    try {
      const locks = await client.query('SELECT ENGINE_TRANSACTION_ID AS transactionId, OBJECT_SCHEMA AS databaseName, OBJECT_NAME AS tableName, INDEX_NAME AS indexName, LOCK_TYPE AS lockType, LOCK_MODE AS lockMode, LOCK_STATUS AS lockStatus FROM performance_schema.data_locks WHERE THREAD_ID = (SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID = ?)', [id])
      return { session, locks, locksAvailable: true }
    } catch { return { session, locks: [], locksAvailable: false } }
  }
}

export async function killSessions(client: SqlClient, ids: readonly number[], mode: KillMode, options: { confirm: true; currentId?: number }): Promise<Array<{ id: number; success: boolean; error?: string }>> {
  if (options.confirm !== true) throw new Error('Ending sessions requires explicit confirmation.')
  const currentId = options.currentId ?? numberValue((await client.query('SELECT CONNECTION_ID() AS id'))[0]?.id, -1)
  if (currentId < 1) throw new Error('The current session could not be identified; the operation was cancelled for safety.')
  const visible = await listSessions(client)
  const systemIds = new Set(visible.filter((item) => item.system).map((item) => item.id))
  const unique = [...new Set(ids)]
  return Promise.all(unique.map(async (id) => {
    if (!Number.isSafeInteger(id) || id < 1) return { id, success: false, error: 'ID is invalid.' }
    if (id === currentId) return { id, success: false, error: 'You cannot end your own session.' }
    if (systemIds.has(id)) return { id, success: false, error: 'System threads cannot be ended.' }
    try { await client.execute(`KILL ${mode === 'query' ? 'QUERY ' : ''}${id}`); return { id, success: true } }
    catch (error) { return { id, success: false, error: error instanceof Error ? error.message : String(error) } }
  }))
}

export async function getServerVariables(client: SqlClient, scope: 'GLOBAL' | 'SESSION' = 'GLOBAL', metadata: Record<string, VariableMetadata> = {}): Promise<VariableSnapshot> {
  const rows = await client.query(`SHOW ${scope} VARIABLES`)
  const variables = rows.map((row) => {
    const name = String(row.Variable_name ?? row.Variable ?? row.variable_name ?? row.name)
    const value = String(row.Value ?? row.variable_value ?? row.value ?? '')
    const definition = { ...inferVariable(name, value), ...metadata[name.toLowerCase()] }
    return { name, value, scope, dynamic: !staticVariables.has(name.toLowerCase()), ...definition, category: definition.category ?? categoryFor(name) } satisfies VariableInfo
  }).sort((a, b) => a.name.localeCompare(b.name))
  return { capturedAt: new Date().toISOString(), scope, variables }
}

export async function getServerStatus(client: SqlClient, scope: 'GLOBAL' | 'SESSION' = 'GLOBAL'): Promise<Record<string, string>> {
  const rows = await client.query(`SHOW ${scope} STATUS`)
  return Object.fromEntries(rows.map((row) => [String(row.Variable_name ?? row.Variable ?? row.variable_name ?? row.name), String(row.Value ?? row.variable_value ?? row.value ?? '')]))
}

export async function setServerVariable(client: SqlClient, name: string, value: string | number | boolean, scope: 'GLOBAL' | 'SESSION', options: { confirm: true; dynamic: boolean; persist?: boolean; type?: VariableInfo['type']; enumValues?: string[]; min?: number; max?: number }): Promise<void> {
  if (options.confirm !== true) throw new Error(`${scope === 'GLOBAL' ? 'SET GLOBAL' : 'SET SESSION'} requires explicit confirmation.`)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error('Variable name is invalid.')
  if (!options.dynamic || staticVariables.has(name.toLowerCase())) throw new Error(`Variable ${name} is static and requires a restart.`)
  if (options.persist && scope !== 'GLOBAL') throw new Error('SET PERSIST only accepts global variables.')
  validateVariableValue(value, options)
  const sqlValue = encodeVariableValue(value, options.type)
  const command = options.persist ? 'SET PERSIST' : `SET ${scope}`
  await client.execute(`${command} ${name} = ${sqlValue}`)
}

export function compareVariableSnapshots(before: VariableSnapshot, after: VariableSnapshot): VariableChange[] {
  const previous = new Map(before.variables.map((item) => [item.name, item]))
  return after.variables.flatMap((item) => {
    const old = previous.get(item.name)
    return old && old.value !== item.value ? [{ name: item.name, oldValue: old.value, newValue: item.value, scope: after.scope, dynamic: item.dynamic }] : []
  })
}

export function compareStatus(before: Record<string, string>, after: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.keys(after).flatMap((name) => {
    const oldValue = Number(before[name] ?? 0), newValue = Number(after[name])
    return Number.isFinite(oldValue) && Number.isFinite(newValue) && newValue !== oldValue ? [[name, newValue - oldValue]] : []
  }))
}

function inferVariable(name: string, value: string): Pick<VariableInfo, 'type' | 'enumValues'> {
  const choices = enumValues[name.toLowerCase()]
  if (choices) return { type: 'enum', enumValues: choices }
  if (['ON', 'OFF', 'TRUE', 'FALSE', 'YES', 'NO'].includes(value.toUpperCase()) || booleanVariables.has(name.toLowerCase())) return { type: 'boolean' }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return { type: 'number' }
  return { type: 'string' }
}
function categoryFor(name: string): string { return name.split('_')[0].toLowerCase() }
function encodeVariableValue(value: string | number | boolean, type?: VariableInfo['type']): string {
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Numeric value is invalid.')
    return String(value)
  }
  if (type === 'string' || type === 'enum') return quoteString(value)
  if (/^(ON|OFF|TRUE|FALSE|DEFAULT|0|1)$/i.test(value)) return value.toUpperCase()
  return quoteString(value)
}

function validateVariableValue(value: string | number | boolean, options: { type?: VariableInfo['type']; enumValues?: string[]; min?: number; max?: number }): void {
  if (options.type === 'boolean' && !(typeof value === 'boolean' || typeof value === 'string' && boolValues.has(value.toUpperCase()))) throw new Error('The variable requires a boolean value (ON/OFF).')
  if (options.type === 'number') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || (options.min !== undefined && numeric < options.min) || (options.max !== undefined && numeric > options.max)) throw new Error('Numeric value is outside the allowed range.')
  }
  if (options.type === 'enum' && (!options.enumValues || !options.enumValues.some((item) => item.toLowerCase() === String(value).toLowerCase()))) throw new Error('Value is not one of the variable options.')
}

export { quoteString }
