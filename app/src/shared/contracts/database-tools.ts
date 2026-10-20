import type { InvalidObject, ObjectSearchHit } from '../../modules/database-tools/index.js'
import type { RestoreReport } from '../../modules/database-tools/backup.js'
export type { InvalidObject, ObjectSearchHit } from '../../modules/database-tools/index.js'
export type { RestoreReport } from '../../modules/database-tools/backup.js'
export interface InvalidObjectReport { checked: number; invalid: InvalidObject[]; errors: InvalidObject[] }
export interface DatabaseToolsApi {
  searchDatabaseObjects(connectionId: string, database: string, query: string, options: { names: boolean; definitions: boolean; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }): Promise<ObjectSearchHit[]>
  findInvalidDatabaseObjects(connectionId: string, database: string): Promise<InvalidObjectReport>
  backupDatabase(connectionId: string, database: string, includeData: boolean): Promise<{ path: string; rows: number; skipped: string[] } | null>
  selectBackupToRestore(): Promise<{ name: string; contents: string } | null>
  restoreDatabaseBackup(connectionId: string, database: string, confirmation: string, script: string, continueOnError?: boolean): Promise<RestoreReport>
  copyDatabase(sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, confirmation: string, includeData: boolean): Promise<RestoreReport & { rows: number; skipped: string[] }>
}
