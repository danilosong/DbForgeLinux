import { formatGridCopy } from '../grid-viewer/index.js'
import type { DataCompareDifference } from './types.js'

export type ComparisonReportFormat = 'csv' | 'excel' | 'html'
export type ComparisonReportScope = 'all' | 'different' | 'selected'

export function buildComparisonReport(rows: DataCompareDifference[], format: ComparisonReportFormat, scope: ComparisonReportScope = 'all', selectedKeys: ReadonlySet<string> = new Set()): string {
  const filtered = rows.filter((row) => scope === 'all' || (scope === 'different' ? row.kind !== 'same' : selectedKeys.has(`${row.objectName ?? ''}\u0000${JSON.stringify(row.key)}`)))
  const data = filtered.map((row) => ({ object: row.objectName ?? '', status: row.kind, key: JSON.stringify(row.key), source: JSON.stringify(row.source ?? {}), target: JSON.stringify(row.target ?? {}), changedColumns: (row.changedColumns ?? []).join(', ') }))
  const columns = ['object', 'status', 'key', 'source', 'target', 'changedColumns']
  return formatGridCopy(data, columns, format)
}
