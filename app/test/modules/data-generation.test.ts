import { describe, expect, it } from 'vitest'
import { generateData, previewData, type DataGenerationJob } from '../../src/modules/data-generation/index.js'
import type { DbDriver, DbTransaction, SqlValue } from '../../src/main/db/DbDriver.js'
import type { DatabaseModel, TableModel } from '../../src/modules/schema/model.js'
import { generateValue, inferKind, sampleRegex, seededRandom } from '../../src/modules/data-generation/generators.js'

const parent: TableModel = {
  kind: 'table', name: 'parents', columns: [
    { name: 'id', type: 'int', nullable: false }, { name: 'name', type: 'varchar(80)', nullable: false }
  ], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: []
}
const child: TableModel = {
  kind: 'table', name: 'children', columns: [
    { name: 'id', type: 'int', nullable: false }, { name: 'parent_id', type: 'int', nullable: false },
    { name: 'email', type: 'varchar(100)', nullable: false }, { name: 'age', type: 'int', nullable: false }
  ], indexes: [
    { name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] },
    { name: 'uq_email', kind: 'UNIQUE', columns: [{ name: 'email' }] }
  ], foreignKeys: [{ name: 'fk_parent', columns: ['parent_id'], referencedTable: 'parents', referencedColumns: ['id'] }],
  checks: [{ name: 'ck_age', expression: 'age BETWEEN 0 AND 120' }]
}
const schema: DatabaseModel = { kind: 'database', name: 'test', tables: [child, parent], views: [], procedures: [], functions: [], triggers: [], events: [] }

function mockDriver(existingRows: Record<string, unknown>[] = []) {
  const inserts: Array<{ sql: string; values: readonly SqlValue[] }> = []
  const driver = {
    streamRows: async function* () { yield* existingRows },
    executeParameterized: async (_id: string, sql: string, values: readonly SqlValue[]) => { inserts.push({ sql, values }); return { affectedRows: 1, insertId: 1 } },
    withTransaction: async <T>(_id: string, operation: (transaction: DbTransaction) => Promise<T>) => operation({
      execute: async (sql: string, values: readonly SqlValue[] = []) => {
        inserts.push({ sql, values })
        const tuples = sql.split(' VALUES ')[1]?.split('), (').length ?? 1
        return { affectedRows: tuples, insertId: 1 }
      }
    })
  } as unknown as DbDriver
  return { driver, inserts }
}

describe('data generation', () => {
  it('reproduces seeded previews, uses pt-BR semantics and samples generated FK values in dependency order', async () => {
    const { driver, inserts } = mockDriver()
    const previewOne = await previewData({ schema, table: parent, count: 4, seed: 'same', locale: 'pt-BR', generators: { name: { kind: 'name' } } })
    const previewTwo = await previewData({ schema, table: parent, count: 4, seed: 'same', locale: 'pt-BR', generators: { name: { kind: 'name' } } })
    expect(previewOne).toEqual(previewTwo)
    expect(previewOne[0].name).toMatch(/Ana|Bruno|Camila|Diego|Elisa|Felipe|Giovana|Hugo|Isabela|João|Lia|Mateus/)

    const job: DataGenerationJob = {
      driver, connectionId: 'c', database: 'test', schema, rowsPerTable: { parents: 3, children: 8 }, seed: 44,
      batchSize: 4, locale: 'en-US', generators: { 'parents.name': { kind: 'name' }, 'children.email': { kind: 'email' }, 'children.age': { kind: 'number', min: 0, max: 120 } }
    }
    const report = await generateData(job)
    expect(report).toMatchObject({ generated: 11, inserted: 11, tables: { parents: { generated: 3 }, children: { generated: 8 } } })
    expect(inserts.map((item) => item.sql.indexOf('parents'))[0]).toBeGreaterThanOrEqual(0)
    const childBatches = inserts.filter((item) => item.sql.includes('children'))
    const ids = new Set(inserts.filter((item) => item.sql.includes('parents')).flatMap((batch) => batch.values).filter((_v, index) => index % 2 === 0))
    const fkValues = childBatches.flatMap((batch) => batch.values.filter((_v, index) => index % 4 === 1))
    expect(fkValues.every((value) => ids.has(value))).toBe(true)
    const emailValues = childBatches.flatMap((batch) => batch.values.filter((_v, index) => index % 4 === 2))
    expect(new Set(emailValues).size).toBe(8)
    const ages = childBatches.flatMap((batch) => batch.values.filter((_v, index) => index % 4 === 3)) as number[]
    expect(ages.every((age) => age >= 0 && age <= 120)).toBe(true)
  })

  it('generates regex samples deterministically and honors nullable percentage', () => {
    const pattern = sampleRegex('^[A-Z]{2}\\d{4}$', seededRandom(9))
    expect(pattern).toMatch(/^[A-Z]{2}\d{4}$/)
    expect(sampleRegex('^[A-Z]{2}\\d{4}$', seededRandom(9))).toBe(pattern)
  })

  it('infers country and enum status generators from semantic column metadata', () => {
    const country = { name: 'country_code', type: 'char(2)', nullable: false }
    const status = { name: 'status', type: "enum('active','inactive','pending')", nullable: false }
    expect(inferKind(country)).toBe('country')
    expect(inferKind(status)).toBe('status')
    const context = { random: seededRandom(2), locale: 'en-US' as const, rowIndex: 0, table: parent, column: country }
    expect(generateValue(context)).toMatch(/^[A-Z]{2}$/)
    expect(['active', 'inactive', 'pending']).toContain(generateValue({ ...context, column: status }))
  })

  it('infers the expanded semantic catalog and produces stable localized values', () => {
    const cases = [
      [{ name: 'first_name', type: 'varchar(80)', nullable: false }, 'firstName'],
      [{ name: 'phone_number', type: 'varchar(24)', nullable: false }, 'phone'],
      [{ name: 'company_name', type: 'varchar(80)', nullable: false }, 'company'],
      [{ name: 'website_url', type: 'varchar(120)', nullable: false }, 'url'],
      [{ name: 'client_ip', type: 'varchar(24)', nullable: false }, 'ip'],
      [{ name: 'record_uuid', type: 'char(36)', nullable: false }, 'uuid'],
      [{ name: 'metadata', type: 'json', nullable: false }, 'json']
    ] as const
    for (const [column, kind] of cases) expect(inferKind(column)).toBe(kind)
    const context = { random: seededRandom('catalog'), locale: 'pt-BR' as const, rowIndex: 0, table: parent, column: { name: 'record_uuid', type: 'char(36)', nullable: false } }
    const firstValue = generateValue(context)
    expect(firstValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(generateValue({ ...context, random: seededRandom('catalog') })).toBe(firstValue)
    expect(generateValue({ ...context, column: { name: 'city', type: 'varchar(80)', nullable: false } })).toMatch(/São Paulo|Rio de Janeiro|Recife|Curitiba|Manaus/)
  })

  it('starts generated unique numeric values after existing values and supports explicit unique values', async () => {
    const { driver } = mockDriver([{ id: 40, name: 'existing' }])
    const preview = await previewData({ schema, table: parent, count: 2, driver, connectionId: 'c', database: 'test', seed: 1 })
    expect(preview.map((row) => row.id)).toEqual([41, 42])
    const generated = await previewData({ schema, table: parent, count: 3, seed: 1, generators: { id: { kind: 'unique', start: 100 } } })
    expect(generated.map((row) => row.id)).toEqual([100, 101, 102])
  })

  it('aborts generation through the signal before inserting rows', async () => {
    const { driver, inserts } = mockDriver()
    const controller = new AbortController(); controller.abort()
    await expect(generateData({ driver, connectionId: 'c', database: 'test', schema, tables: ['parents'], rowsPerTable: 1, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(inserts).toEqual([])
  })

  it('detects selected-table FK cycles before opening a generation transaction', async () => {
    const a: TableModel = { ...parent, name: 'cycle_a', foreignKeys: [{ name: 'fk_a_b', columns: ['id'], referencedTable: 'cycle_b', referencedColumns: ['id'] }] }
    const b: TableModel = { ...parent, name: 'cycle_b', foreignKeys: [{ name: 'fk_b_a', columns: ['id'], referencedTable: 'cycle_a', referencedColumns: ['id'] }] }
    const { driver, inserts } = mockDriver()
    await expect(generateData({ driver, connectionId: 'c', database: 'test', schema: { ...schema, tables: [a, b] }, rowsPerTable: 1 })).rejects.toThrow(/cyclic foreign-key dependency/i)
    expect(inserts).toEqual([])
  })
})
