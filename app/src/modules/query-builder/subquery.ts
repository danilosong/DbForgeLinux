import type { QueryTable } from './types.js'
import { quoteIdentifier } from './sql.js'

function selectStatement(sql: string): string {
  const normalized = sql.trim().replace(/;+\s*$/, '')
  if (!normalized || normalized.length > 1_000_000 || !/^SELECT\b/i.test(normalized) || /;/.test(normalized)) throw new Error('Wrap requires one SELECT statement.')
  return normalized
}

export function wrapSelectAsSubquery(sql: string, alias = 'source_query'): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(alias)) throw new Error('Invalid subquery alias.')
  return `SELECT *\nFROM (\n${selectStatement(sql)}\n) AS ${quoteIdentifier(alias)}`
}

export function wrapSelectAsInsert(sql: string, table: QueryTable): string {
  if (!table.database || !table.name || !table.columns.length) throw new Error('Choose a destination table with columns.')
  const destination = `${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}`
  const columns = table.columns.map((column) => quoteIdentifier(column.name)).join(', ')
  return `INSERT INTO ${destination} (${columns})\n${selectStatement(sql)}`
}
