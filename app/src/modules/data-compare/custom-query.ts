import type { DataCompareDifference, DataCompareReport } from './types.js'

export interface CustomQueryComparison {
  report: DataCompareReport
  differences: DataCompareDifference[]
}

function normalizedValue(value: unknown, ignoreMicroseconds: boolean, roundFloats: number): unknown {
  if (typeof value === 'number' && roundFloats > 0) return Number(value.toFixed(roundFloats))
  if (!ignoreMicroseconds) return value
  if (value instanceof Date) return Math.floor(value.getTime() / 1000) * 1000
  if (typeof value === 'string') return value.replace(/(T|\s)(\d{2}:\d{2}:\d{2})\.\d+(?=(?:Z|[+-]\d{2}:?\d{2})?$)/i, '$1$2')
  return value
}

function equalValue(left: unknown, right: unknown, ignoreMicroseconds: boolean, roundFloats: number): boolean {
  const a = normalizedValue(left, ignoreMicroseconds, roundFloats)
  const b = normalizedValue(right, ignoreMicroseconds, roundFloats)
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof Uint8Array && b instanceof Uint8Array) return a.length === b.length && a.every((byte, index) => byte === b[index])
  return Object.is(a, b)
}

function rowKey(row: Record<string, unknown>, keys: string[]): string {
  const tuple = keys.map((key) => {
    const value = row[key]
    if (typeof value === 'bigint') return ['bigint', value.toString()]
    if (value instanceof Date) return ['date', value.toISOString()]
    if (value instanceof Uint8Array) return ['bytes', Array.from(value)]
    if (value === undefined) return ['undefined']
    return [typeof value, value]
  })
  return JSON.stringify(tuple)
}

/** Compares bounded SELECT result sets by explicit key columns. */
export function compareCustomQueryRows(
  sourceRows: Record<string, unknown>[],
  targetRows: Record<string, unknown>[],
  keyColumns: string[],
  columns?: string[],
  options: { ignoreMicroseconds?: boolean; roundFloats?: number } = {}
): CustomQueryComparison {
  const keys = [...new Set(keyColumns.map((key) => key.trim()).filter(Boolean))]
  if (!keys.length) throw new Error('Custom query comparison requires at least one key column.')
  const compareColumns = columns?.length ? [...new Set([...columns, ...keys])] : [...new Set([...sourceRows, ...targetRows].flatMap((row) => Object.keys(row)))]
  if (!compareColumns.length) throw new Error('The custom queries returned no comparable columns.')
  const index = (rows: Record<string, unknown>[], side: string): Map<string, { row: Record<string, unknown>; key: Record<string, unknown> }> => {
    const result = new Map<string, { row: Record<string, unknown>; key: Record<string, unknown> }>()
    for (const row of rows) {
      for (const key of keys) if (!(key in row)) throw new Error(`${side} query is missing key column "${key}".`)
      const id = rowKey(row, keys)
      if (result.has(id)) throw new Error(`${side} query returned duplicate comparison key ${id}.`)
      result.set(id, { row, key: Object.fromEntries(keys.map((key) => [key, row[key]])) })
    }
    return result
  }
  const source = index(sourceRows, 'Source'); const target = index(targetRows, 'Target')
  const identities = [...new Set([...source.keys(), ...target.keys()])]
  const differences: DataCompareDifference[] = []
  const report: DataCompareReport = { compared: 0, same: 0, different: 0, sourceOnly: 0, targetOnly: 0, statements: 0 }
  for (const id of identities) {
    const sourceEntry = source.get(id); const targetEntry = target.get(id)
    const sourceRow = sourceEntry?.row; const targetRow = targetEntry?.row
    const key = sourceEntry?.key ?? targetEntry?.key ?? {}
    report.compared++
    if (!sourceRow) { report.targetOnly++; differences.push({ kind: 'target-only', key, target: targetRow, objectName: 'Custom Query' }); continue }
    if (!targetRow) { report.sourceOnly++; differences.push({ kind: 'source-only', key, source: sourceRow, objectName: 'Custom Query' }); continue }
    const changedColumns = compareColumns.filter((column) => !equalValue(sourceRow[column], targetRow[column], Boolean(options.ignoreMicroseconds), options.roundFloats ?? 0))
    if (changedColumns.length) { report.different++; differences.push({ kind: 'different', key, source: sourceRow, target: targetRow, changedColumns, objectName: 'Custom Query' }) }
    else { report.same++; differences.push({ kind: 'same', key, source: sourceRow, target: targetRow, objectName: 'Custom Query' }) }
  }
  return { report, differences }
}

const forbiddenSelectWords = /\b(?:INSERT|UPDATE|DELETE|REPLACE|CALL|LOAD|DO|SET|USE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|LOCK|UNLOCK|HANDLER|PREPARE|EXECUTE|DEALLOCATE|INTO|SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK|LOAD_FILE)\b/i

/** Keep the custom-query workflow read-only and single-statement. */
export function validateCustomCompareQuery(sql: string): string {
  const trimmed = sql.trim()
  if (!trimmed || trimmed.length > 200_000) throw new Error('Enter a query up to 200,000 characters.')
  const withoutComments = trimmed.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ').replace(/#[^\r\n]*/g, ' ')
  const tokens = withoutComments.replace(/'(?:''|\\.|[^'])*'|"(?:""|\\.|[^"])*"|`(?:``|[^`])*`/g, ' ')
  const statements = tokens.split(';').map((part) => part.trim()).filter(Boolean)
  if (statements.length !== 1 || !/^(?:SELECT|WITH)\b/i.test(statements[0] ?? '') || forbiddenSelectWords.test(tokens)) {
    throw new Error('Custom comparison accepts one read-only SELECT or WITH query per side.')
  }
  return trimmed.replace(/;\s*$/, '')
}

/** Server-side cap prevents large custom results from being spooled before the UI can enforce its limit. */
export function boundCustomCompareQuery(sql: string, maximum = 50_001): string {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50_001) throw new RangeError('Custom comparison row limit is invalid.')
  const query = validateCustomCompareQuery(sql)
  return `SELECT * FROM (${query}) AS _dbforge_custom_result LIMIT ${maximum}`
}
