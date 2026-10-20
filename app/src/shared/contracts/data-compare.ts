import type { DataCompareDifference, DataCompareReport } from '../../modules/data-compare/index.js'
export interface DataCompareResult { report: DataCompareReport; differences: DataCompareDifference[] }
export interface DataCompareApi {
  compareData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[]): Promise<DataCompareResult>
  synchronizeData(sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean): Promise<{ succeeded: number; failed: number; errors: string[] }>
}
