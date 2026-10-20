import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { exportData, importData, previewImport } from '../../src/modules/data-export-import/index.js'
import type { DbDriver, DbTransaction, SqlValue } from '../../src/main/db/DbDriver.js'
import type { Row } from '../../src/modules/data-export-import/index.js'

function fakeDriver(rows: Row[] = []) {
  const statements: Array<{ sql: string; values: readonly SqlValue[] }> = []
  const driver = {
    streamRows: async function* () { yield* rows },
    withTransaction: async <T>(_id: string, action: (transaction: DbTransaction) => Promise<T>) => action({
      execute: async (sql: string, values: readonly SqlValue[] = []) => { statements.push({ sql, values }); return { affectedRows: 1, insertId: 1 } }
    }),
    executeParameterized: async (_id: string, sql: string, values: readonly SqlValue[] = []) => { statements.push({ sql, values }); return { affectedRows: 1, insertId: 1 } }
  } as unknown as DbDriver
  return { driver, statements }
}

async function outputOf(work: (output: PassThrough) => Promise<unknown>): Promise<Buffer> {
  const output = new PassThrough()
  const chunks: Buffer[] = []
  output.on('data', (chunk: Buffer) => chunks.push(chunk))
  await work(output)
  return Buffer.concat(chunks)
}

describe('data export/import', () => {
  it('exporta CSV em streaming com header, aspas e unicode', async () => {
    const { driver } = fakeDriver([{ id: 1, name: 'a,"b" — 日本語' }, { id: 2, name: null }])
    const content = await outputOf((destination) => exportData({ driver, connectionId: 'id', query: 'SELECT', destination, format: 'csv' }))
    expect(content.toString()).toBe('id,name\r\n1,"a,""b"" — 日本語"\r\n2,\r\n')
  })

  it('faz round trip XLSX com cells escapadas sem manter linhas no exportador', async () => {
    const original = [{ id: 3, name: '雪 & <tea>', nullable: null, blob: Buffer.from([0, 255]), created: new Date('2024-03-01T12:00:00.000Z') }, { id: 4, name: 'naïve', nullable: 'x', blob: Buffer.from('data'), created: new Date('2024-03-02T12:00:00.000Z') }]
    const source = fakeDriver(original)
    const workbook = await outputOf((destination) => exportData({ driver: source.driver, connectionId: 'id', query: 'SELECT', destination, format: 'xlsx' }))
    const imported = fakeDriver()
    const report = await importData({
      driver: imported.driver,
      connectionId: 'id',
      source: (async function* () { yield workbook })(),
      format: 'xlsx',
      table: 'items'
    })
    expect(report).toMatchObject({ read: 2, inserted: 2, errors: 0 })
    expect(imported.statements[0].values).toEqual([3, '雪 & <tea>', null, Buffer.from([0, 255]), new Date('2024-03-01T12:00:00.000Z')])
    expect(imported.statements[1].values).toEqual([4, 'naïve', 'x', Buffer.from('data'), new Date('2024-03-02T12:00:00.000Z')])
  })

  it('importa CSV com mapping usando valores parametrizados e identificadores escapados', async () => {
    const { driver, statements } = fakeDriver()
    const preview = await previewImport({
      driver, connectionId: 'id', source: (async function* () { yield Buffer.from("remote name,value\n\"O'Brien\",NULL\n") })(),
      format: 'csv', table: 'odd`table', options: { columnMapping: { 'remote name': 'display`name', value: 'value' } }
    }, 1)
    expect(preview.columns).toEqual(['display`name', 'value'])
    const report = await importData({
      driver, connectionId: 'id', source: (async function* () { yield Buffer.from("name,value\n\"O'Brien\",NULL\n") })(),
      format: 'csv', table: 'odd`table', options: { columnMapping: { name: 'display`name', value: 'value' } }
    })
    expect(report.inserted).toBe(1)
    expect(statements[0].sql).toContain('`odd``table`')
    expect(statements[0].sql).toContain('`display``name`')
    expect(statements[0].values).toEqual(["O'Brien", 'NULL'])
  })

  it('reconhece quote escapado dividido entre chunks CSV', async () => {
    const { driver, statements } = fakeDriver()
    const report = await importData({
      driver, connectionId: 'id', source: (async function* () { yield Buffer.from('name\n"a"'); yield Buffer.from('"b"\n') })(),
      format: 'csv', table: 'items'
    })
    expect(report.inserted).toBe(1)
    expect(statements[0].values).toEqual(['a"b'])
  })

  it('gera SQL INSERT em batches e escapa texto/blob/null', async () => {
    const { driver } = fakeDriver([{ name: "O'Reilly", bin: Buffer.from([0, 255]), nullable: null }])
    const content = await outputOf((destination) => exportData({
      driver, connectionId: 'id', query: 'SELECT', destination, format: 'sql', options: { table: 'items', batchSize: 1, createTable: true }
    }))
    expect(content.toString()).toContain('CREATE TABLE `items`')
    expect(content.toString()).toContain("'O\\'Reilly'")
    expect(content.toString()).toContain("X'00ff'")
    expect(content.toString()).toContain('NULL')
  })

  it('importa JSON binário e null e interpreta scripts SQL como INSERTs parametrizados', async () => {
    const json = fakeDriver()
    const jsonReport = await importData({
      driver: json.driver, connectionId: 'id', format: 'json', table: 'items',
      source: (async function* () { yield Buffer.from(JSON.stringify([{ id: 1, name: '雪', blob: Buffer.from([0, 255]), nullable: null }])) })()
    })
    expect(jsonReport.inserted).toBe(1)
    expect(json.statements[0].values).toEqual([1, '雪', Buffer.from([0, 255]), null])

    const sql = fakeDriver()
    const sqlReport = await importData({
      driver: sql.driver, connectionId: 'id', format: 'sql', table: 'items',
      source: (async function* () { yield Buffer.from("INSERT INTO `source` (`name`, `blob`, `nullable`) VALUES ('O\\'Brien', X'00ff', NULL);") })()
    })
    expect(sqlReport.inserted).toBe(1)
    expect(sql.statements[0].values).toEqual(["O'Brien", Buffer.from([0, 255]), null])
  })

  it('constrói update, delete e upsert com identificadores escapados e parâmetros', async () => {
    const { driver, statements } = fakeDriver()
    for (const mode of ['update', 'delete', 'upsert'] as const) {
      await importData({
        driver, connectionId: 'id', format: 'json', table: 'items',
        source: (async function* () { yield Buffer.from(JSON.stringify([{ 'id`key': 1, label: "x'" }])) })(),
        options: { mode, keyColumns: ['id`key'] }
      })
    }
    expect(statements[0].sql).toContain('UPDATE `items` SET `label` = ? WHERE `id``key` <=> ?')
    expect(statements[1].sql).toContain('DELETE FROM `items` WHERE `id``key` <=> ?')
    expect(statements[2].sql).toContain('ON DUPLICATE KEY UPDATE `label` = VALUES(`label`)')
    expect(statements.every(({ sql }) => !sql.includes("x'"))).toBe(true)
  })

  it('permite importação sem transação com parâmetros ligados ao connection id', async () => {
    const { driver, statements } = fakeDriver()
    const report = await importData({
      driver, connectionId: 'connection-42', format: 'json', table: 'items',
      source: (async function* () { yield Buffer.from('[{"id":9}]') })(),
      options: { transactional: false }
    })
    expect(report.inserted).toBe(1)
    expect(statements[0]).toEqual({ sql: 'INSERT INTO `items` (`id`) VALUES (?)', values: [9] })
  })
})
