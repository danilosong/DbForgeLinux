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
import { registerERDiagramIpc } from './er-diagram.js'
import { registerQueryBuilderIpc } from './query-builder.js'
import { registerEditorIpc } from './editor.js'
import { registerHistoryIpc } from './history.js'
import { registerSourceControlIpc } from './source-control.js'
import { registerObjectEditorsIpc } from './object-editors.js'
import { registerDataReportPivotIpc } from './data-report-pivot.js'
import { registerAiAssistantIpc } from './ai-assistant.js'
import { registerOptionsIpc } from './options.js'
import { SettingsStore } from '../../modules/options/index.js'
import { registerDatabaseToolsIpc } from './database-tools.js'
import { registerRoutineDebuggerIpc } from './routine-debugger.js'
import { registerServiceControlIpc } from './service-control.js'
import { registerCodeAnalysisIpc } from './code-analysis.js'
import { registerGridEditingIpc } from './grid-editing.js'
import { SqlExecutionHistoryStore } from '../history/SqlExecutionHistoryStore.js'
import { join } from 'node:path'
import { defaultTrustedRendererConfig, installIpcSecurity } from './guard.js'

export interface IpcDeps {
  driver: MysqlDriver
  vault: PasswordVault
  connectionsStore: ConnectionsStore
  resolveConnectionConfig(record: ConnectionRecord): Promise<import('../db/DbDriver.js').DriverConnectionConfig>
  userDataDir: string
}
export function registerIpcRegistry(deps: IpcDeps): void {
  installIpcSecurity(defaultTrustedRendererConfig(join(__dirname, '../renderer/index.html')))
  registerEditorIpc(deps)
  registerHistoryIpc(new SqlExecutionHistoryStore(join(deps.userDataDir, 'sql-execution-history.json')))
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
  registerERDiagramIpc(deps)
  registerQueryBuilderIpc(deps)
  registerSourceControlIpc(deps)
  registerObjectEditorsIpc(deps)
  registerDataReportPivotIpc(deps)
  registerAiAssistantIpc(deps)
  registerOptionsIpc(new SettingsStore(join(deps.userDataDir, 'settings.json')))
  registerDatabaseToolsIpc(deps)
  registerRoutineDebuggerIpc(deps)
  registerServiceControlIpc()
  registerCodeAnalysisIpc()
  registerGridEditingIpc(deps)
}
export { ipcMain, BrowserWindow, dialog, readFile, writeFile }
export type { OpenDialogOptions, SaveDialogOptions }
