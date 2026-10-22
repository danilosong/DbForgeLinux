import type { DbTransaction, SqlValue } from '../../main/db/DbDriver.js'
import type { DatabaseModel, TableModel } from '../schema/model.js'
import { generateValue, inferKind, isUniqueColumn, passesSimpleCheck, relevantChecks, seededRandom, type GenerationContext } from './generators.js'
import type { DataGenerationJob, DataGenerationPreviewJob, DataGenerationReport, GeneratorSpec } from './types.js'

export type { DataGenerationJob, DataGenerationPreviewJob, DataGenerationReport, GeneratorKind, GeneratorSpec, Locale } from './types.js'
export { dataDomainProfiles, generatorForDomainProfile, generatorSpecForDomainProfile, type DataDomainProfile } from './profiles.js'

function quoteId(name: string): string {
  if (!name || name.includes('\0')) throw new Error('Invalid identifier.')
  return `\`${name.replace(/`/g, '``')}\``
}
function tableName(database: string, table: string): string { return `${quoteId(database)}.${quoteId(table)}` }
function rowCount(job: DataGenerationJob, table: string): number { return typeof job.rowsPerTable === 'number' ? job.rowsPerTable : job.rowsPerTable[table] ?? 0 }
function specFor(job: Pick<DataGenerationJob, 'generators'> | Pick<DataGenerationPreviewJob, 'generators'>, table: string, column: string): GeneratorSpec | undefined { return job.generators?.[`${table}.${column}`] ?? job.generators?.[column] }
function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value instanceof Date || Buffer.isBuffer(value)) return (value ?? null) as SqlValue
  return JSON.stringify(value)
}
function uniqueKey(values: unknown[]): string { return values.map((value) => Buffer.isBuffer(value) ? `b:${value.toString('hex')}` : value instanceof Date ? `d:${value.toISOString()}` : `${typeof value}:${String(value)}`).join('\u001f') }

function orderTables(tables: TableModel[], database: string): TableModel[] {
  const byName = new Map(tables.map((table) => [table.name, table]))
  const active = new Set<string>(); const done = new Set<string>(); const ordered: TableModel[] = []
  const path: string[] = []
  const visit = (table: TableModel): void => {
    if (done.has(table.name)) return
    if (active.has(table.name)) {
      const cycleStart = path.indexOf(table.name)
      throw new Error(`Cyclic foreign-key dependency cannot be generated safely in one pass: ${[...path.slice(cycleStart), table.name].join(' → ')}. Remove one table from the selection or seed the referenced rows first.`)
    }
    active.add(table.name)
    path.push(table.name)
    for (const fk of table.foreignKeys) {
      const sameDatabase = !fk.referencedDatabase || fk.referencedDatabase === database
      const parent = sameDatabase ? byName.get(fk.referencedTable) : undefined
      if (parent) visit(parent)
    }
    path.pop(); active.delete(table.name); done.add(table.name); ordered.push(table)
  }
  tables.forEach(visit)
  return ordered
}

async function sampleExistingValues(driver: DataGenerationJob['driver'], connectionId: string, signal: AbortSignal | undefined, database: string, table: string, column: string): Promise<unknown[]> {
  const result: unknown[] = []
  const sql = `SELECT ${quoteId(column)} AS v FROM ${tableName(database, table)} WHERE ${quoteId(column)} IS NOT NULL ORDER BY ${quoteId(column)}`
  for await (const row of driver.streamRows(connectionId, sql, [], signal)) {
    if (result.length >= 500) break
    result.push(row.v)
  }
  return result
}

async function *makeRows(
  job: DataGenerationJob | DataGenerationPreviewJob,
  table: TableModel,
  count: number,
  seed: number | string,
  generatedSamples: Map<string, unknown[]>,
  context: { driver?: DataGenerationJob['driver']; connectionId?: string; database?: string; signal?: AbortSignal }
): AsyncIterable<Record<string, unknown>> {
  const random = seededRandom(seed)
  const locale = job.locale ?? 'en-US'
  const columns = table.columns.filter((column) => !column.generated)
  const generatedColumns = new Set(table.columns.filter((column) => column.generated).map((column) => column.name))
  const uniqueIndexes = table.indexes.filter((index) => index.kind === 'PRIMARY' || index.kind === 'UNIQUE').map((index) => index.columns.map((column) => column.name)).filter((index) => index.every((column) => !generatedColumns.has(column)))
  const seenUnique = new Map(uniqueIndexes.map((index) => [index.join('\0'), new Set<string>()]))
  const singleSeen = new Map(columns.filter((column) => isUniqueColumn(table, column.name)).map((column) => [column.name, new Set<string>()]))
  const maxExisting = new Map<string, number>()
  if (context.driver && context.connectionId && context.database && uniqueIndexes.length) {
    const uniqueColumns = [...new Set(uniqueIndexes.flat())]
    const projection = uniqueColumns.map(quoteId).join(', ')
    for await (const existing of context.driver.streamRows(context.connectionId, `SELECT ${projection} FROM ${tableName(context.database, table.name)}`, [], context.signal)) {
      for (const column of uniqueColumns) {
        const value = existing[column]
        if (value != null && singleSeen.has(column)) singleSeen.get(column)!.add(uniqueKey([value]))
        if (typeof value === 'number') maxExisting.set(column, Math.max(maxExisting.get(column) ?? Number.NEGATIVE_INFINITY, value))
      }
      for (const index of uniqueIndexes.filter((item) => item.length > 1)) seenUnique.get(index.join('\0'))!.add(uniqueKey(index.map((column) => existing[column])))
    }
  }
  const checks = relevantChecks(table)
  const foreignProviders = new Map<string, unknown[]>()

  for (const column of columns) {
    const spec = specFor(job, table.name, column.name)
    const foreignKey = table.foreignKeys.find((fk) => fk.columns.includes(column.name))
    if (spec?.kind !== 'foreignKey' && spec?.kind !== 'fromTable' && !foreignKey) continue
    const fkIndex = foreignKey?.columns.indexOf(column.name) ?? -1
    const refTable = spec?.source?.table ?? foreignKey?.referencedTable
    const refColumn = spec?.source?.column ?? (fkIndex >= 0 ? foreignKey?.referencedColumns[fkIndex] : undefined)
    if (!refTable || !refColumn) throw new Error(`No foreign-key source is defined for ${table.name}.${column.name}.`)
    const refDatabase = spec?.source?.database ?? foreignKey?.referencedDatabase ?? context.database ?? ''
    const sameDatabaseSource = !spec?.source?.database && (!foreignKey?.referencedDatabase || foreignKey.referencedDatabase === context.database)
    let values = sameDatabaseSource && !spec?.source?.connectionId ? generatedSamples.get(`${refTable}.${refColumn}`) : undefined
    const sourceConnection = spec?.source?.connectionId ?? context.connectionId
    if (!values?.length && context.driver && sourceConnection && refDatabase) values = await sampleExistingValues(context.driver, sourceConnection, context.signal, refDatabase, refTable, refColumn)
    if (!values?.length) throw new Error(`No foreign-key values are available in ${refDatabase}.${refTable}.${refColumn}.`)
    foreignProviders.set(column.name, values)
  }

  for (let rowIndex = 0; rowIndex < count; rowIndex++) {
    if (context.signal?.aborted) throw new DOMException('Data generation was canceled.', 'AbortError')
    const row: Record<string, unknown> = {}
    for (const column of columns) {
      const spec = specFor(job, table.name, column.name)
      const values = foreignProviders.get(column.name)
      const unique = isUniqueColumn(table, column.name)
      const hasForeignKey = table.foreignKeys.some((fk) => fk.columns.includes(column.name))
      let generator = hasForeignKey && !spec ? { kind: 'foreignKey' as const } : spec
      if (unique && !spec && inferKind(column) === 'number') generator = { kind: 'unique', start: (maxExisting.get(column.name) ?? 0) + 1 }
      const ctx: GenerationContext = { random, locale, rowIndex, table, column, spec: generator, sequence: rowIndex + 1, foreignValues: values }
      let value: unknown
      let attempts = 0
      do {
        value = generateValue(ctx)
        if (value === null && !column.nullable) {
          const nonNullList = generator?.values?.filter((item) => item != null)
          if (generator?.kind === 'list' && !nonNullList?.length) throw new Error(`The list generator for ${column.name} has no non-null value for its NOT NULL column.`)
          value = generateValue({ ...ctx, spec: { ...generator, values: nonNullList, nullPercent: 0 } })
        }
        if (unique && value != null) {
          const set = singleSeen.get(column.name)!
          if (!set.has(uniqueKey([value]))) break
          value = typeof value === 'number' ? value + rowIndex + attempts + 1 : `${String(value)}-${rowIndex + attempts + 1}`
        } else break
        attempts++
        if (attempts > 1000) throw new Error(`Could not generate a unique value for ${table.name}.${column.name}; its value range may be exhausted.`)
      } while (unique && value != null && singleSeen.get(column.name)!.has(uniqueKey([value])))
      if (unique && value != null) singleSeen.get(column.name)!.add(uniqueKey([value]))
      row[column.name] = value
    }
    for (const index of uniqueIndexes.filter((columnsInIndex) => columnsInIndex.length > 1)) {
      const set = seenUnique.get(index.join('\0'))!
      let key = uniqueKey(index.map((column) => row[column]))
      if (set.has(key)) {
        for (const column of index) {
          if (row[column] == null) continue
          row[column] = typeof row[column] === 'number' ? Number(row[column]) + rowIndex + 1 : `${String(row[column])}-${rowIndex + 1}`
          if (singleSeen.has(column) && row[column] != null) singleSeen.get(column)!.add(uniqueKey([row[column]]))
        }
        key = uniqueKey(index.map((column) => row[column]))
      }
      if (set.has(key)) throw new Error(`A UNIQUE index collision occurred for ${index.join(', ')} on table ${table.name}.`)
      set.add(key)
    }
    if (checks.some((check) => !passesSimpleCheck(check, row))) throw new Error(`A value does not satisfy a CHECK constraint on table ${table.name}. Configure a generator to meet the constraints.`)
    for (const [column, value] of Object.entries(row)) {
      const sampleKey = `${table.name}.${column}`
      const sample = generatedSamples.get(sampleKey) ?? []
      if (sample.length < 500) sample.push(value)
      else if (rowIndex % 17 === 0) sample[rowIndex % sample.length] = value
      generatedSamples.set(sampleKey, sample)
    }
    yield row
  }
}

async function insertRows(transaction: DbTransaction, database: string, table: TableModel, rows: Record<string, unknown>[]): Promise<number> {
  if (!rows.length) return 0
  const columns = table.columns.filter((column) => !column.generated)
  if (!columns.length) {
    const sql = `INSERT INTO ${tableName(database, table.name)} () VALUES ${rows.map(() => '()').join(', ')}`
    const result = await transaction.execute(sql)
    return result.affectedRows || rows.length
  }
  const columnSql = columns.map((column) => quoteId(column.name)).join(', ')
  const tuple = `(${columns.map(() => '?').join(', ')})`
  const sql = `INSERT INTO ${tableName(database, table.name)} (${columnSql}) VALUES ${rows.map(() => tuple).join(', ')}`
  const values = rows.flatMap((row) => columns.map((column) => toSqlValue(row[column.name])))
  const result = await transaction.execute(sql, values)
  return result.affectedRows || rows.length
}

export async function previewData(job: DataGenerationPreviewJob): Promise<Record<string, unknown>[]> {
  if (job.count < 0 || !Number.isInteger(job.count)) throw new Error('The preview row count must be a non-negative integer.')
  const samples = new Map<string, unknown[]>()
  const rows: Record<string, unknown>[] = []
  const context = { driver: job.driver, connectionId: job.connectionId, database: job.database, signal: job.signal }
  for await (const row of makeRows(job, job.table, job.count, job.seed ?? 1, samples, context)) rows.push(row)
  return rows
}

export function relatedGenerationTables(schema: Pick<DatabaseModel, 'tables'>, tableName: string): { parents: string[]; children: string[] } {
  const table = schema.tables.find((item) => item.name === tableName)
  if (!table) return { parents: [], children: [] }
  return {
    parents: [...new Set(table.foreignKeys.map((key) => key.referencedTable).filter((name) => schema.tables.some((item) => item.name === name)))].sort(),
    children: schema.tables.filter((item) => item.foreignKeys.some((key) => key.referencedTable === tableName)).map((item) => item.name).sort()
  }
}

export async function generateData(job: DataGenerationJob): Promise<DataGenerationReport> {
  const selected = new Set(job.tables ?? job.schema.tables.map((table) => table.name))
  const tables = orderTables(job.schema.tables.filter((table) => selected.has(table.name)), job.database)
  const counts = tables.map((table) => rowCount(job, table.name))
  if (counts.some((count) => !Number.isInteger(count) || count < 0)) throw new Error('Each row count must be a non-negative integer.')
  const report: DataGenerationReport = { generated: 0, inserted: 0, tables: {} }
  const samples = new Map<string, unknown[]>()
  const batchSize = job.batchSize ?? 250
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) throw new Error('The batch size must be between 1 and 10000 rows.')
  if (job.disableForeignKeyChecks) {
    const expected = `DISABLE FOREIGN_KEY_CHECKS ${job.database}.${JSON.stringify([...(job.tables ?? job.schema.tables.map((table) => table.name))].sort())}`
    if (job.foreignKeyChecksConfirmation !== expected) throw new Error('Disabling foreign-key checks requires the exact confirmation phrase.')
  }
  const locale = job.locale ?? 'en-US'
  const seed = job.seed ?? 1
  const truncateNames = new Set(job.truncateTables ?? [])
  if ([...truncateNames].some((name) => !selected.has(name))) throw new Error('Only selected tables can be cleared before generation.')
  const truncateOrder = [...tables].reverse().filter((table) => truncateNames.has(table.name))
  const priorForeignKeyChecks = job.disableForeignKeyChecks ? Number((await job.driver.queryRows(job.connectionId, 'SELECT @@SESSION.FOREIGN_KEY_CHECKS AS enabled'))[0]?.enabled) : undefined
  if (job.disableForeignKeyChecks && priorForeignKeyChecks !== 0 && priorForeignKeyChecks !== 1) throw new Error('Could not determine the current FOREIGN_KEY_CHECKS setting.')
  await job.driver.withTransaction(job.connectionId, async (transaction) => {
    let operationError: unknown
    let restoreError: Error | undefined
    try {
    if (job.disableForeignKeyChecks) await transaction.execute('SET SESSION FOREIGN_KEY_CHECKS = 0')
    for (const table of truncateOrder) await transaction.execute(`DELETE FROM ${tableName(job.database, table.name)}`)
    for (const [tableIndex, table] of tables.entries()) {
      const total = counts[tableIndex]
      const stats = report.tables[table.name] = { generated: 0, inserted: 0 }
      const columnsForBatch = Math.max(1, table.columns.filter((column) => !column.generated).length)
      const safeBatchSize = Math.min(batchSize, Math.max(1, Math.floor(60_000 / columnsForBatch)))
      let batch: Record<string, unknown>[] = []
      for await (const row of makeRows({ ...job, locale, seed }, table, total, `${seed}:${table.name}`, samples, { driver: job.driver, connectionId: job.connectionId, database: job.database, signal: job.signal })) {
        batch.push(row); stats.generated++; report.generated++
        if (batch.length >= safeBatchSize) {
          const inserted = await insertRows(transaction, job.database, table, batch)
          stats.inserted += inserted; report.inserted += inserted; batch = []
          job.onProgress?.({ table: table.name, generated: stats.generated, inserted: stats.inserted, total })
        }
      }
      if (batch.length) { const inserted = await insertRows(transaction, job.database, table, batch); stats.inserted += inserted; report.inserted += inserted }
      job.onProgress?.({ table: table.name, generated: stats.generated, inserted: stats.inserted, total })
    }
    } catch (error) { operationError = error }
    finally {
      if (job.disableForeignKeyChecks) {
        try { await transaction.execute(`SET SESSION FOREIGN_KEY_CHECKS = ${priorForeignKeyChecks}`) }
        catch {
          await job.driver.disconnect(job.connectionId).catch(() => undefined)
          restoreError = new Error('Could not restore FOREIGN_KEY_CHECKS; the database connection was closed to prevent reuse with checks disabled.')
        }
      }
    }
    if (restoreError) throw restoreError
    if (operationError) throw operationError
  }, job.signal)
  return report
}
