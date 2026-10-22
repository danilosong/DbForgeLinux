import { ipcMain } from 'electron'
import type { SqlClient } from '../../modules/sql.js'
import { applySecurityPlan, buildSecurityPlan, getUserSecurityDetails, listAccounts, supportedPrivileges, type AccountRef, type SecurityChange } from '../../modules/security/index.js'
import type { IpcDeps } from './registry.js'

export function accountFromCurrentUser(value: unknown): AccountRef {
  const account = String(value ?? '')
  const separator = account.lastIndexOf('@')
  if (separator < 1 || separator === account.length - 1) throw new Error('Could not identify the account for this connection.')
  return { user: account.slice(0, separator), host: account.slice(separator + 1) }
}

function clientFor(driver: IpcDeps['driver'], connectionId: string): SqlClient {
  return {
    query: (sql, parameters = []) => driver.queryRows(connectionId, sql, [...parameters]),
    execute: async (sql) => { await driver.executeSql(connectionId, sql) }
  }
}

async function currentAccount(client: SqlClient): Promise<AccountRef> {
  const row = (await client.query('SELECT CURRENT_USER() AS account'))[0]
  return accountFromCurrentUser(row?.account)
}

export function registerSecurityIpc({ driver }: IpcDeps): void {
  ipcMain.handle('security:accounts', (_event, connectionId: string) => listAccounts(clientFor(driver, connectionId)))
  ipcMain.handle('security:privileges', async (_event, connectionId: string) => {
    const rows = await clientFor(driver, connectionId).query('SHOW PRIVILEGES')
    return supportedPrivileges(rows)
  })
  ipcMain.handle('security:details', (_event, connectionId: string, ref: AccountRef) => getUserSecurityDetails(clientFor(driver, connectionId), ref))
  ipcMain.handle('security:preview', async (_event, connectionId: string, changes: SecurityChange[]) => {
    const client = clientFor(driver, connectionId)
    return buildSecurityPlan(changes, { currentAccount: await currentAccount(client), confirm: true })
  })
  ipcMain.handle('security:apply', async (_event, connectionId: string, changes: SecurityChange[], confirm: true) => {
    if (confirm !== true) throw new Error('Applying security changes requires explicit confirmation.')
    const client = clientFor(driver, connectionId)
    const plan = buildSecurityPlan(changes, { currentAccount: await currentAccount(client), confirm: true })
    return applySecurityPlan(client, plan, true)
  })
}
