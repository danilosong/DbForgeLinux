import type { InvalidObject, ObjectSearchHit } from '../../modules/database-tools/index.js'
import type { RestoreReport } from '../../modules/database-tools/backup.js'
export type { InvalidObject, ObjectSearchHit } from '../../modules/database-tools/index.js'
export type { RestoreReport } from '../../modules/database-tools/backup.js'
export interface InvalidObjectReport { checked: number; invalid: InvalidObject[]; errors: InvalidObject[] }
export interface DatabaseToolsApi {
  searchDatabaseObjects(connectionId: string, database: string, query: string, options: { names: boolean; definitions: boolean; data?: boolean; objectKinds?: string[]; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }): Promise<ObjectSearchHit[]>
  findInvalidDatabaseObjects(connectionId: string, database: string): Promise<InvalidObjectReport>
  backupDatabase(connectionId: string, database: string, includeData: boolean): Promise<{ path: string; rows: number; skipped: string[] } | null>
  selectBackupToRestore(): Promise<{ name: string; contents: string } | null>
  restoreDatabaseBackup(connectionId: string, database: string, confirmation: string, script: string, continueOnError?: boolean): Promise<RestoreReport>
  copyDatabase(sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, confirmation: string, includeData: boolean, dropIfExists?: boolean): Promise<RestoreReport & { rows: number; skipped: string[] }>
  selectSqlBatchPaths(directories: boolean): Promise<string[]>
  formatSqlFiles(paths: string[], backup: boolean, recursive: boolean, formatOptions: import('../../modules/editor/formatter.js').SqlFormatOptions): Promise<import('../../modules/editor/batchFormatter.js').BatchFormatResult[]>
  previewSqlFiles(paths: string[], recursive: boolean, formatOptions: import('../../modules/editor/formatter.js').SqlFormatOptions): Promise<Array<{ path: string; formatted: string; changed: boolean }>>
  selectLargeScript(): Promise<{ path: string; name: string; size: number } | null>
  executeLargeScript(connectionId: string, database: string, path: string, encoding: import('../../modules/database-tools/largeScript.js').ScriptEncoding, requestId: string): Promise<{ statements: number; skipped: number; stopped: boolean; failures: import('../../modules/database-tools/largeScript.js').ScriptError[] }>
  cancelLargeScript(requestId: string): Promise<void>
  respondLargeScriptError(requestId: string, action: import('../../modules/database-tools/largeScript.js').ScriptErrorAction): Promise<void>
  maintainTables(connectionId: string, database: string, operation: 'ANALYZE' | 'OPTIMIZE' | 'CHECK' | 'REPAIR' | 'CHECKSUM', tables: string[]): Promise<Array<{ table: string; status: string; message: string }>>
  onLargeScriptProgress(listener: (event: { requestId: string; progress: import('../../modules/database-tools/largeScript.js').ScriptProgress; error?: import('../../modules/database-tools/largeScript.js').ScriptError }) => void): () => void
}
