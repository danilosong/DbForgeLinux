import type { DbDriver } from '../../main/db/DbDriver.js'
import type { DatabaseModel, TableModel } from '../schema/model.js'

export type GeneratorKind = 'auto' | 'name' | 'email' | 'address' | 'date' | 'number' | 'lorem' | 'list' | 'regex' | 'sequence' | 'unique' | 'foreignKey' | 'fromTable'
export type Locale = 'pt-BR' | 'en-US'

export interface GeneratorSpec {
  kind?: GeneratorKind
  values?: readonly unknown[]
  pattern?: string
  min?: number
  max?: number
  start?: number
  step?: number
  nullPercent?: number
  source?: { connectionId?: string; database?: string; table: string; column: string }
  format?: 'date' | 'datetime' | 'timestamp'
}

export interface DataGenerationJob {
  driver: DbDriver
  connectionId: string
  database: string
  schema: DatabaseModel
  tables?: string[]
  rowsPerTable: number | Record<string, number>
  generators?: Record<string, GeneratorSpec>
  locale?: Locale
  seed?: number | string
  batchSize?: number
  signal?: AbortSignal
  onProgress?: (progress: { table: string; generated: number; inserted: number; total: number }) => void
}

export interface DataGenerationPreviewJob {
  schema: DatabaseModel
  table: TableModel
  count: number
  generators?: Record<string, GeneratorSpec>
  locale?: Locale
  seed?: number | string
  driver?: DbDriver
  connectionId?: string
  database?: string
  signal?: AbortSignal
}

export interface DataGenerationReport {
  generated: number
  inserted: number
  tables: Record<string, { generated: number; inserted: number }>
}
