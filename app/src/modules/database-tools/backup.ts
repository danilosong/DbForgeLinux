import type { DatabaseModel, SchemaObject } from '../schema/model.js'
import { createTable } from '../schema/ddl.js'

export type BackupRows = (table: string, offset: number, limit: number) => Promise<Array<Record<string, unknown>>>
export type BackupExecutor = (statement: string) => Promise<void>
export interface RestoreReport { executed: number; errors: Array<{ statement: number; message: string }> }
const quoteId = (value: string): string => `\`${value.replaceAll('`', '``')}\``
const quoteString = (value: string): string => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''").replaceAll('\0', '\\0')}'`
function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Backup contains a non-finite numeric value.'); return String(value) }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`
  if (value instanceof Date) return quoteString(value.toISOString().slice(0, 19).replace('T', ' '))
  return quoteString(String(value))
}

function definition(object: SchemaObject, database: DatabaseModel): string | undefined {
  if (object.kind === 'table') { const table = database.tables.find((item) => item.name === object.name); return table ? table.createSql ?? createTable(table, database.name) : undefined }
  if (object.createSql?.trim()) return object.createSql.trim().replace(/;?$/, ';')
  if (object.kind === 'view' && 'definition' in object) return `CREATE VIEW ${quoteId(object.name)} AS ${object.definition};`
  return undefined
}

export async function createBackupSql(database: DatabaseModel, includeData: boolean, readRows: BackupRows): Promise<{ sql: string; skipped: string[]; rows: number }> {
  const sql: string[] = ['-- dbForgeLinux database backup', 'SET NAMES utf8mb4;']
  const skipped: string[] = []; let rowsWritten = 0
  const objects: SchemaObject[] = [...database.tables, ...database.views, ...database.procedures, ...database.functions, ...database.triggers, ...database.events]
  for (const object of objects) {
    if (object.kind === 'event') { skipped.push(`${object.kind} ${object.name} (restore disabled for scheduled events)`); continue }
    const ddl = definition(object, database)
    if (!ddl) { skipped.push(`${object.kind} ${object.name}`); continue }
    if (['procedure', 'function', 'trigger', 'event'].includes(object.kind)) sql.push(`DELIMITER $$\n${ddl.replace(/;\s*$/, '')}$$\nDELIMITER ;`)
    else sql.push(ddl)
  }
  if (includeData) for (const table of database.tables) {
    let offset = 0
    while (true) {
      const batch = await readRows(table.name, offset, 500)
      if (!batch.length) break
      const columns = Object.keys(batch[0])
      if (columns.length) {
        for (const row of batch) sql.push(`INSERT INTO ${quoteId(table.name)} (${columns.map(quoteId).join(', ')}) VALUES (${columns.map((column) => literal(row[column])).join(', ')});`)
        rowsWritten += batch.length
      }
      if (batch.length < 500) break
      offset += batch.length
    }
  }
  return { sql: `${sql.join('\n\n')}\n`, skipped, rows: rowsWritten }
}

export function splitBackupSql(source: string): string[] {
  const statements: string[] = []; let delimiter = ';'; let buffer = ''; let quote: string | null = null; let lineComment = false; let blockComment = false
  for (const line of source.split(/(?<=\n)/)) {
    const directive = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line.trimEnd())
    if (!quote && !buffer.trim() && directive) { delimiter = directive[1]; continue }
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]; const next = line[index + 1]
      if (lineComment) { buffer += char; if (char === '\n') lineComment = false; continue }
      if (blockComment) { buffer += char; if (char === '*' && next === '/') { buffer += next; index += 1; blockComment = false }; continue }
      if (quote) { buffer += char; if (char === '\\') { if (next) { buffer += next; index += 1 }; continue }; if (char === quote && next === quote) { buffer += next; index += 1; continue }; if (char === quote) quote = null; continue }
      if (char === "'" || char === '"' || char === '`') { quote = char; buffer += char; continue }
      if (char === '-' && next === '-' && (!line[index + 2] || /\s/.test(line[index + 2]))) { lineComment = true; buffer += char + next; index += 1; continue }
      if (char === '#') { lineComment = true; buffer += char; continue }
      if (char === '/' && next === '*') { blockComment = true; buffer += char + next; index += 1; continue }
      if (line.startsWith(delimiter, index)) { const sql = buffer.trim(); if (sql) statements.push(sql); buffer = ''; index += delimiter.length - 1; continue }
      buffer += char
    }
  }
  if (buffer.trim()) statements.push(buffer.trim())
  return statements
}

function stripSqlComments(sql: string): string {
  let output = ''; let quote: string | null = null
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]; const next = sql[index + 1]
    if (quote) {
      output += char
      if (char === '\\' && next) { output += next; index += 1; continue }
      if (char === quote && next === quote) { output += next; index += 1; continue }
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; output += char; continue }
    if (char === '-' && next === '-' && (!sql[index + 2] || /\s/.test(sql[index + 2]!))) { while (index < sql.length && sql[index] !== '\n') index += 1; output += ' '; continue }
    if (char === '#') { while (index < sql.length && sql[index] !== '\n') index += 1; output += ' '; continue }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2)
      if (end < 0) throw new Error('Restore script contains an unfinished SQL comment.')
      if (sql[index + 2] === '!' || sql[index + 2] === '+') throw new Error('Restore script cannot contain executable SQL comments.')
      index = end + 1; output += ' '; continue
    }
    output += char
  }
  return output
}

export async function restoreBackup(database: string, confirmation: string, script: string, execute: BackupExecutor, continueOnError = false): Promise<RestoreReport> {
  if (!database.trim() || confirmation !== database) throw new Error(`Restore requires typing the destination database name: ${database}.`)
  if (script.length > 50 * 1024 * 1024) throw new Error('Restore script exceeds the 50 MB safety limit.')
  const statements = splitBackupSql(script)
  if (!statements.length) throw new Error('Restore script contains no SQL statements.')
  const allowed = /^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|INSERT\s+INTO|SET\s+NAMES|START\s+TRANSACTION|COMMIT)\b/i
  const errors: Array<{ statement: number; message: string }> = []; let executed = 0
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index]
    const sanitized = statement.replace(/^(?:\s*--[^\n]*(?:\n|$)|\s*#[^\n]*(?:\n|$))+/, '').replace(/^CREATE\s+(?:ALGORITHM\s*=\s*\w+\s+)?DEFINER\s*=\s*(?:`[^`]*`|'[^']*')@(?:`[^`]*`|'[^']*')\s+/i, 'CREATE ')
    if (!allowed.test(sanitized)) throw new Error(`Restore statement ${index + 1} uses a SQL command that is not allowed.`)
    const scopeSql = stripSqlComments(sanitized)
    const targetMatch = /^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|INSERT\s+INTO)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)(?:\s*\.\s*(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*))?)/i.exec(scopeSql)
    if (/^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|INSERT\s+INTO)\b/i.test(scopeSql) && !targetMatch) throw new Error(`Restore statement ${index + 1} has an invalid target identifier.`)
    const targetName = targetMatch?.[1]
    if (targetName?.includes('.')) {
      const schema = targetName.split(/\s*\.\s*/)[0]?.replace(/^`|`$/g, '').replace(/``/g, '`')
      if (schema !== database) throw new Error(`Restore statement ${index + 1} targets a database outside ${database}.`)
    }
    try { await execute(sanitized); executed += 1 }
    catch (error) { errors.push({ statement: index + 1, message: error instanceof Error ? error.message : String(error) }); if (!continueOnError) break }
  }
  return { executed, errors }
}
