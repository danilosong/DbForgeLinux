import type { DataCompareDifference, DataCompareReport } from '../../modules/data-compare/index.js'
import type { DataCompareOptions, SyncStatement } from '../../modules/data-compare/types.js'
export interface KeyedSyncStatement { key: Record<string, unknown>; statement: SyncStatement; objectName?: string }
export interface DataCompareResult { report: DataCompareReport; differences: DataCompareDifference[]; statements: SyncStatement[]; keyedStatements: KeyedSyncStatement[] }
export interface DataCompareApi {
  compareData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[], allowDeletes?: boolean, options?: DataCompareOptions): Promise<DataCompareResult>
  synchronizeData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean, selectedKeys?: Record<string, unknown>[], options?: DataCompareOptions, beforeSync?: string, afterSync?: string, typedDatabase?: string, confirmDestructive?: boolean): Promise<{ succeeded: number; failed: number; errors: string[] }>
}
