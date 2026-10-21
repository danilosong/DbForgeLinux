import type { PivotAggregation, PivotConfig, PivotGrouping } from './types.js'

export type PivotFieldRole = 'none' | 'rows' | 'columns' | 'values' | 'filter'

export function buildPivotConfigFromRoles(
  fields: string[],
  roles: Record<string, PivotFieldRole>,
  dateGrouping: Record<string, PivotGrouping[]>,
  aggregationByField: Record<string, PivotAggregation>,
  options: Pick<PivotConfig, 'filters' | 'rowTotals' | 'columnTotals' | 'grandTotal' | 'subtotals'>
): PivotConfig {
  const grouped = (role: 'rows' | 'columns') => fields.filter((field) => roles[field] === role).flatMap((field) =>
    dateGrouping[field]?.length
      ? dateGrouping[field]!.map((grouping) => ({ field, grouping, label: `${field} ${grouping}` }))
      : [{ field }])
  return {
    filters: options.filters,
    rowTotals: options.rowTotals,
    columnTotals: options.columnTotals,
    grandTotal: options.grandTotal,
    subtotals: options.subtotals,
    rows: grouped('rows'),
    columns: grouped('columns'),
    values: fields.filter((field) => roles[field] === 'values').map((field) => ({ field, aggregation: aggregationByField[field] ?? 'sum' }))
  }
}
