import type { Writable } from 'node:stream'
import type { DbDriver, SqlValue } from '../../main/db/DbDriver.js'

export interface DataCompareEndpoint { driver: DbDriver; connectionId: string; database: string; table: string }
export type DataDifferenceKind = 'same' | 'different' | 'source-only' | 'target-only'
export interface DataCompareDifference { kind: DataDifferenceKind; key: Record<string, unknown>; source?: Record<string, unknown>; target?: Record<string, unknown>; changedColumns?: string[] }
export interface SyncStatement { sql: string; values: readonly SqlValue[]; kind: 'INSERT' | 'UPDATE' | 'DELETE' }

export interface DataCompareJob {
  source: DataCompareEndpoint
  target: DataCompareEndpoint
  keyColumns: string[]
  columns?: string[]
  allowDeletes?: boolean
  signal?: AbortSignal
  script?: Writable
  onDifference?: (difference: DataCompareDifference) => void | Promise<void>
  onStatement?: (statement: SyncStatement) => void | Promise<void>
  onProgress?: (progress: { compared: number; same: number; different: number; sourceOnly: number; targetOnly: number }) => void
}

export interface DataCompareReport { compared: number; same: number; different: number; sourceOnly: number; targetOnly: number; statements: number }
