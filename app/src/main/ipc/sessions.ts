import { ipcMain } from 'electron'
import { getServerStatus, getServerVariables, getSessionDetails, killSessions, listSessions, setServerVariable, type KillMode } from '../../modules/sessions/index.js'
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
  ipcMain.handle('sessions:set-variable', async (_event, connectionId: string, change: { name: string; newValue: string; scope: 'GLOBAL' | 'SESSION' }, options: { confirm: true; persist?: boolean }) => {
    if (options?.confirm !== true) throw new Error('Applying variables requires explicit confirmation.')
    const client = clientFor(driver, connectionId)
    await ensureWritable(client)
    const snapshot = await getServerVariables(client, change.scope)
    const variable = snapshot.variables.find((item) => item.name === change.name)
    if (!variable) throw new Error(`Variable ${change.name} was not found.`)
    const value = variable.type === 'number' ? Number(change.newValue) : change.newValue
    return setServerVariable(client, change.name, value, change.scope, { ...variable, confirm: true, persist: options.persist })
  })
}
