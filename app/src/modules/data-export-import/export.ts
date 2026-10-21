import { once } from 'node:events'
import type { Row } from './types.js'
import type { ExportJob, ExportReport } from './types.js'
import { csvField, encodeText, htmlEscape, quoteIdentifier, quoteQualifiedIdentifier, sqlLiteral, xmlEscape } from './encoding.js'
import { writeXlsx } from './xlsx.js'

async function write(job: ExportJob, value: string | Buffer): Promise<number> {
  const data = Buffer.isBuffer(value) ? value : encodeText(value, job.options?.encoding ?? 'utf8')
  if (!job.destination.write(data)) await once(job.destination, 'drain')
  return data.length
}

export async function exportData(job: ExportJob): Promise<ExportReport> {
  if (job.format === 'pdf') throw new Error('PDF export must use the Electron print adapter.')
  if (job.signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
  let rows = 0
  let bytes = 0
  let columns: string[] = []
  const source = job.driver.streamRows(job.connectionId, job.query, [], job.signal)
  const progress = (): void => job.onProgress?.({ phase: 'writing', rows, bytes })
  const add = async (value: string | Buffer): Promise<void> => { bytes += await write(job, value) }
  try {
    if (job.format === 'xlsx') {
      const result = await writeXlsx(source, job.destination, job.signal)
      rows = result.rows; bytes = result.bytes
    } else {
      if (job.format === 'json') await add('[')
      if (job.format === 'xml') await add('<?xml version="1.0" encoding="UTF-8"?><rows>')
      if (job.format === 'html') await add('<!doctype html><html><head><meta charset="utf-8"></head><body><table>')
      let first = true
      let sqlBatch: Row[] = []
      const flushSql = async (): Promise<void> => {
        if (!sqlBatch.length || !columns.length) return
        const table = quoteQualifiedIdentifier(job.options?.table ?? 'data')
        const names = columns.map(quoteIdentifier).join(', ')
        const values = sqlBatch.map((row) => `(${columns.map((column) => sqlLiteral(row[column])).join(', ')})`).join(',\n')
        await add(`INSERT INTO ${table} (${names}) VALUES\n${values};\n`)
        sqlBatch = []
      }
      for await (const sourceRow of source) {
        if (job.signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
        const row: Row = { ...sourceRow }
        for (const [column, type] of Object.entries(job.options?.columnTypes ?? {})) {
          const value = row[column]
          if (value === null || value === undefined) continue
          if (type === 'HexString' && Buffer.isBuffer(value)) row[column] = value.toString('hex')
          else if (type === 'Integer' && typeof value === 'string' && /^-?\d+$/.test(value)) row[column] = Number(value)
          else if (type === 'Float' && typeof value === 'string' && Number.isFinite(Number(value))) row[column] = Number(value)
          else if (type === 'String' && typeof value !== 'string') row[column] = value instanceof Date ? value.toISOString() : String(value)
          else if (type === 'DateTime' && value instanceof Date) row[column] = value.toISOString()
        }
        if (!columns.length) {
          columns = Object.keys(row)
          if ((job.format === 'csv' || job.format === 'text') && (job.options?.header ?? true)) await add(`${columns.map((column) => csvField(column, job.options?.delimiter ?? (job.format === 'text' ? '\t' : ','), job.options?.quote ?? '"', job.options?.forceQuotes)).join(job.options?.delimiter ?? (job.format === 'text' ? '\t' : ','))}\r\n`)
          if (job.format === 'html') await add(`<thead><tr>${columns.map((column) => `<th>${htmlEscape(column)}</th>`).join('')}</tr></thead><tbody>`)
          if (job.format === 'sql') {
            const table = quoteQualifiedIdentifier(job.options?.table ?? 'data')
            if (job.options?.dropIfExists) await add(`DROP TABLE IF EXISTS ${table};\n`)
            if (job.options?.createTable) await add(`CREATE TABLE ${table} (${columns.map((column) => `${quoteIdentifier(column)} LONGTEXT NULL`).join(', ')});\n`)
          }
        }
        rows++
        if (job.format === 'csv' || job.format === 'text') await add(`${columns.map((column) => csvField(row[column], job.options?.delimiter ?? (job.format === 'text' ? '\t' : ','), job.options?.quote ?? '"', job.options?.forceQuotes)).join(job.options?.delimiter ?? (job.format === 'text' ? '\t' : ','))}\r\n`)
        else if (job.format === 'json') {
          const json = JSON.stringify(row, (_key, value: unknown) => Buffer.isBuffer(value) ? { $binary: value.toString('base64') } : value)
          await add(`${first ? '' : ','}${json}`); first = false
        } else if (job.format === 'xml') {
          await add(`<row>${columns.map((column) => `<${xmlName(column)}>${xmlEscape(row[column])}</${xmlName(column)}>`).join('')}</row>`)
        } else if (job.format === 'html') await add(`<tr>${columns.map((column) => `<td>${htmlEscape(row[column])}</td>`).join('')}</tr>`)
        else if (job.format === 'sql') {
          sqlBatch.push(row)
          if (sqlBatch.length >= Math.max(1, job.options?.batchSize ?? 500)) await flushSql()
        }
        if (rows % 500 === 0) progress()
      }
      if (job.format === 'sql') await flushSql()
      if (job.format === 'xml') await add('</rows>')
      if (job.format === 'json') await add(']')
      if (job.format === 'html') await add('</tbody></table></body></html>')
    }
    job.destination.end()
    await once(job.destination, 'finish')
    job.onProgress?.({ phase: 'complete', rows, bytes })
    return { rows, bytes }
  } catch (error) {
    job.destination.destroy(error instanceof Error ? error : undefined)
    throw error
  }
}

export async function previewExport(job: Pick<ExportJob, 'driver' | 'connectionId' | 'query' | 'signal' | 'onProgress'>, count = 20): Promise<Row[]> {
  const rows: Row[] = []
  for await (const row of job.driver.streamRows(job.connectionId, job.query, [], job.signal)) {
    if (job.signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    rows.push(row)
    if (rows.length >= Math.max(1, count)) break
  }
  job.onProgress?.({ phase: 'preview', rows: rows.length })
  return rows
}

function xmlName(value: string): string {
  const name = value.replace(/[^A-Za-z0-9_.-]/g, '_')
  return /^[A-Za-z_]/.test(name) ? name : `_${name}`
}
