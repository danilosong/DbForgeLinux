import { ipcMain, BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import type { MysqlDriver } from '../db/MysqlDriver.js'
import type { ConnectionsStore } from '../connections/ConnectionsStore.js'
import type { PasswordVault } from '../security/PasswordVault.js'
import type { ConnectionRecord } from '../../shared/contracts.js'
import { registerConnectionsIpc } from './connections.js'
import { registerSqlIpc } from './sql.js'
import { registerSchemaIpc } from './schema.js'
import { registerSecurityIpc } from './security.js'
import { registerSessionsIpc } from './sessions.js'
import { registerProfilerIpc } from './profiler.js'
import { registerDataGeneratorIpc } from './data-generator.js'
import { registerDataCompareIpc } from './data-compare.js'
import { registerDocumenterIpc } from './documenter.js'
import { registerSchemaCompareIpc } from './schema-compare.js'
import { registerImportExportIpc } from './import-export.js'

export interface IpcDeps {
  driver: MysqlDriver
  vault: PasswordVault
  connectionsStore: ConnectionsStore
  resolveConnectionConfig(record: ConnectionRecord): Promise<import('../db/DbDriver.js').DriverConnectionConfig>
}
export function registerIpcRegistry(deps: IpcDeps): void {
  registerConnectionsIpc(deps)
  registerSqlIpc(deps)
  registerSchemaIpc(deps)
  registerSecurityIpc(deps)
  registerSessionsIpc(deps)
  registerProfilerIpc(deps)
  registerDataGeneratorIpc(deps)
  registerDataCompareIpc(deps)
  registerDocumenterIpc(deps)
  registerSchemaCompareIpc(deps)
  registerImportExportIpc(deps)
}
export { ipcMain, BrowserWindow, dialog, readFile, writeFile }
export type { OpenDialogOptions, SaveDialogOptions }
