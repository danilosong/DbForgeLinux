import { ipcMain, BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import type { MysqlDriver } from '../db/MysqlDriver.js'
import type { ConnectionsStore } from '../connections/ConnectionsStore.js'
import type { PasswordVault } from '../security/PasswordVault.js'
import type { ConnectionRecord } from '../../shared/contracts.js'
import { registerConnectionsIpc } from './connections.js'
import { registerTasksIpc } from './tasks.js'
import { RecentTasksStore } from '../modules/tasks/RecentTasksStore.js'
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
import { registerSourceControlIpc } from './source-control.js'
import { registerObjectEditorsIpc } from './object-editors.js'
import { registerDataReportPivotIpc } from './data-report-pivot.js'
import { registerAiAssistantIpc } from './ai-assistant.js'
import { registerOptionsIpc } from './options.js'
import { SettingsStore } from '../../modules/options/index.js'
import { registerDatabaseToolsIpc } from './database-tools.js'
import { registerRoutineDebuggerIpc } from './routine-debugger.js'
import { registerServiceControlIpc } from './service-control.js'
import { registerLocalServerIpc } from './local-server.js'
import { registerCodeAnalysisIpc } from './code-analysis.js'
import { registerGridEditingIpc } from './grid-editing.js'
import { registerGridDataIpc } from './grid-data.js'
import { registerAboutIpc } from './about.js'
import { registerKeyboardInteractiveIpc } from './keyboard-interactive.js'
import { join } from 'node:path'
import { defaultTrustedRendererConfig, installIpcSecurity } from './guard.js'
import { markStartup } from '../startupTrace.js'

export interface IpcDeps {
  driver: MysqlDriver
  vault: PasswordVault
  connectionsStore: ConnectionsStore
  resolveConnectionConfig(record: ConnectionRecord): Promise<import('../db/DbDriver.js').DriverConnectionConfig>
  userDataDir: string
}
export function registerIpcRegistry(deps: IpcDeps): void {
  installIpcSecurity(defaultTrustedRendererConfig(join(__dirname, '../renderer/index.html')))
  registerKeyboardInteractiveIpc()
  let deferredInitialization: Promise<void> | undefined
  ipcMain.handle('app:renderer-ready', async () => {
    markStartup('noncritical-ipc-registration-start')
    deferredInitialization ??= (async () => {
      const [{ registerHistoryIpc }, { SqlExecutionHistoryStore }, { registerExtraToolsIpc }, { registerUpdaterIpc }] = await Promise.all([
        import('./history.js'), import('../history/SqlExecutionHistoryStore.js'), import('./extra-tools.js'), import('./updater.js')
      ])
      registerHistoryIpc(new SqlExecutionHistoryStore(join(deps.userDataDir, 'sql-execution-history.json')))
      registerExtraToolsIpc(deps)
      registerUpdaterIpc(settingsStore, deps.driver)
    })()
    await deferredInitialization
    markStartup('noncritical-ipc-registration-complete')
    return { ready: true }
  })
  registerEditorIpc(deps)
  registerTasksIpc(new RecentTasksStore(join(deps.userDataDir, 'recent-tasks.json')))
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
  const settingsStore = new SettingsStore(join(deps.userDataDir, 'settings.json'))
  registerOptionsIpc(settingsStore)
  registerDatabaseToolsIpc(deps)
  registerRoutineDebuggerIpc(deps)
  registerServiceControlIpc()
  registerLocalServerIpc(deps)
  registerCodeAnalysisIpc()
  registerGridEditingIpc(deps)
  registerGridDataIpc(deps)
  registerAboutIpc()
}
export { ipcMain, BrowserWindow, dialog, readFile, writeFile }
export type { OpenDialogOptions, SaveDialogOptions }
