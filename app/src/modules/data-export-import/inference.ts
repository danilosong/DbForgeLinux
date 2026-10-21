export interface InferredColumn { name: string; type: string; primaryKey: boolean }

export function inferSqlType(values: readonly unknown[]): string {
  const present = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map(String)
  if (!present.length) return 'TEXT'
  if (present.every((value) => /^[-+]?\d+$/.test(value))) {
    const numbers = present.map((value) => BigInt(value))
    const min = numbers.reduce((a, b) => a < b ? a : b); const max = numbers.reduce((a, b) => a > b ? a : b)
    if (min >= -2147483648n && max <= 2147483647n) return 'INT'
    if (min >= -9223372036854775808n && max <= 9223372036854775807n) return 'BIGINT'
    return 'DECIMAL(65,0)'
  }
  if (present.every((value) => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value))) {
    const decimals = present.map((value) => value.toLowerCase().split('e')[0]?.split('.')[1]?.length ?? 0)
    const scale = Math.min(30, Math.max(...decimals))
    const precision = Math.min(65, Math.max(scale + 1, ...present.map((value) => value.replace(/[-+.e\d]/g, '').length + value.split('.')[0]!.replace(/\D/g, '').length + scale)))
    return `DECIMAL(${precision},${scale})`
  }
  if (present.every((value) => /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value) && !Number.isNaN(Date.parse(value)))) return 'DATETIME'
  if (present.every((value) => { try { const parsed: unknown = JSON.parse(value); return parsed !== null && typeof parsed === 'object' } catch { return false } })) return 'JSON'
  const longest = Math.max(...present.map((value) => [...value].length))
  if (longest > 1024 || present.some((value) => /[\r\n]/.test(value))) return 'TEXT'
  return `VARCHAR(${Math.max(1, longest)})`
}

export function inferImportColumns(columns: readonly string[], rows: readonly Record<string, unknown>[]): InferredColumn[] {
  return columns.map((name) => ({ name, type: inferSqlType(rows.map((row) => row[name])), primaryKey: false }))
}

const allowedType = /^(?:INT|BIGINT|DECIMAL\((?:[1-9]\d?|[1-5]\d|65),(?:0|[1-9]\d?|30)\)|DATETIME|TEXT|JSON|VARCHAR\((?:[1-9]\d{0,3}|10000)\))$/
function ident(value: string): string {
  if (!value.trim() || value.length > 64 || value.includes('\0')) throw new Error('Invalid table or column name.')
  return `\`${value.replaceAll('`', '``')}\``
}

export function buildCreateTableSql(database: string, table: string, columns: readonly InferredColumn[]): string {
  if (!columns.length || columns.length > 1000) throw new Error('A new table needs between 1 and 1000 columns.')
  const definitions = columns.map((column) => {
    const type = column.type.trim().toUpperCase()
    if (!allowedType.test(type)) throw new Error(`Unsupported inferred type: ${column.type}`)
    return `${ident(column.name)} ${type} ${column.primaryKey ? 'NOT NULL' : 'NULL'}`
  })
  const primary = columns.filter((column) => column.primaryKey)
  if (primary.length) definitions.push(`PRIMARY KEY (${primary.map((column) => ident(column.name)).join(', ')})`)
  return `CREATE TABLE ${ident(database)}.${ident(table)} (${definitions.join(', ')}) DEFAULT CHARACTER SET utf8mb4;\n`
}
