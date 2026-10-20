import type { ConnectionRecord, ConnectionTestResult, ConnectionSummary, QueryResult, DatabaseObject, SqlFile } from './index.js'
import type { SecurityApi } from './security.js'
import type { SessionsApi } from './sessions.js'
import type { SchemaCompareApi } from './schema-compare.js'
import type { DataCompareApi } from './data-compare.js'
import type { ImportExportApi } from './import-export.js'
import type { ERDiagramApi } from './er-diagram.js'
import type { QueryBuilderApi } from './query-builder.js'
import type { EditorApi } from './editor.js'
import type { HistoryApi } from './history.js'
import type { SourceControlApi } from './source-control.js'
import type { ObjectEditorApi } from './object-editors.js'
import type { OptionsApi } from './options.js'
import type { DatabaseToolsApi } from './database-tools.js'
import type { ReportPivotApi } from './data-report-pivot.js'
import type { AiAssistantApi } from './ai-assistant.js'
import type { RoutineDebugContract } from './routine-debugger.js'
import type { ServiceControlApi } from './service-control.js'
import type { CodeAnalysisApi } from './code-analysis.js'
import type { GridEditingApi } from './grid-editing.js'
import type { GridDataApi } from './grid-data.js'
import type { ExtraToolsApi } from './extra-tools.js'
import type { AboutApi } from './about.js'
export interface DbForgeApi extends SecurityApi, SessionsApi, SchemaCompareApi, DataCompareApi, ImportExportApi, ERDiagramApi, QueryBuilderApi, EditorApi, HistoryApi, SourceControlApi, ObjectEditorApi, OptionsApi, DatabaseToolsApi, ReportPivotApi, AiAssistantApi, RoutineDebugContract, ServiceControlApi, CodeAnalysisApi, GridEditingApi, GridDataApi, ExtraToolsApi, AboutApi {
  getConnections(): Promise<ConnectionRecord[]>
  saveConnection(record: ConnectionRecord): Promise<void>
  deleteConnection(id: string): Promise<void>
  savePassword(key: string, password: string): Promise<void>
  deletePassword(key: string): Promise<void>
  getVaultStatus(): Promise<{ backend: 'system' | 'local-encrypted'; warning?: string }>
  testConnection(record: ConnectionRecord): Promise<ConnectionTestResult>
  connect(record: ConnectionRecord): Promise<ConnectionSummary>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string, executionId?: string, database?: string): Promise<QueryResult[]>
  readResultRows(resultStoreId: string, offset: number, limit: number): Promise<Array<Record<string, unknown>>>
  disposeResult(resultStoreId: string): Promise<void>
  cancelQuery(connectionId: string, executionId: string): Promise<void>
  listDatabaseObjects(connectionId: string, database: string): Promise<DatabaseObject[]>
  showCreateObject(connectionId: string, database: string, object: DatabaseObject): Promise<string>
  setDatabase(connectionId: string, database: string): Promise<void>
  beginTransaction(connectionId: string): Promise<void>
  commitTransaction(connectionId: string): Promise<void>
  rollbackTransaction(connectionId: string): Promise<void>
  openSqlFile(): Promise<SqlFile | null>
  openSqlPath(path: string): Promise<SqlFile>
  onOpenSqlPath(handler: (path: string) => void): () => void
  saveSqlFile(path: string | undefined, contents: string): Promise<string | null>
}
