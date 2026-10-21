import type { DatabaseModel, SchemaObject } from '../schema/model.js'
import { createTable } from '../schema/ddl.js'
import type { DatabaseObject } from '../../shared/contracts/sql.js'
import { createDecipheriv, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { lstat, realpath, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { splitBackupSql } from './splitSql.js'
import { decodeZipEntry, encodeZipArchive } from '../archive/index.js'

export { splitBackupSql }

export type BackupRows = (table: string, offset: number, limit: number) => Promise<Array<Record<string, unknown>>>
export type BackupExecutor = (statement: string) => Promise<void>
export interface RestoreReport { executed: number; errors: Array<{ statement: number; message: string }> }
export type BackupObjectKind = 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event'
export interface BackupOptions {
  includeStructure: boolean
  includeData: boolean
  objectKinds: BackupObjectKind[]
  singleTransaction: boolean
  includeRoutines: boolean
  includeTriggers: boolean
  includeEvents: boolean
  extendedInserts: boolean
  charset: string
  includeDefiner: boolean
  includeDrop: boolean
  dropIfExists: boolean
  includeUse: boolean
  noAutoValueOnZero: boolean
  lockTables: boolean
  flushLogs: boolean
  errorPolicy: 'abort' | 'ignore' | 'log'
  directory: string
  fileName: string
  appendTimestamp: boolean
  autoDeleteDays: number
  autoDeleteCount: number
  zip: boolean
  compressionLevel: number
  comment: string
  password?: string
}
export interface BackupProgress { phase: 'inspect' | 'schema' | 'data' | 'write' | 'cleanup'; completed: number; total: number; detail: string }
export interface BackupProject { version: 1; connectionId: string; database: string; options: Omit<BackupOptions, 'password'> }
export type BackupProgressCallback = (progress: BackupProgress) => void
export async function cleanupOwnedBackupFiles(directory: string, ownedPaths: string[], maxAgeDays: number, keepCount: number, now = Date.now()): Promise<{ paths: string[]; deleted: string[] }> {
  const safeDirectory = await realpath(directory); const outside: string[] = []; const regular: Array<{ path: string; modified: number }> = []
  for (const filePath of [...new Set(ownedPaths)]) {
    if (resolve(filePath, '..') !== safeDirectory || !filePath.startsWith(`${safeDirectory}/`)) { outside.push(filePath); continue }
    try { const info = await lstat(filePath); if (!info.isFile() || info.isSymbolicLink() || await realpath(filePath) !== filePath) continue; regular.push({ path: filePath, modified: info.mtimeMs }) } catch { /* Missing or replaced entries are removed from the ownership manifest. */ }
  }
  regular.sort((a, b) => b.modified - a.modified)
  const cutoff = now - maxAgeDays * 86_400_000
  const retained = regular.filter((item, index) => (maxAgeDays === 0 || item.modified >= cutoff) && (keepCount === 0 || index < keepCount))
  const keep = new Set(retained.map((item) => item.path)); const deleted: string[] = []
  for (const item of regular) if (!keep.has(item.path)) { await unlink(item.path); deleted.push(item.path) }
  return { paths: [...outside, ...retained.map((item) => item.path)], deleted }
}
const quoteId = (value: string): string => `\`${value.replaceAll('`', '``')}\``
const unquote = (value: string): string => value.replace(/^`|`$/g, '').replaceAll('``', '`')
const scrypt = promisify(scryptCb)
const LEGACY_ARCHIVE_MAGIC = Buffer.from('DBFLZIP1')
export function buildDropObjectStatements(database: string, objects: DatabaseObject[]): string[] {
  const order = ['trigger', 'event', 'procedure', 'function', 'view', 'table'] as const
  return order.flatMap((kind) => objects.filter((object) => object.kind === kind).map((object) => `DROP ${kind.toUpperCase()} IF EXISTS ${quoteId(database)}.${quoteId(object.name)}`))
}
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
  if (object.kind === 'table') { const table = database.tables.find((item) => item.name === object.name); const ddl = table ? table.createSql ?? createTable(table, database.name) : undefined; return ddl?.trim().replace(/;?$/, ';') }
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

export async function createBackupSqlWithOptions(database: DatabaseModel, options: Pick<BackupOptions, 'includeData' | 'objectKinds' | 'includeRoutines' | 'includeTriggers' | 'includeEvents' | 'singleTransaction' | 'extendedInserts' | 'charset' | 'errorPolicy'> & Partial<Pick<BackupOptions, 'includeStructure' | 'includeDefiner' | 'includeDrop' | 'dropIfExists' | 'includeUse' | 'noAutoValueOnZero' | 'lockTables' | 'flushLogs'>>, readRows: BackupRows, signal?: AbortSignal, onProgress?: BackupProgressCallback): Promise<{ sql: string; skipped: string[]; rows: number; objects: number }> {
  const kinds = new Set(options.objectKinds)
  const objects: SchemaObject[] = [...database.tables, ...database.views, ...database.procedures, ...database.functions, ...database.triggers, ...database.events]
  const selected = objects.filter((item) => kinds.has(item.kind as BackupObjectKind) && (options.includeRoutines || !['procedure', 'function'].includes(item.kind)) && (options.includeTriggers || item.kind !== 'trigger') && (options.includeEvents || item.kind !== 'event'))
  const includeStructure = options.includeStructure !== false
  const output = [`-- dbForgeLinux database backup`, ...(options.flushLogs ? ['FLUSH LOGS;'] : []), ...(options.includeUse ? [`USE ${quoteId(database.name)};`] : []), `SET NAMES ${/^[A-Za-z0-9_]+$/.test(options.charset) ? options.charset : 'utf8mb4'};`, ...(options.noAutoValueOnZero ? ["SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';"] : [])]
  const skipped: string[] = []; let rows = 0; let done = 0
  const includedObjects = new Set<string>()
  const structureObjects = includeStructure ? selected : []
  onProgress?.({ phase: 'schema', completed: 0, total: structureObjects.length, detail: 'Preparing database objects' })
  for (const object of structureObjects) {
    if (signal?.aborted) throw new Error('Backup cancelled.')
    if (object.kind === 'event' && !options.includeEvents) continue
    if (object.kind === 'event') { skipped.push(`${object.kind} ${object.name} (events are not included by the restore allowlist)`); done++; continue }
    try {
      const ddl = definition(object, database)
      if (!ddl) skipped.push(`${object.kind} ${object.name}`)
      else {
        const qualified = `${quoteId(database.name)}.${quoteId(object.name)}`
        const body = options.includeDefiner === false ? ddl.replace(/\bDEFINER\s*=\s*(?:`[^`]*`|'[^']*'|[^\s]+)@(?:`[^`]*`|'[^']*'|[^\s]+)\s*/i, '') : ddl
        if (options.includeDrop) output.push(`DROP ${object.kind.toUpperCase()}${options.dropIfExists ? ' IF EXISTS' : ''} ${qualified};`)
        output.push(['procedure', 'function', 'trigger'].includes(object.kind) ? `DELIMITER $$\n${body.replace(/;\s*$/, '')}$$\nDELIMITER ;` : body)
        includedObjects.add(`${object.kind}:${object.name}`)
      }
    } catch (error) { if (options.errorPolicy === 'abort') throw error; skipped.push(`${object.kind} ${object.name}: ${error instanceof Error ? error.message : 'failed'}`) }
    done++; onProgress?.({ phase: 'schema', completed: done, total: selected.length, detail: `${object.kind} ${object.name}` })
  }
  if (options.includeData) {
    if (options.singleTransaction && !options.lockTables) output.push('START TRANSACTION;')
    const tables = selected.filter((item) => item.kind === 'table')
    for (const table of tables) includedObjects.add(`${table.kind}:${table.name}`)
    if (options.lockTables && tables.length) output.push(`LOCK TABLES ${tables.map((table) => `${quoteId(database.name)}.${quoteId(table.name)} READ`).join(', ')};`)
    let tableDone = 0
    for (const table of tables) {
      let offset = 0
      while (true) {
        if (signal?.aborted) throw new Error('Backup cancelled.')
        try {
          const batch = await readRows(table.name, offset, options.extendedInserts ? 500 : 1)
          if (!batch.length) break
          const columns = Object.keys(batch[0])
          if (columns.length) {
            if (options.extendedInserts) {
              const values = batch.map((row) => `(${columns.map((column) => literal(row[column])).join(', ')})`).join(',\n')
              output.push(`INSERT INTO ${quoteId(table.name)} (${columns.map(quoteId).join(', ')}) VALUES\n${values};`)
            } else for (const row of batch) output.push(`INSERT INTO ${quoteId(table.name)} (${columns.map(quoteId).join(', ')}) VALUES (${columns.map((column) => literal(row[column])).join(', ')});`)
            rows += batch.length
          }
          offset += batch.length
          onProgress?.({ phase: 'data', completed: rows, total: 0, detail: `${table.name}: ${rows} rows` })
          if (batch.length < (options.extendedInserts ? 500 : 1)) break
        } catch (error) {
          if (options.errorPolicy === 'abort') throw error
          skipped.push(`table ${table.name} data at row ${offset}: ${error instanceof Error ? error.message : 'read failed'}`); break
        }
      }
      tableDone++; onProgress?.({ phase: 'data', completed: tableDone, total: tables.length, detail: table.name })
    }
  }
  if (options.lockTables && options.includeData && selected.some((item) => item.kind === 'table')) output.push('UNLOCK TABLES;')
  if (options.singleTransaction && !options.lockTables && options.includeData) output.push('COMMIT;')
  return { sql: `${output.join('\n\n')}\n`, skipped, rows, objects: includedObjects.size }
}

export { encodeZipArchive } from '../archive/index.js'
export async function encodeBackupFile(sql: string, options: Pick<BackupOptions, 'zip' | 'compressionLevel' | 'comment' | 'password'>): Promise<Buffer> {
  if (!options.zip) return Buffer.from(sql, 'utf8')
  return encodeZipArchive(Buffer.from(sql, 'utf8'), 'backup.sql', { compressionLevel: options.compressionLevel, comment: options.comment, password: options.password })
}
export async function decodeBackupFile(contents: Buffer, password?: string): Promise<string> {
  if (contents.subarray(0, 8).equals(LEGACY_ARCHIVE_MAGIC)) {
    if (!password) throw new Error('This backup is password protected.')
    const salt = contents.subarray(8, 24); const iv = contents.subarray(24, 36); const tag = contents.subarray(36, 52); const key = await scrypt(password, salt, 32) as Buffer
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); contents = Buffer.concat([decipher.update(contents.subarray(52)), decipher.final()])
  }
  if (contents.length >= 4 && contents.readUInt32LE(0) === 0x04034b50) return decodeZipEntry(contents, 'backup.sql', password)
  return contents.toString('utf8')
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

export async function restoreBackup(database: string, confirmation: string, script: string, execute: BackupExecutor, continueOnError = false, signal?: AbortSignal, onProgress?: BackupProgressCallback): Promise<RestoreReport> {
  if (!database.trim() || confirmation !== database) throw new Error(`Restore requires typing the destination database name: ${database}.`)
  if (script.length > 50 * 1024 * 1024) throw new Error('Restore script exceeds the 50 MB safety limit.')
  const statements = splitBackupSql(script)
  if (!statements.length) throw new Error('Restore script contains no SQL statements.')
  onProgress?.({ phase: 'inspect', completed: 0, total: statements.length, detail: 'Checking restore script' })
  const allowed = /^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|DROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)(?:\s+IF\s+EXISTS)?|INSERT\s+INTO|SET\s+NAMES|SET\s+SQL_MODE\s*=\s*['"]NO_AUTO_VALUE_ON_ZERO['"]|USE|LOCK\s+TABLES|UNLOCK\s+TABLES|START\s+TRANSACTION|COMMIT)(?![\w$])/i
  const errors: Array<{ statement: number; message: string }> = []; let executed = 0
  for (let index = 0; index < statements.length; index += 1) {
    if (signal?.aborted) throw new Error('Restore cancelled.')
    const statement = statements[index]
    const sanitized = statement.replace(/^(?:\s*--[^\n]*(?:\n|$)|\s*#[^\n]*(?:\n|$))+/, '').replace(/^CREATE\s+(?:ALGORITHM\s*=\s*\w+\s+)?DEFINER\s*=\s*(?:`[^`]*`|'[^']*')@(?:`[^`]*`|'[^']*')\s+/i, 'CREATE ').trim()
    if (!allowed.test(sanitized)) throw new Error(`Restore statement ${index + 1} uses a SQL command that is not allowed.`)
    const scopeSql = stripSqlComments(sanitized)
    if (/^USE\b/i.test(scopeSql)) {
      const use = /^USE\s+((?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*))$/i.exec(scopeSql)
      if (!use || unquote(use[1]!) !== database) throw new Error(`Restore statement ${index + 1} targets a database outside ${database}.`)
    }
    if (/^LOCK\s+TABLES\b/i.test(scopeSql)) {
      const lock = /^LOCK\s+TABLES\s+((?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)\s*\.\s*(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)\s+READ)(?:\s*,\s*(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)\s*\.\s*(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)\s+READ)*$/i.exec(scopeSql)
      if (!lock || [...scopeSql.matchAll(/(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)\s*\./g)].some((match) => unquote(match[0]!.replace(/\s*\.$/, '')) !== database)) throw new Error(`Restore statement ${index + 1} has an invalid table lock target.`)
    }
    const targetMatch = /^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|DROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)(?:\s+IF\s+EXISTS)?|INSERT\s+INTO)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*)(?:\s*\.\s*(?:`(?:``|[^`])+`|[A-Za-z_$][\w$]*))?)/i.exec(scopeSql)
    if (/^(?:CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|DROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|INSERT\s+INTO)\b/i.test(scopeSql) && !targetMatch) throw new Error(`Restore statement ${index + 1} has an invalid target identifier.`)
    const targetName = targetMatch?.[1]
    if (targetName?.includes('.')) {
      const schema = targetName.split(/\s*\.\s*/)[0]?.replace(/^`|`$/g, '').replace(/``/g, '`')
      if (schema !== database) throw new Error(`Restore statement ${index + 1} targets a database outside ${database}.`)
    }
    try { await execute(sanitized); executed += 1; onProgress?.({ phase: 'write', completed: executed, total: statements.length, detail: `Statement ${index + 1}` }) }
    catch (error) { errors.push({ statement: index + 1, message: error instanceof Error ? error.message : String(error) }); if (!continueOnError) break }
  }
  return { executed, errors }
}
