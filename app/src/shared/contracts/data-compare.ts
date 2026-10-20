import type { DataCompareDifference, DataCompareReport } from '../../modules/data-compare/index.js'
import type { SyncStatement } from '../../modules/data-compare/types.js'
export interface KeyedSyncStatement { key: Record<string, unknown>; statement: SyncStatement }
export interface DataCompareResult { report: DataCompareReport; differences: DataCompareDifference[]; statements: SyncStatement[]; keyedStatements: KeyedSyncStatement[] }
export interface DataCompareApi {
  compareData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[], allowDeletes?: boolean): Promise<DataCompareResult>
  synchronizeData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean, selectedKeys?: Record<string, unknown>[]): Promise<{ succeeded: number; failed: number; errors: string[] }>
}
