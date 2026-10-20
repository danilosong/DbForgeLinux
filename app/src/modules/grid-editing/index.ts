export interface EditableColumn { name: string; dataType: string; columnType: string; nullable: boolean; defaultValue: unknown; extra: string }
export interface EditableResult { database: string; table: string; keyColumns: string[]; columns: EditableColumn[]; reason?: string }
export type GridChange = { kind: 'update'; original: Record<string, unknown>; values: Record<string, unknown> } | { kind: 'insert'; values: Record<string, unknown> } | { kind: 'delete'; original: Record<string, unknown> }

export function parseSimpleSelect(sql: string, defaultDatabase?: string): { database: string; table: string } | undefined {
  const match = /^\s*SELECT\s+\*\s+FROM\s+(?:`((?:``|[^`])+)`|([\w$]+))(?:\s*\.\s*(?:`((?:``|[^`])+)`|([\w$]+)))?(?:\s+WHERE\s+[\s\S]+?)?(?:\s+ORDER\s+BY\s+[\s\S]+?)?(?:\s+LIMIT\s+\d+(?:\s*,\s*\d+)?(?:\s+OFFSET\s+\d+)?)?\s*;?\s*$/i.exec(sql)
  if (!match || /\b(UNION|JOIN|GROUP\s+BY|HAVING|INTO|FOR\s+UPDATE|LOCK\s+IN\s+SHARE)\b/i.test(sql) || /--|\/\*|#/.test(sql)) return undefined
  const first = (match[1] ?? match[2]).replaceAll('``', '`')
  const second = (match[3] ?? match[4])?.replaceAll('``', '`')
  return second ? { database: first, table: second } : defaultDatabase ? { database: defaultDatabase, table: first } : undefined
}

export function quoteIdentifier(value: string): string { return `\`${value.replaceAll('`', '``')}\`` }
export function makeWhere(row: Record<string, unknown>, columns: string[]): { sql: string; values: unknown[] } {
  return { sql: columns.map((column) => `${quoteIdentifier(column)} <=> ?`).join(' AND '), values: columns.map((column) => row[column] ?? null) }
}

export function buildGridChange(change: GridChange, descriptor: EditableResult): { sql: string; values: unknown[] } {
  const table = `${quoteIdentifier(descriptor.database)}.${quoteIdentifier(descriptor.table)}`
  if (change.kind === 'insert') {
    const columns = descriptor.columns.filter((column) => Object.hasOwn(change.values, column.name) && !(column.extra.toLowerCase().includes('auto_increment') && (change.values[column.name] === null || change.values[column.name] === undefined)))
    return { sql: `INSERT INTO ${table} (${columns.map((column) => quoteIdentifier(column.name)).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values: columns.map((column) => change.values[column.name] ?? null) }
  }
  const where = makeWhere(change.original, descriptor.columns.map((column) => column.name))
  if (change.kind === 'delete') return { sql: `DELETE FROM ${table} WHERE ${where.sql}`, values: where.values }
  const changed = descriptor.columns.filter((column) => Object.hasOwn(change.values, column.name) && !Object.is(change.original[column.name], change.values[column.name]))
  if (!changed.length) return { sql: '', values: [] }
  return { sql: `UPDATE ${table} SET ${changed.map((column) => `${quoteIdentifier(column.name)} = ?`).join(', ')} WHERE ${where.sql}`, values: [...changed.map((column) => change.values[column.name] ?? null), ...where.values] }
}

export function validateGridValue(column: EditableColumn, value: unknown): string | undefined {
  if (value === null) return column.nullable ? undefined : `${column.name} cannot be NULL.`
  if (value === undefined) return undefined
  const text = String(value)
  if (/^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)/i.test(column.dataType) && text !== '' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return `Enter a valid ${column.dataType} value.`
  if (/^(date|datetime|timestamp|time)/i.test(column.dataType) && text !== '' && Number.isNaN(Date.parse(text.replace(' ', 'T')))) return `Enter a valid ${column.dataType} value.`
  return undefined
}
