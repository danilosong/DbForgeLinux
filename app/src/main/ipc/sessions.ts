import { ipcMain } from 'electron'
import { getServerStatus, getServerVariables, getSessionDetails, killSessions, listSessions, serverVariableSql, setServerVariable, variableChangeNeedsTypedConfirmation, type KillMode, type VariableApplyMode, type VariableInfo } from '../../modules/sessions/index.js'
import type { SqlClient } from '../../modules/sql.js'
import type { IpcDeps } from './registry.js'

function clientFor(driver: IpcDeps['driver'], connectionId: string): SqlClient {
  return {
    query: (sql, parameters = []) => driver.queryRows(connectionId, sql, [...parameters]),
    execute: async (sql) => { await driver.executeSql(connectionId, sql) }
  }
}

async function currentId(client: SqlClient): Promise<number> {
  const id = Number((await client.query('SELECT CONNECTION_ID() AS id'))[0]?.id)
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Could not identify the current session; the operation was cancelled for safety.')
  return id
}

async function ensureWritable(client: SqlClient): Promise<void> {
  const row = (await client.query('SELECT @@SESSION.transaction_read_only AS readOnly'))[0]
  if (row && (row.readOnly === true || Number(row.readOnly) === 1)) throw new Error('The session is marked read-only.')
}

export function registerSessionsIpc({ driver }: IpcDeps): void {
  ipcMain.handle('sessions:list', async (_event, connectionId: string, filters = {}) => {
    const client = clientFor(driver, connectionId)
    return listSessions(client, { ...filters, currentId: await currentId(client) })
  })
  ipcMain.handle('sessions:details', (_event, connectionId: string, id: number) => getSessionDetails(clientFor(driver, connectionId), id))
  ipcMain.handle('sessions:kill', async (_event, connectionId: string, ids: number[], mode: KillMode, confirm: true) => {
    if (confirm !== true) throw new Error('Ending sessions requires explicit confirmation.')
    const client = clientFor(driver, connectionId)
    await ensureWritable(client)
    return killSessions(client, ids, mode, { confirm: true, currentId: await currentId(client) })
  })
  ipcMain.handle('sessions:variables', (_event, connectionId: string, scope: 'GLOBAL' | 'SESSION' = 'GLOBAL') => getServerVariables(clientFor(driver, connectionId), scope))
  ipcMain.handle('sessions:status', (_event, connectionId: string, scope: 'GLOBAL' | 'SESSION' = 'GLOBAL') => getServerStatus(clientFor(driver, connectionId), scope))
  type VariableRequest = { name: string; newValue: string; scope: 'GLOBAL' | 'SESSION' }
  const resolveVariable = async (client: SqlClient, change: VariableRequest): Promise<{ variable: VariableInfo; value: string | number }> => {
    const snapshot = await getServerVariables(client, change.scope)
    const variable = snapshot.variables.find((item) => item.name === change.name)
    if (!variable) throw new Error(`Variable ${change.name} was not found.`)
    return { variable, value: variable.type === 'number' ? Number(change.newValue) : change.newValue }
  }
  const modeOf = (options: { persist?: boolean; mode?: VariableApplyMode } | undefined): VariableApplyMode => {
    const mode = options?.mode ?? (options?.persist ? 'persist' : 'set')
    if (mode !== 'set' && mode !== 'persist' && mode !== 'persist-only') throw new Error('Unsupported variable apply mode.')
    return mode
  }
  ipcMain.handle('sessions:preview-variable', async (_event, connectionId: string, change: VariableRequest, options?: { persist?: boolean; mode?: VariableApplyMode }) => {
    const mode = modeOf(options)
    const { variable, value } = await resolveVariable(clientFor(driver, connectionId), change)
    return { sql: serverVariableSql(change.name, value, change.scope, { ...variable, mode }), oldValue: variable.value, requiresTypedConfirmation: variableChangeNeedsTypedConfirmation(change.scope, mode) }
  })
  ipcMain.handle('sessions:set-variable', async (_event, connectionId: string, change: VariableRequest, options: { confirm: true; persist?: boolean; mode?: VariableApplyMode; confirmation?: string }) => {
    if (options?.confirm !== true) throw new Error('Applying variables requires explicit confirmation.')
    const mode = modeOf(options)
    const client = clientFor(driver, connectionId)
    await ensureWritable(client)
    const { variable, value } = await resolveVariable(client, change)
    return setServerVariable(client, change.name, value, change.scope, { ...variable, confirm: true, mode, confirmation: options.confirmation })
  })
}
