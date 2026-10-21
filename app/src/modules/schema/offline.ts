import { lstat, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DatabaseModel, TableModel } from './model.js'
import { readBoundedRegularFile } from '../security/boundedFile.js'

export const SCHEMA_SNAPSHOT_VERSION = 1
export interface SchemaSnapshot { format: 'dbforge-schema-snapshot'; version: 1; createdAt: string; schema: DatabaseModel }

/** Serializes only the supported, versioned model. Never evaluates snapshot content. */
export function createSchemaSnapshot(schema: DatabaseModel, createdAt = new Date().toISOString()): SchemaSnapshot {
  validateModel(schema)
  return { format: 'dbforge-schema-snapshot', version: SCHEMA_SNAPSHOT_VERSION, createdAt, schema: structuredClone(schema) }
}

export function parseSchemaSnapshot(text: string): DatabaseModel {
  if (text.length > 32 * 1024 * 1024) throw new Error('Snapshot exceeds the 32 MiB limit.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Invalid schema snapshot JSON.') }
  if (!value || typeof value !== 'object') throw new Error('Invalid schema snapshot.')
  const snapshot = value as Partial<SchemaSnapshot>
  if (snapshot.format !== 'dbforge-schema-snapshot' || snapshot.version !== SCHEMA_SNAPSHOT_VERSION || !snapshot.schema) throw new Error('Unsupported schema snapshot format or version.')
  validateModel(snapshot.schema)
  return snapshot.schema
}

/** Reads only .sql files as text, in deterministic order, then parses DDL without executing it. */
export async function readScriptsFolder(directory: string, schemaName = 'scripts'): Promise<DatabaseModel> {
  const entries = await collectSqlFiles(directory)
  if (entries.length > 2000) throw new Error('Scripts folder contains more than 2,000 SQL files.')
  let totalBytes = 0
  for (const entry of entries) { const info = await lstat(entry); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Scripts folder contains a non-regular file.'); totalBytes += info.size }
  if (totalBytes > 64 * 1024 * 1024) throw new Error('Scripts folder exceeds the 64 MiB limit.')
  const statements: string[] = []
  for (const entry of entries) {
    const content = (await readBoundedRegularFile(entry, 64 * 1024 * 1024)).toString('utf8')
    statements.push(...splitSqlStatements(content))
  }
  return parseStaticDdl(statements.join('\n'), schemaName)
}

async function collectSqlFiles(directory: string, depth = 0): Promise<string[]> {
  if (depth > 16) throw new Error('Scripts folder nesting exceeds the 16-level limit.')
  const rootInfo = await lstat(directory)
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error('Scripts folder must be a real directory, not a symbolic link.')
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const filePath = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Scripts folder cannot contain symbolic links.')
    if (entry.isDirectory()) paths.push(...await collectSqlFiles(filePath, depth + 1))
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.sql') paths.push(filePath)
    if (paths.length > 2000) throw new Error('Scripts folder contains more than 2,000 SQL files.')
  }
  return paths
}

/** Static CREATE TABLE subset. No SQL engine, shell, stored program, or user statement is run. */
export function parseStaticDdl(text: string, schemaName = 'scripts'): DatabaseModel {
  if (text.length > 64 * 1024 * 1024) throw new Error('DDL input exceeds the 64 MiB limit.')
  const tables: TableModel[] = []
  const source = stripComments(text)
  for (let index = 0; index < source.length;) {
    const start = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/ig
    start.lastIndex = index
    const match = start.exec(source)
    if (!match) break
    const nameStart = start.lastIndex
    const open = findDefinitionOpen(source, nameStart)
    if (open < 0) break
    const tableName = readQualifiedIdentifier(source.slice(nameStart, open).trim()).at(-1)
    if (!tableName) { index = open + 1; continue }
    const close = matchingParen(source, open)
    if (close < 0) throw new Error(`Unclosed CREATE TABLE definition for ${tableName}.`)
    const body = source.slice(open + 1, close)
    const table: TableModel = { kind: 'table', name: tableName, columns: [], indexes: [], foreignKeys: [], checks: [] }
    for (const part of splitTopLevel(body)) parseDefinition(part.trim(), table)
    const tail = source.slice(close + 1, source.indexOf(';', close) < 0 ? source.length : source.indexOf(';', close))
    table.engine = /\bENGINE\s*=\s*([\w]+)/i.exec(tail)?.[1]
    table.charset = /\b(?:DEFAULT\s+)?CHARSET\s*=\s*([\w]+)/i.exec(tail)?.[1]
    tables.push(table)
    index = close + 1
  }
  const schema: DatabaseModel = { kind: 'database', name: schemaName, tables, views: [], procedures: [], functions: [], triggers: [], events: [] }
  validateModel(schema)
  return schema
}

function parseDefinition(text: string, table: TableModel): void {
  if (!text || /^CONSTRAINT\s+.+\s+CHECK\b/i.test(text)) return
  let match = /^(?:CONSTRAINT\s+(`(?:``|[^`])+`|[\w$]+)\s+)?(?:PRIMARY\s+KEY|UNIQUE(?:\s+KEY|\s+INDEX)?|(?:KEY|INDEX)|FULLTEXT\s+(?:KEY|INDEX)|SPATIAL\s+(?:KEY|INDEX))\b/i.exec(text)
  if (match || /^PRIMARY\s+KEY\b/i.test(text)) {
    const rawName = match?.[1] ?? (/^PRIMARY/i.test(text) ? 'PRIMARY' : /(?:KEY|INDEX)\s+(`(?:``|[^`])+`|[\w$]+)/i.exec(text)?.[1])
    const name = rawName ? unquote(rawName) : undefined
    const columnsText = /\((.*)\)/s.exec(text)?.[1] ?? ''
    const columns = splitTopLevel(columnsText).map((item) => ({ name: unquote(item.trim().split(/\s+/)[0]) })).filter((item) => item.name)
    if (columns.length) table.indexes.push({ name: name ?? `index_${table.indexes.length + 1}`, kind: /^PRIMARY/i.test(text) ? 'PRIMARY' : /UNIQUE/i.test(text) ? 'UNIQUE' : /FULLTEXT/i.test(text) ? 'FULLTEXT' : /SPATIAL/i.test(text) ? 'SPATIAL' : 'INDEX', columns })
    return
  }
  match = /^(?:CONSTRAINT\s+(`(?:``|[^`])+`|[\w$]+)\s+)?FOREIGN\s+KEY\s*(?:(`(?:``|[^`])+`|[\w$]+)\s*)?\(([^)]+)\)\s+REFERENCES\s+((?:`(?:``|[^`])+`|[\w$]+)(?:\s*\.\s*(?:`(?:``|[^`])+`|[\w$]+))?)\s*\(([^)]+)\)(.*)$/is.exec(text)
  if (match) {
    const referenced = readQualifiedIdentifier(match[4]); const columns = splitTopLevel(match[3]).map((value) => unquote(value.trim()))
    table.foreignKeys.push({ name: unquote(match[1] ?? match[2] ?? `fk_${table.name}_${table.foreignKeys.length + 1}`), columns, referencedDatabase: referenced.length > 1 ? referenced.at(-2) : undefined, referencedTable: referenced.at(-1)!, referencedColumns: splitTopLevel(match[5]).map((value) => unquote(value.trim())), onDelete: /\bON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/i.exec(match[6])?.[1].toUpperCase(), onUpdate: /\bON\s+UPDATE\s+(CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/i.exec(match[6])?.[1].toUpperCase() })
    return
  }
  const column = /^(`(?:``|[^`])+`|[\w$]+)\s+([\w]+(?:\s*\([^)]*\))?(?:\s+unsigned)?)/i.exec(text)
  if (!column) return
  const remainder = text.slice(column[0].length)
  const defaultMatch = /\bDEFAULT\s+((?:'(?:(?:'')|[^'])*')|(?:"(?:""|[^"])*")|NULL|CURRENT_TIMESTAMP(?:\(\d+\))?|[-+]?\d+(?:\.\d+)?)/i.exec(remainder)
  table.columns.push({ name: unquote(column[1]), type: column[2].replace(/\s+/g, ' ').trim(), nullable: !/\bNOT\s+NULL\b/i.test(remainder), default: defaultMatch ? defaultMatch[1] : undefined, autoIncrement: /\bAUTO_INCREMENT\b/i.test(remainder), comment: /\bCOMMENT\s+'((?:''|[^'])*)'/i.exec(remainder)?.[1]?.replaceAll("''", "'") })
}

function validateModel(value: unknown): asserts value is DatabaseModel {
  const schema = value as Partial<DatabaseModel> | null
  if (!schema || schema.kind !== 'database' || typeof schema.name !== 'string' || schema.name.length > 256 || !Array.isArray(schema.tables) || schema.tables.length > 10000 || !Array.isArray(schema.views) || !Array.isArray(schema.procedures) || !Array.isArray(schema.functions) || !Array.isArray(schema.triggers) || !Array.isArray(schema.events)) throw new Error('Invalid schema model.')
  const names = new Set<string>()
  for (const table of schema.tables) {
    if (!table || table.kind !== 'table' || typeof table.name !== 'string' || table.name.length > 256 || names.has(table.name) || !Array.isArray(table.columns) || table.columns.length > 10000 || !Array.isArray(table.indexes) || !Array.isArray(table.foreignKeys) || !Array.isArray(table.checks)) throw new Error('Invalid table in schema model.')
    names.add(table.name)
    if (table.columns.some((column) => !column || typeof column.name !== 'string' || column.name.length > 256 || typeof column.type !== 'string' || column.type.length > 512 || !/^[A-Za-z][A-Za-z0-9]*(?:\s*\(\s*(?:\d+(?:\s*,\s*\d+)?|'(?:''|[^'])*'(?:\s*,\s*'(?:''|[^'])*')*)\s*\))?(?:\s+(?:unsigned|zerofill|binary|precision))?$/i.test(column.type) || typeof column.nullable !== 'boolean' || column.default !== undefined && column.default !== null && (typeof column.default !== 'string' || column.default.length > 4096) || column.generated !== undefined && (typeof column.generated !== 'string' || column.generated.length > 64_000 || /;|--|\/\*|\*\//.test(column.generated)))) throw new Error('Invalid column in schema model.')
    if (table.indexes.some((index) => !index || typeof index.name !== 'string' || index.name.length > 256 || !['PRIMARY', 'UNIQUE', 'INDEX', 'FULLTEXT', 'SPATIAL'].includes(index.kind) || !Array.isArray(index.columns) || index.columns.length > 1000 || index.columns.some((column) => !column || typeof column.name !== 'string' || column.name.length > 256 || column.expression !== undefined && (typeof column.expression !== 'string' || column.expression.length > 4096 || /;|--|\/\*|\*\//.test(column.expression))))) throw new Error('Invalid index in schema model.')
    if (table.checks.some((check) => !check || typeof check.name !== 'string' || check.name.length > 256 || typeof check.expression !== 'string' || check.expression.length > 64_000 || /;|--|\/\*|\*\//.test(check.expression))) throw new Error('Invalid check constraint in schema model.')
    if (table.foreignKeys.some((fk) => !fk || typeof fk.name !== 'string' || fk.name.length > 256 || !Array.isArray(fk.columns) || !Array.isArray(fk.referencedColumns) || fk.columns.length < 1 || fk.columns.length !== fk.referencedColumns.length || fk.columns.some((name) => typeof name !== 'string' || name.length > 256) || fk.referencedColumns.some((name) => typeof name !== 'string' || name.length > 256) || fk.onDelete !== undefined && !/^(?:CASCADE|RESTRICT|SET NULL|NO ACTION)$/i.test(fk.onDelete) || fk.onUpdate !== undefined && !/^(?:CASCADE|RESTRICT|SET NULL|NO ACTION)$/i.test(fk.onUpdate))) throw new Error('Invalid foreign key in schema model.')
  }
  const namedObjects = [...schema.views, ...schema.procedures, ...schema.functions, ...schema.triggers, ...schema.events]
  if (namedObjects.length > 50_000 || namedObjects.some((item) => !item || typeof item.name !== 'string' || item.name.length > 256 || item.createSql !== undefined && (typeof item.createSql !== 'string' || item.createSql.length > 4_000_000))) throw new Error('Invalid schema objects.')
}
export function assertDatabaseModel(value: unknown): asserts value is DatabaseModel { validateModel(value) }

function splitSqlStatements(text: string): string[] { return splitTopLevel(text, ';').map((item) => item.trim()).filter(Boolean) }
function splitTopLevel(text: string, delimiter = ','): string[] {
  const parts: string[] = []; let start = 0; let depth = 0; let quote = ''; let escaped = false
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) { if (text[i + 1] === quote) i++; else quote = '' } } else if (c === '`' || c === "'" || c === '"') quote = c; else if (c === '(') depth++; else if (c === ')') depth--; else if (depth === 0 && c === delimiter) { parts.push(text.slice(start, i)); start = i + 1 } }
  parts.push(text.slice(start)); return parts
}
function matchingParen(text: string, open: number): number { let depth = 0; let quote = ''; for (let i = open; i < text.length; i++) { const c = text[i]; if (quote) { if (c === quote && text[i + 1] === quote) i++; else if (c === quote && text[i - 1] !== '\\') quote = '' } else if (c === '`' || c === "'" || c === '"') quote = c; else if (c === '(') depth++; else if (c === ')' && --depth === 0) return i } return -1 }
function findDefinitionOpen(text: string, start: number): number { let quote = ''; for (let i = start; i < text.length; i++) { const c = text[i]; if (quote) { if (c === quote && text[i + 1] === quote) i++; else if (c === quote) quote = '' } else if (c === '`' || c === '"') quote = c; else if (c === '(') return i; else if (c === ';') return -1 } return -1 }
function readQualifiedIdentifier(text: string): string[] { return splitTopLevel(text.trim(), '.').map((part) => unquote(part.trim().replace(/\s+/g, ''))) }
function unquote(value: string): string { return value.replace(/^`|`$/g, '').replaceAll('``', '`').replace(/^"|"$/g, '') }
function stripComments(text: string): string { return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\r\n]*/gm, ' ').replace(/^\s*#[^\r\n]*/gm, ' ') }
