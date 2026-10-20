import { StringDecoder } from 'node:string_decoder'
import type { DbTransaction, SqlValue } from '../../main/db/DbDriver.js'
import type { ImportJob, ImportPreview, ImportReport, Row } from './types.js'
import { quoteIdentifier, quoteQualifiedIdentifier, sqlPlaceholders } from './encoding.js'
import { readXlsx } from './xlsx.js'

function textChunks(source: AsyncIterable<Buffer | string>, encoding: 'utf8' | 'utf16le' | 'latin1' = 'utf8'): AsyncIterable<string> {
  return (async function* () {
    const decoder = new StringDecoder(encoding)
    for await (const chunk of source) yield typeof chunk === 'string' ? chunk : decoder.write(chunk)
    const tail = decoder.end()
    if (tail) yield tail
  })()
}

async function readAll(source: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of source) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function* parseCsv(source: AsyncIterable<Buffer | string>, delimiter: string, quote: string, encoding: 'utf8' | 'utf16le' | 'latin1'): AsyncIterable<string[]> {
  if (delimiter.length !== 1 || quote.length !== 1 || delimiter === quote) throw new Error('Delimitador CSV ou quote inválido.')
  let field = ''
  let row: string[] = []
  let quoted = false
  let afterQuote = false
  let pendingQuote = false
  for await (const text of textChunks(source, encoding)) {
    let start = 0
    if (pendingQuote) {
      pendingQuote = false
      if (text[0] === quote) { field += quote; start = 1 }
      else { quoted = false; afterQuote = true }
    }
    for (let i = start; i < text.length; i++) {
      const char = text[i]
      if (quoted) {
        if (char === quote) {
          if (text[i + 1] === quote) { field += quote; i++ }
          else if (i === text.length - 1) pendingQuote = true
          else { quoted = false; afterQuote = true }
        } else field += char
      } else if (char === quote && field.length === 0) { quoted = true; afterQuote = false }
      else if (char === delimiter) { row.push(field); field = ''; afterQuote = false }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++
        row.push(field); field = ''; afterQuote = false
        if (row.some((value) => value !== '')) yield row
        row = []
      } else {
        if (afterQuote && !/\s/.test(char)) throw new Error('Conteúdo inesperado após quote CSV.')
        if (!afterQuote) field += char
      }
    }
  }
  if (pendingQuote) quoted = false
  if (quoted) throw new Error('Campo CSV com quote não terminado.')
  if (field.length || row.length) { row.push(field); yield row }
}

async function* csvObjects(job: ImportJob): AsyncIterable<Row> {
  const parsed = parseCsv(job.source, job.options?.delimiter ?? ',', job.options?.quote ?? '"', job.options?.encoding ?? 'utf8')
  let columns = job.options?.columns
  let first = true
  for await (const values of parsed) {
    if (first && (job.options?.header ?? true)) { columns = values; first = false; continue }
    first = false
    const names = columns ?? values.map((_, index) => `column${index + 1}`)
    yield Object.fromEntries(names.map((name, index) => [name, values[index] ?? '']))
  }
}

function sqlUnescape(input: string): unknown {
  const value = input.trim()
  if (/^NULL$/i.test(value)) return null
  if (/^X'[0-9a-f]*'$/i.test(value)) return Buffer.from(value.slice(2, -1), 'hex')
  if (/^0x[0-9a-f]+$/i.test(value)) return Buffer.from(value.slice(2), 'hex')
  if (/^'.*'$/s.test(value) || /^".*"$/s.test(value)) {
    const body = value.slice(1, -1)
    return body.replace(/\\([0bnrtZ\\'"%_])/g, (_match, char: string) => ({ '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' }[char] ?? char)).replace(/''/g, "'")
  }
  if (/^-?\d+$/.test(value)) { const number = Number(value); return Number.isSafeInteger(number) ? number : value }
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value)
  return value
}

function splitSqlValues(text: string): string[] {
  const values: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) { if (char === '\\') i++; else if (char === quote) { if (text[i + 1] === quote) i++; else quote = '' } }
    else if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) { values.push(text.slice(start, i).trim()); start = i + 1 }
  }
  if (text.slice(start).trim()) values.push(text.slice(start).trim())
  return values
}

async function* sqlObjects(job: ImportJob): AsyncIterable<Row> {
  const script = (await readAll(job.source)).toString('utf8')
  const statements: string[] = []
  let start = 0; let quote = ''; let escaped = false
  for (let i = 0; i < script.length; i++) {
    const char = script[i]
    if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = '' }
    else if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === ';') { statements.push(script.slice(start, i)); start = i + 1 }
  }
  if (script.slice(start).trim()) statements.push(script.slice(start))
  for (const statement of statements) {
    const match = /^\s*INSERT\s+(?:IGNORE\s+)?INTO\s+(?:`(?:``|[^`])+`\.)?`?(?:``|[^`\s(])+`?\s*\(([^)]*)\)\s*VALUES\s*([\s\S]+?)\s*;?\s*$/i.exec(statement)
    if (!match) { if (statement.trim()) throw new Error('O script SQL contém uma instrução não suportada; somente INSERT ... VALUES é permitido.'); continue }
    const columns = splitSqlValues(match[1]).map((column) => column.replace(/^`|`$/g, '').replace(/``/g, '`'))
    const tuples: string[] = []
    const valuesText = match[2]
    let depth = 0; let quoteChar = ''; let tupleStart = -1; let escape = false
    for (let i = 0; i < valuesText.length; i++) {
      const char = valuesText[i]
      if (quoteChar) { if (escape) escape = false; else if (char === '\\') escape = true; else if (char === quoteChar) { if (valuesText[i + 1] === quoteChar) i++; else quoteChar = '' } }
      else if (char === "'" || char === '"') quoteChar = char
      else if (char === '(') { if (depth++ === 0) tupleStart = i + 1 }
      else if (char === ')' && --depth === 0) tuples.push(valuesText.slice(tupleStart, i))
    }
    if (depth !== 0 || !tuples.length) throw new Error('Lista VALUES inválida no script SQL.')
    for (const tuple of tuples) {
      const values = splitSqlValues(tuple)
      if (values.length !== columns.length) throw new Error('Quantidade de valores diferente da quantidade de colunas no INSERT.')
      yield Object.fromEntries(columns.map((column, index) => [column, sqlUnescape(values[index])]))
    }
  }
}

async function* sourceRows(job: ImportJob): AsyncIterable<Row> {
  if (job.format === 'csv') { yield* csvObjects(job); return }
  if (job.format === 'json') {
    const parsed: unknown = JSON.parse((await readAll(job.source)).toString(job.options?.encoding ?? 'utf8'), (_key, value: unknown) => {
      if (value && typeof value === 'object' && 'type' in value && value.type === 'Buffer' && 'data' in value && Array.isArray(value.data)) return Buffer.from(value.data as number[])
      if (value && typeof value === 'object' && '$binary' in value && typeof value.$binary === 'string') return Buffer.from(value.$binary, 'base64')
      return value
    })
    const values = Array.isArray(parsed) ? parsed : [parsed]
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cada linha JSON deve ser um objeto.')
      yield value as Row
    }
    return
  }
  if (job.format === 'xlsx') {
    const workbook = await readXlsx(await readAll(job.source))
    for (const row of workbook.rows) yield row
    return
  }
  yield* sqlObjects(job)
}

function mapped(row: Row, job: ImportJob): Row {
  if (job.options?.columnMapping) {
    return Object.fromEntries(Object.entries(job.options.columnMapping).filter(([source]) => Object.hasOwn(row, source)).map(([source, target]) => [target, row[source]]))
  }
  return row
}

function sqlForRow(job: ImportJob, row: Row): { sql: string; values: SqlValue[]; mode: string } {
  const entries = Object.entries(row)
  if (!entries.length) throw new Error('A linha não contém colunas.')
  const table = quoteQualifiedIdentifier(job.table)
  const keys = job.options?.keyColumns ?? []
  const values = entries.map(([, value]) => value instanceof Date || Buffer.isBuffer(value) || value === null || ['string', 'number', 'bigint', 'boolean'].includes(typeof value) ? value as SqlValue : JSON.stringify(value))
  const columns = entries.map(([key]) => quoteIdentifier(key))
  const mode = job.options?.mode ?? 'append'
  if (mode === 'append' || mode === 'upsert') {
    let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${sqlPlaceholders(entries.length)})`
    if (mode === 'upsert') {
      if (!keys.length) throw new Error('Upsert exige keyColumns.')
      const updates = entries.filter(([key]) => !keys.includes(key)).map(([key]) => `${quoteIdentifier(key)} = VALUES(${quoteIdentifier(key)})`)
      if (updates.length) sql += ` ON DUPLICATE KEY UPDATE ${updates.join(', ')}`
    }
    return { sql, values, mode }
  }
  if (!keys.length) throw new Error(`${mode} exige keyColumns.`)
  const keySet = new Set(keys)
  const where = keys.map((key) => {
    if (!Object.hasOwn(row, key)) throw new Error(`A coluna-chave ${key} não está presente na linha.`)
    return `${quoteIdentifier(key)} <=> ?`
  }).join(' AND ')
  const keyValues = keys.map((key) => row[key] as SqlValue)
  if (mode === 'delete') return { sql: `DELETE FROM ${table} WHERE ${where}`, values: keyValues, mode }
  const changes = entries.filter(([key]) => !keySet.has(key))
  if (!changes.length) throw new Error('Update exige ao menos uma coluna não-chave.')
  return { sql: `UPDATE ${table} SET ${changes.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ')} WHERE ${where}`, values: [...changes.map(([, value]) => value as SqlValue), ...keyValues], mode }
}

async function runRows(job: ImportJob, execute: (sql: string, values: readonly SqlValue[]) => Promise<{ affectedRows: number }>, report: ImportReport): Promise<void> {
  let index = 0
  for await (const sourceRow of sourceRows(job)) {
    if (job.signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    index++; report.read++
    try {
      const row = mapped(sourceRow, job)
      const command = sqlForRow(job, row)
      const result = await execute(command.sql, command.values)
      if (command.mode === 'append') report.inserted++
      else if (command.mode === 'delete') report.deleted += result.affectedRows
      else if (command.mode === 'update') report.updated += result.affectedRows
      else if (result.affectedRows === 1) report.inserted++
      else if (result.affectedRows > 0) report.updated++
    } catch (error) {
      report.errors++; report.rowErrors.push({ row: index, message: error instanceof Error ? error.message : 'Erro de linha.' })
      if ((job.options?.onRowError ?? 'abort') === 'abort') throw error
    }
    if (report.read % 500 === 0) job.onProgress?.({ phase: 'reading', rows: report.read })
  }
}

export async function importData(job: ImportJob): Promise<ImportReport> {
  const report: ImportReport = { read: 0, inserted: 0, updated: 0, deleted: 0, errors: 0, rowErrors: [] }
  const execute = async (transaction: DbTransaction): Promise<void> => runRows(job, async (sql, values) => transaction.execute(sql, values), report)
  if (job.options?.transactional ?? true) await job.driver.withTransaction(job.connectionId, execute, job.signal)
  else {
    await runRows(job, (sql, values) => job.driver.executeParameterized(job.connectionId, sql, values, job.signal), report)
  }
  job.onProgress?.({ phase: 'complete', rows: report.read })
  return report
}

export async function previewImport(job: ImportJob, count = job.options?.previewRows ?? 100): Promise<ImportPreview> {
  const rows: Row[] = []
  let columns: string[] = []
  let read = 0
  for await (const row of sourceRows(job)) {
    if (job.signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const mappedRow = mapped(row, job)
    columns = [...new Set([...columns, ...Object.keys(mappedRow)])]
    rows.push(mappedRow)
    if (++read >= count) break
  }
  job.onProgress?.({ phase: 'preview', rows: rows.length })
  return { columns, rows }
}
