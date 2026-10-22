import type { SchemaUpdateInput, SchemaUpdateItem } from '../../modules/schema-update/index.js'
import type { UserSnippet } from '../../modules/editor/snippetStore.js'

export interface ExtraToolsApi {
  listSchemaUpdates(): Promise<SchemaUpdateItem[]>
  queueSchemaUpdate(input: SchemaUpdateInput): Promise<SchemaUpdateItem>
  queueTableSchemaUpdate(connectionId: string, database: string, original: import('../../modules/schema/model.js').TableModel | null, target: import('../../modules/schema/model.js').TableModel): Promise<SchemaUpdateItem>
  removeSchemaUpdates(ids: string[]): Promise<void>
  executeSchemaUpdates(ids: string[], confirmed: boolean): Promise<{ succeeded: number; failed: number; errors: string[] }>
  listUserSnippets(): Promise<UserSnippet[]>
  saveUserSnippet(value: Partial<UserSnippet>): Promise<UserSnippet>
  deleteUserSnippet(id: string): Promise<void>
  importUserSnippets(locale: 'en' | 'pt-BR'): Promise<{ count: number } | null>
  exportUserSnippets(locale: 'en' | 'pt-BR'): Promise<string | null>
  getBackupSchedules(): Promise<import('../../modules/database-tools/scheduler.js').BackupSchedule[]>
  getFailedBackupSchedules(): Promise<string[]>
  saveBackupSchedule(schedule: Partial<import('../../modules/database-tools/scheduler.js').BackupSchedule>): Promise<import('../../modules/database-tools/scheduler.js').BackupSchedule>
  deleteBackupSchedule(id: string): Promise<void>
}
