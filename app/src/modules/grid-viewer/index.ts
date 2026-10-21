import type { EditableResult } from '../grid-editing/index.js'
import { safeCsvCell } from '../csv/safeCsv.js'

export type CopyAsFormat = 'csv' | 'tsv' | 'json' | 'insert' | 'markdown' | 'html'
export type GridQuickOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'

export function matchesGridCondition(actual: unknown, operator: GridQuickOperator, expected: unknown): boolean {
  if (operator === 'eq') return Object.is(actual, expected)
  if (operator === 'ne') return !Object.is(actual, expected)
  if (actual == null || expected == null) return false
  const left = typeof actual === 'number' ? actual : Number(actual)
  const right = typeof expected === 'number' ? expected : Number(expected)
  const a = Number.isFinite(left) && Number.isFinite(right) ? left : String(actual).toLocaleLowerCase()
  const b = Number.isFinite(left) && Number.isFinite(right) ? right : String(expected).toLocaleLowerCase()
  if (operator === 'gt') return a > b
  if (operator === 'gte') return a >= b
  if (operator === 'lt') return a < b
  return a <= b
}

export type GridScriptKind = 'insert' | 'bulk-insert' | 'where-in' | 'where-and' | 'where-or' | 'update'
export function generateGridScript(rows: Array<Record<string, unknown>>, columns: string[], kind: GridScriptKind, descriptor?: EditableResult, filterColumn?: string): string {
  if (!rows.length) return ''
  if (!descriptor?.database || !descriptor.table) throw new Error('Script generation needs a table result.')
  const table = `${quote(descriptor.database)}.${quote(descriptor.table)}`
  if (kind === 'where-in') {
    if (!filterColumn || !columns.includes(filterColumn)) throw new Error('Choose a result column for the WHERE IN script.')
    return `${table} WHERE ${quote(filterColumn)} IN (${[...new Set(rows.map((row) => row[filterColumn]))].map(sqlValue).join(', ')});`
  }
  if (kind === 'where-and' || kind === 'where-or') {
    const joiner = kind === 'where-and' ? ' AND ' : ' OR '
    return rows.map((row) => `SELECT * FROM ${table} WHERE ${columns.map((column) => `${quote(column)} ${row[column] == null ? 'IS NULL' : `= ${sqlValue(row[column])}`}`).join(joiner)};`).join('\n')
  }
  if (kind === 'insert' || kind === 'bulk-insert') {
    const values = rows.map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
    return kind === 'insert'
      ? values.map((value) => `INSERT INTO ${table} (${columns.map(quote).join(', ')}) VALUES ${value};`).join('\n')
      : `INSERT INTO ${table} (${columns.map(quote).join(', ')}) VALUES\n  ${values.join(',\n  ')};`
  }
  const keyColumns = descriptor.keyColumns.filter((column) => columns.includes(column))
  if (!keyColumns.length) throw new Error('UPDATE generation needs a selected result key.')
  return rows.map((row) => `UPDATE ${table} SET ${columns.filter((column) => !keyColumns.includes(column)).map((column) => `${quote(column)} = ${sqlValue(row[column])}`).join(', ')} WHERE ${keyColumns.map((column) => `${quote(column)} ${row[column] == null ? 'IS NULL' : `= ${sqlValue(row[column])}`}`).join(' AND ')};`).join('\n')
}

export function formatGridCopy(rows: Array<Record<string, unknown>>, columns: string[], format: CopyAsFormat, descriptor?: EditableResult, headers = true): string {
  const selected = rows.map((row) => columns.map((column) => row[column]))
  if (format === 'json') return safeJson(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))))
  if (format === 'tsv') return (headers ? [columns, ...selected] : selected).map((row) => row.map((value) => display(value).replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t')).join('\r\n')
  if (format === 'csv') return (headers ? [columns, ...selected] : selected).map((row) => row.map(safeCsvCell).join(',')).join('\r\n')
  if (format === 'insert') {
    if (!descriptor?.table || !descriptor.database) throw new Error('INSERT copy needs a table result.')
    const table = `\`${descriptor.database.replaceAll('`', '``')}\`.\`${descriptor.table.replaceAll('`', '``')}\``
    return rows.map((row) => `INSERT INTO ${table} (${columns.map(quote).join(', ')}) VALUES (${columns.map((column) => sqlValue(row[column])).join(', ')});`).join('\n')
  }
  if (format === 'markdown') return [headers ? `| ${columns.map(markdownCell).join(' | ')} |` : '', headers ? `| ${columns.map(() => '---').join(' | ')} |` : '', ...selected.map((row) => `| ${row.map((value) => markdownCell(display(value))).join(' | ')} |`)].filter(Boolean).join('\n')
  return `<!doctype html><meta charset="utf-8"><table><thead>${headers ? `<tr>${columns.map((column) => `<th>${htmlCell(column)}</th>`).join('')}</tr>` : ''}</thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${htmlCell(display(row[column]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

export interface ColumnStatistics { count: number; nulls: number; distinct: number; min: string; max: string }
export function columnStatistics(rows: Array<Record<string, unknown>>, column: string): ColumnStatistics {
  const values = rows.map((row) => row[column]); const nonNull = values.filter((value) => value !== null && value !== undefined)
  const sorted = [...nonNull].sort(compare)
  return { count: rows.length, nulls: values.length - nonNull.length, distinct: new Set(nonNull.map(distinctKey)).size, min: sorted.length ? display(sorted[0]) : '—', max: sorted.length ? display(sorted.at(-1)) : '—' }
}

export type PivotAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max'
export interface QuickPivotRow { group: string; value: number }
export function quickPivot(rows: Array<Record<string, unknown>>, groupColumn: string, valueColumn: string, aggregation: PivotAggregation): QuickPivotRow[] {
  const groups = new Map<string, unknown[]>()
  for (const row of rows) { const key = display(row[groupColumn] ?? 'NULL'); const values = groups.get(key) ?? []; values.push(row[valueColumn]); groups.set(key, values) }
  return [...groups].map(([group, values]) => {
    const numbers = values.map(Number).filter(Number.isFinite)
    const value = aggregation === 'count' ? values.filter((item) => item !== null && item !== undefined).length : aggregation === 'sum' ? numbers.reduce((sum, item) => sum + item, 0) : aggregation === 'avg' ? numbers.length ? numbers.reduce((sum, item) => sum + item, 0) / numbers.length : 0 : aggregation === 'min' ? numbers.length ? Math.min(...numbers) : 0 : numbers.length ? Math.max(...numbers) : 0
    return { group, value }
  }).sort((left, right) => left.group.localeCompare(right.group, undefined, { numeric: true }))
}

export function display(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return `[BLOB ${value.byteLength} B]`
  return typeof value === 'object' ? safeJson(value) : String(value)
}
function safeJson(value: unknown): string { return JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? String(item) : item instanceof Uint8Array ? `0x${toHex(item)}` : item, 2) }
function quote(value: string): string { return `\`${value.replaceAll('`', '``')}\`` }
function sqlValue(value: unknown): string { if (value === null || value === undefined) return 'NULL'; if (typeof value === 'number' || typeof value === 'bigint') return String(value); if (typeof value === 'boolean') return value ? '1' : '0'; if (value instanceof Uint8Array) return `X'${toHex(value)}'`; if (value instanceof Date) value = value.toISOString().replace('T', ' ').replace('Z', ''); return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'` }
function markdownCell(value: unknown): string { return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>') }
function htmlCell(value: unknown): string { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;') }
function compare(left: unknown, right: unknown): number { if (left === right) return 0; if (typeof left === 'number' && typeof right === 'number') return left - right; return String(left).localeCompare(String(right), undefined, { numeric: true }) }
function distinctKey(value: unknown): string { if (value instanceof Uint8Array) return `binary:${toHex(value)}`; if (value instanceof Date) return `date:${value.toISOString()}`; if (typeof value === 'bigint') return `bigint:${value}`; return `${typeof value}:${JSON.stringify(value)}` }
function toHex(value: Uint8Array): string { return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('') }
