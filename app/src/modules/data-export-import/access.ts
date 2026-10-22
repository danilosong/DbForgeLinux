import { lstat } from 'node:fs/promises'
import { extname } from 'node:path'

export interface AccessTableColumn { name: string; type: string; primaryKey: boolean }
export interface AccessTableSchema { name: string; columns: AccessTableColumn[] }

export async function validateAccessFile(file: string, maxFileBytes: number): Promise<{ size: number; modified: number }> {
  if (!['.mdb', '.accdb'].includes(extname(file).toLocaleLowerCase('en-US'))) throw new Error('Select an Access .mdb or .accdb file.')
  const details = await lstat(file)
  if (!details.isFile()) throw new Error('The selected Access path must be a regular file, not a link or directory.')
  if (!details.size) throw new Error('The selected Access file is empty.')
  if (details.size > maxFileBytes) throw new Error(`The Access file exceeds the configured ${maxFileBytes} byte limit.`)
  return { size: details.size, modified: details.mtimeMs }
}

export function parseAccessTables(stdout: string): string[] {
  const tables = stdout.split(/\r?\n/).map((table) => table.trim()).filter(Boolean)
  if (!tables.length || tables.length > 500 || tables.some((table) => table.length > 255 || table.includes('\0'))) {
    throw new Error('The Access file has no valid tables or exceeds the 500-table safety limit.')
  }
  return tables
}

function mapAccessType(accessType: string): string {
  const type = accessType.trim()
  if (/^Long Integer$/i.test(type)) return 'INT'
  if (/^(?:Integer|Short Integer)$/i.test(type)) return 'SMALLINT'
  if (/^Byte$/i.test(type)) return 'TINYINT UNSIGNED'
  if (/^(?:BigInt|Large Number)$/i.test(type)) return 'BIGINT'
  if (/^Currency$/i.test(type)) return 'DECIMAL(19,4)'
  if (/^DateTime$/i.test(type)) return 'DATETIME'
  if (/^Date$/i.test(type)) return 'DATE'
  if (/^Boolean(?:\s+NOT NULL)?$/i.test(type)) return 'TINYINT(1)'
  if (/^(?:Single|Float)$/i.test(type)) return 'FLOAT'
  if (/^(?:Double|Number)$/i.test(type)) return 'DOUBLE'
  if (/^Decimal(?:\s*\(\s*\d+\s*,\s*\d+\s*\))?$/i.test(type)) return 'DECIMAL(19,4)'
  if (/^(?:Memo|Memo\/Hyperlink)(?:\s*\(\s*\d+\s*\))?$/i.test(type)) return 'TEXT'
  const text = /^(?:Text|Char|Character)(?:\s*\(\s*(\d+)\s*\))?$/i.exec(type)
  if (text) return `VARCHAR(${Math.max(1, Math.min(10_000, Number(text[1] ?? 255)))})`
  throw new Error(`Unsupported Access column type: ${type}`)
}

function unescapeBracketIdentifier(value: string): string { return value.replaceAll(']]', ']') }

export function parseAccessSchema(nativeSql: string, mysqlSql: string, selectedTable: string): AccessTableSchema {
  const tables = [...nativeSql.matchAll(/CREATE\s+TABLE\s+\[([^\]\r\n]*(?:\]\][^\]\r\n]*)*)\]\s*\(([\s\S]*?)\);/gi)]
  const selected = tables.find((table) => unescapeBracketIdentifier(table[1] ?? '') === selectedTable)
  if (!selected) throw new Error('The selected table is missing from the Access schema.')
  const columnBlock = selected[2] ?? ''
  const columns: AccessTableColumn[] = []
  for (const line of columnBlock.split(/\r?\n/)) {
    const column = /^\s*\[([^\]\r\n]*(?:\]\][^\]\r\n]*)*)\]\s+(.+?)\s*,?\s*$/.exec(line)
    if (!column) continue
    const name = unescapeBracketIdentifier(column[1] ?? '')
    if (!name || name.length > 255 || name.includes('\0')) throw new Error('The Access schema has an invalid column name.')
    columns.push({ name, type: mapAccessType(column[2] ?? ''), primaryKey: false })
  }
  if (!columns.length || columns.length > 1000) throw new Error('The Access table has no columns or exceeds the 1000-column limit.')
  const mysqlPrimary = [...mysqlSql.matchAll(/ALTER\s+TABLE\s+`([^`]*(?:``[^`]*)*)`\s+ADD\s+PRIMARY\s+KEY\s*\(([^)]*)\)/gi)]
    .find((table) => (table[1] ?? '').replaceAll('``', '`') === selectedTable)
  const primaryLine = mysqlPrimary?.[2]
  const primary = new Set((primaryLine ?? '').split(',').map((name) => name.trim().replace(/^`|`$/g, '').replaceAll('``', '`')).filter(Boolean))
  for (const column of columns) column.primaryKey = primary.has(column.name)
  return { name: selectedTable, columns }
}

export function countCsvRecords(csv: string, stopAfter: number): number {
  let records = 0
  let quoted = false
  let fieldHasData = false
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index]
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') index++
        else quoted = false
      }
      if (character !== '"') fieldHasData = true
    } else if (character === '"') { quoted = true; fieldHasData = true }
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && csv[index + 1] === '\n') index++
      records++
      fieldHasData = false
      if (records > stopAfter) return records
    } else if (character === ',') fieldHasData = true
    else if (character !== '\r') fieldHasData = true
  }
  if (fieldHasData) records++
  return records
}
