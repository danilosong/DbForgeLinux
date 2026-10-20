import { once } from 'node:events'
import type { SqlValue } from '../../main/db/DbDriver.js'
import type { DataCompareDifference, DataCompareEndpoint, DataCompareJob, DataCompareReport, SyncStatement } from './types.js'

export type { DataCompareDifference, DataCompareEndpoint, DataCompareJob, DataCompareReport, SyncStatement } from './types.js'

function quoteId(value: string): string {
  if (!value || value.includes('\0')) throw new Error('Identificador inválido.')
  return `\`${value.replace(/`/g, '``')}\``
}
function tableName(endpoint: DataCompareEndpoint): string { return `${quoteId(endpoint.database)}.${quoteId(endpoint.table)}` }
function sqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value instanceof Date || Buffer.isBuffer(value)) return (value ?? null) as SqlValue
  return JSON.stringify(value)
}
function compareValues(left: unknown, right: unknown): number {
  if (left == null) return right == null ? 0 : -1
  if (right == null) return 1
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return Buffer.compare(left, right)
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'bigint' && typeof right === 'bigint') return left < right ? -1 : left > right ? 1 : 0
  const a = String(left); const b = String(right)
  return a < b ? -1 : a > b ? 1 : 0
}
function equalValues(left: unknown, right: unknown): boolean {
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return left.equals(right)
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime()
  if (typeof left === 'number' && typeof right === 'number') return left === right
  if (typeof left === 'bigint' && typeof right === 'bigint') return left === right
  return left === right
}
function compareKeys(left: Record<string, unknown>, right: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) { const compared = compareValues(left[key], right[key]); if (compared) return compared }
  return 0
}
function sameRow(left: Record<string, unknown>, right: Record<string, unknown>, columns: string[]): boolean { return columns.every((column) => equalValues(left[column], right[column])) }
function keyObject(row: Record<string, unknown>, keys: string[]): Record<string, unknown> { return Object.fromEntries(keys.map((key) => [key, row[key]])) }

async function next(iterator: AsyncIterator<Record<string, unknown>>): Promise<Record<string, unknown> | undefined> {
  const value = await iterator.next()
  return value.done ? undefined : value.value
}
async function writeScript(job: DataCompareJob, statement: SyncStatement): Promise<void> {
  await job.onStatement?.(statement)
  if (!job.script) return
  const line = `${statement.sql};\n`
  if (!job.script.write(line)) await once(job.script, 'drain')
}

function makeInsert(job: DataCompareJob, row: Record<string, unknown>, columns: string[]): SyncStatement {
  const names = columns.map(quoteId).join(', ')
  return { kind: 'INSERT', sql: `INSERT INTO ${tableName(job.target)} (${names}) VALUES (${columns.map(() => '?').join(', ')})`, values: columns.map((column) => sqlValue(row[column])) }
}
function makeUpdate(job: DataCompareJob, source: Record<string, unknown>, keys: string[], columns: string[]): SyncStatement | undefined {
  const changed = columns.filter((column) => !keys.includes(column))
  if (!changed.length) return undefined
  const assignments = changed.map((column) => `${quoteId(column)} = ?`).join(', ')
  const where = keys.map((column) => `${quoteId(column)} <=> ?`).join(' AND ')
  return { kind: 'UPDATE', sql: `UPDATE ${tableName(job.target)} SET ${assignments} WHERE ${where}`, values: [...changed.map((column) => sqlValue(source[column])), ...keys.map((column) => sqlValue(source[column]))] }
}
function makeDelete(job: DataCompareJob, row: Record<string, unknown>, keys: string[]): SyncStatement {
  return { kind: 'DELETE', sql: `DELETE FROM ${tableName(job.target)} WHERE ${keys.map((key) => `${quoteId(key)} <=> ?`).join(' AND ')}`, values: keys.map((key) => sqlValue(row[key])) }
}

/** Merge-compares two ordered streams. Row data is emitted one difference at a time. */
export async function compareData(job: DataCompareJob): Promise<DataCompareReport> {
  if (!job.keyColumns.length) throw new Error('Data Compare exige pelo menos uma coluna-chave.')
  if (job.keyColumns.some((key) => key.includes('\0'))) throw new Error('Coluna-chave inválida.')
  if (job.script && !job.onStatement) throw new Error('Para gerar um script parametrizado, informe onStatement para receber os valores bind.')
  const columns = [...new Set([...(job.columns ?? []), ...job.keyColumns])]
  const projection = job.columns?.length ? columns.map(quoteId).join(', ') : '*'
  const order = job.keyColumns.map(quoteId).join(', ')
  const sourceSql = `SELECT ${projection} FROM ${tableName(job.source)} ORDER BY ${order}`
  const targetSql = `SELECT ${projection} FROM ${tableName(job.target)} ORDER BY ${order}`
  const sourceIterator = job.source.driver.streamRows(job.source.connectionId, sourceSql, [], job.signal)[Symbol.asyncIterator]()
  const targetIterator = job.target.driver.streamRows(job.target.connectionId, targetSql, [], job.signal)[Symbol.asyncIterator]()
  const report: DataCompareReport = { compared: 0, same: 0, different: 0, sourceOnly: 0, targetOnly: 0, statements: 0 }
  let previousSource: Record<string, unknown> | undefined
  let previousTarget: Record<string, unknown> | undefined
  const readOrdered = async (iterator: AsyncIterator<Record<string, unknown>>, side: 'source' | 'target'): Promise<Record<string, unknown> | undefined> => {
    const row = await next(iterator)
    const previous = side === 'source' ? previousSource : previousTarget
    if (row && previous && compareKeys(previous, row, job.keyColumns) >= 0) throw new Error(`As colunas-chave devem ser únicas e estar ordenadas na origem ${side}.`)
    if (side === 'source') previousSource = row
    else previousTarget = row
    return row
  }
  let source = await readOrdered(sourceIterator, 'source')
  let target = await readOrdered(targetIterator, 'target')
  const emit = async (difference: DataCompareDifference, statement?: SyncStatement): Promise<void> => {
    await job.onDifference?.(difference)
    if (statement) { await writeScript(job, statement); report.statements++ }
  }
  try {
    while (source || target) {
      if (job.signal?.aborted) throw new DOMException('Comparação cancelada.', 'AbortError')
      if (!source) {
        report.targetOnly++; report.compared++
        await emit({ kind: 'target-only', key: keyObject(target!, job.keyColumns), target }, job.allowDeletes ? makeDelete(job, target!, job.keyColumns) : undefined)
        target = await readOrdered(targetIterator, 'target')
      } else if (!target) {
        report.sourceOnly++; report.compared++
        await emit({ kind: 'source-only', key: keyObject(source, job.keyColumns), source }, makeInsert(job, source, columns.length > job.keyColumns.length ? columns : Object.keys(source)))
        source = await readOrdered(sourceIterator, 'source')
      } else {
        const keyOrder = compareKeys(source, target, job.keyColumns)
        if (keyOrder < 0) {
          report.sourceOnly++; report.compared++
          await emit({ kind: 'source-only', key: keyObject(source, job.keyColumns), source }, makeInsert(job, source, columns.length > job.keyColumns.length ? columns : Object.keys(source)))
          source = await readOrdered(sourceIterator, 'source')
        } else if (keyOrder > 0) {
          report.targetOnly++; report.compared++
          await emit({ kind: 'target-only', key: keyObject(target, job.keyColumns), target }, job.allowDeletes ? makeDelete(job, target, job.keyColumns) : undefined)
          target = await readOrdered(targetIterator, 'target')
        } else {
          report.compared++
          const comparedColumns = job.columns?.length ? columns : [...new Set([...Object.keys(source), ...Object.keys(target)])]
          if (sameRow(source, target, comparedColumns)) { report.same++; await emit({ kind: 'same', key: keyObject(source, job.keyColumns), source, target }) }
          else {
            const changedColumns = comparedColumns.filter((column) => !equalValues(source![column], target![column]))
            report.different++
            await emit({ kind: 'different', key: keyObject(source, job.keyColumns), source, target, changedColumns }, makeUpdate(job, source, job.keyColumns, comparedColumns))
          }
          source = await readOrdered(sourceIterator, 'source'); target = await readOrdered(targetIterator, 'target')
        }
      }
      if (report.compared % 500 === 0) job.onProgress?.({ compared: report.compared, same: report.same, different: report.different, sourceOnly: report.sourceOnly, targetOnly: report.targetOnly })
    }
    if (job.script) { job.script.end(); await once(job.script, 'finish') }
    job.onProgress?.({ compared: report.compared, same: report.same, different: report.different, sourceOnly: report.sourceOnly, targetOnly: report.targetOnly })
    return report
  } catch (error) {
    job.script?.destroy(error instanceof Error ? error : undefined)
    throw error
  } finally {
    await sourceIterator.return?.()
    await targetIterator.return?.()
  }
}
