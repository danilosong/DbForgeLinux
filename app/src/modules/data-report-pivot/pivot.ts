import type { PivotChartConfig, PivotChartData, PivotConfig, PivotField, PivotResult } from './types.js'

const scalar = (value: unknown): string => value instanceof Date ? value.toISOString() : value === null ? 'NULL' : String(value)
const keyOf = (values: unknown[]): string => JSON.stringify(values.map((value) => value instanceof Date ? value.toISOString() : value))
const compare = (left: unknown, right: unknown): number => {
  if (left === right) return 0
  if (left === null || left === undefined) return -1
  if (right === null || right === undefined) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return scalar(left).localeCompare(scalar(right), undefined, { numeric: true, sensitivity: 'base' })
}

function groupedValue(value: unknown, field: PivotField): unknown {
  if (value === null || value === undefined || !field.grouping) return value
  if (field.grouping === 'first-letter') return scalar(value).slice(0, 1).toLocaleUpperCase() || '(empty)'
  if (field.grouping === 'number-bin') {
    const number = Number(value); const interval = field.interval ?? 10
    if (!Number.isFinite(number) || !Number.isFinite(interval) || interval <= 0) return value
    return `${Math.floor(number / interval) * interval}–${Math.floor(number / interval) * interval + interval}`
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) return value
  if (field.grouping === 'year') return date.getUTCFullYear()
  if (field.grouping === 'quarter') return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`
  if (field.grouping === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  return date.toISOString().slice(0, 10)
}

function aggregate(values: unknown[], aggregation: PivotConfig['values'][number]['aggregation']): unknown {
  const usable = values.filter((value) => value !== null && value !== undefined)
  if (aggregation === 'count') return usable.length
  if (aggregation === 'distinct-count') return new Set(usable.map(scalar)).size
  if (aggregation === 'min') return usable.length ? usable.reduce((best, value) => compare(value, best) < 0 ? value : best) : null
  if (aggregation === 'max') return usable.length ? usable.reduce((best, value) => compare(value, best) > 0 ? value : best) : null
  const numbers = usable.map(Number).filter(Number.isFinite)
  if (!numbers.length) return null
  const sum = numbers.reduce((total, value) => total + value, 0)
  if (aggregation === 'average') return sum / numbers.length
  if (aggregation === 'stddev') {
    const mean = sum / numbers.length
    return Math.sqrt(numbers.reduce((total, value) => total + (value - mean) ** 2, 0) / numbers.length)
  }
  return sum
}

function valuesFor(row: Record<string, unknown>, fields: PivotField[]): unknown[] { return fields.map((field) => groupedValue(row[field.field], field)) }
function labelFor(values: unknown[], fields: PivotField[]): string { return values.map((value, index) => `${fields[index]?.label ?? fields[index]?.field ?? ''}: ${scalar(value)}`).join(' · ') || 'Grand Total' }
function compareTuple(left: unknown[], right: unknown[]): number { for (let index = 0; index < Math.max(left.length, right.length); index += 1) { const order = compare(left[index], right[index]); if (order) return order }; return 0 }

export function buildPivot(rows: Array<Record<string, unknown>>, config: PivotConfig, truncated = false): PivotResult {
  if (!config.values.length) throw new Error('Add at least one field to Data.')
  const fields = [...config.rows, ...config.columns, ...config.values.map((field) => ({ field: field.field }))]
  for (const field of fields) if (!field.field || (rows.length && !Object.hasOwn(rows[0]!, field.field))) throw new Error(`Unknown pivot field: ${field.field}`)
  const filtered = rows.filter((row) => Object.entries(config.filters ?? {}).every(([field, allowed]) => allowed.includes(row[field])))
  const rowGroups = new Map<string, { values: unknown[]; rows: Array<Record<string, unknown>> }>()
  const columnGroups = new Map<string, unknown[]>()
  for (const row of filtered) {
    const rowValues = valuesFor(row, config.rows); const rowKey = keyOf(rowValues)
    const group = rowGroups.get(rowKey) ?? { values: rowValues, rows: [] }
    group.rows.push(row); rowGroups.set(rowKey, group)
    const columnValues = valuesFor(row, config.columns); columnGroups.set(keyOf(columnValues), columnValues)
  }
  if (!config.columns.length) columnGroups.set('[]', [])
  const sortedRows = [...rowGroups.entries()].sort((a, b) => compareTuple(a[1].values, b[1].values))
  const sortedColumns = [...columnGroups.entries()].sort((a, b) => compareTuple(a[1], b[1]))
  const columnCells = sortedColumns.flatMap(([columnKey, columnValues]) => config.values.map((measure) => ({
    key: `${columnKey}::${measure.field}::${measure.aggregation}`,
    label: `${columnValues.map(scalar).join(' / ') || 'Total'} · ${measure.label ?? `${measure.aggregation}(${measure.field})`}`,
    values: columnValues, valueField: measure.field, valueLabel: measure.label ?? `${measure.aggregation}(${measure.field})`, sourceKey: columnKey
  })))
  const rowsResult: PivotResult['rows'] = sortedRows.map(([rowKey, group]) => {
    const cells: Record<string, unknown> = {}
    const allValues: Record<string, unknown> = {}
    for (const column of columnCells) {
      const subset = group.rows.filter((row) => keyOf(valuesFor(row, config.columns)) === column.sourceKey)
      const measure = config.values.find((item) => item.field === column.valueField && (item.label ?? `${item.aggregation}(${item.field})`) === column.valueLabel)!
      cells[column.key] = aggregate(subset.map((row) => row[measure.field]), measure.aggregation)
    }
    for (const measure of config.values) allValues[measure.label ?? `${measure.aggregation}(${measure.field})`] = aggregate(group.rows.map((row) => row[measure.field]), measure.aggregation)
    return { key: rowKey, values: group.values, label: labelFor(group.values, config.rows), cells, total: config.rowTotals === false ? undefined : allValues }
  })
  const rowTotals: PivotResult['rowTotals'] = config.rowTotals === false ? {} : Object.fromEntries(rowsResult.map((row) => [row.key, row.total ?? {}]))
  const columnTotals: Record<string, unknown> = {}
  for (const column of columnCells) {
    const measure = config.values.find((item) => item.field === column.valueField && (item.label ?? `${item.aggregation}(${item.field})`) === column.valueLabel)!
    const subset = filtered.filter((row) => keyOf(valuesFor(row, config.columns)) === column.sourceKey)
    columnTotals[column.key] = aggregate(subset.map((row) => row[measure.field]), measure.aggregation)
  }
  const grandTotal = Object.fromEntries(config.values.map((measure) => [measure.label ?? `${measure.aggregation}(${measure.field})`, aggregate(filtered.map((row) => row[measure.field]), measure.aggregation)]))
  const columns = columnCells.map(({ key, label, values, valueField, valueLabel }) => ({ key, label, values, valueField, valueLabel }))
  if (config.subtotals && config.rows.length > 1) {
    for (let depth = config.rows.length - 1; depth > 0; depth--) {
      const subtotalMap = new Map<string, Record<string, unknown>[]>()
      for (const row of filtered) {
        const vals = valuesFor(row, config.rows).slice(0, depth); const key = keyOf(vals)
        subtotalMap.set(key, [...(subtotalMap.get(key) ?? []), row])
      }
      for (const [key, subset] of subtotalMap) {
        const cells: Record<string, unknown> = {}
        for (const column of columnCells) {
          const measure = config.values.find((item) => item.field === column.valueField && (item.label ?? `${item.aggregation}(${item.field})`) === column.valueLabel)!
          const rowsAtCol = subset.filter((row) => keyOf(valuesFor(row, config.columns)) === column.sourceKey)
          cells[column.key] = aggregate(rowsAtCol.map((row) => row[measure.field]), measure.aggregation)
        }
        const values = JSON.parse(key) as unknown[]
        rowsResult.push({ key: `subtotal:${key}`, values, label: `${labelFor(values, config.rows.slice(0, depth))} · Subtotal`, cells, subtotal: true })
      }
    }
  }
  return { rowFields: config.rows.map((field) => field.label ?? field.field), columnFields: config.columns.map((field) => field.label ?? field.field), valueFields: config.values, columns, rows: rowsResult, rowTotals, columnTotals: config.columnTotals === false ? {} : columnTotals, grandTotal: config.grandTotal === false ? {} : grandTotal, rowCount: filtered.length, truncated }
}

export function buildPivotChart(pivot: PivotResult, config: PivotChartConfig): PivotChartData {
  const measure = config.valueField ?? pivot.valueFields[0]?.field
  const columns = pivot.columns.filter((column) => column.valueField === measure)
  const labels = pivot.rows.filter((row) => !row.subtotal).map((row) => row.label)
  const series = columns.length ? columns.map((column) => ({ name: column.label, values: pivot.rows.filter((row) => !row.subtotal).map((row) => Number(row.cells[column.key] ?? 0)) })) : [{ name: pivot.valueFields[0]?.label ?? measure ?? 'Value', values: pivot.rows.filter((row) => !row.subtotal).map((row) => Number(row.total?.[pivot.valueFields[0]?.label ?? `${pivot.valueFields[0]?.aggregation}(${measure})`] ?? 0)) }]
  return { type: config.type, title: config.title ?? 'Pivot Chart', labels, series }
}
