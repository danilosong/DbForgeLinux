import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { exportData, generateImportSql, importData, previewExport, previewImport } from '../../src/modules/data-export-import/index.js'
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

  it('neutralizes spreadsheet formulas in streamed CSV exports', async () => {
    const { driver } = fakeDriver([{ value: '=1+1' }, { value: '\t@SUM(A1:A2)' }, { value: '-cmd' }])
    const content = await outputOf((destination) => exportData({ driver, connectionId: 'id', query: 'SELECT', destination, format: 'csv' }))
    expect(content.toString()).toBe("value\r\n'=1+1\r\n'\t@SUM(A1:A2)\r\n'-cmd\r\n")
  })

  it('exports tab-separated text and applies forced quotes', async () => {
    const { driver } = fakeDriver([{ id: 5, label: 'plain' }])
    const content = await outputOf((destination) => exportData({ driver, connectionId: 'id', query: 'SELECT', destination, format: 'text', options: { header: true, forceQuotes: true } }))
    expect(content.toString()).toBe('"id"\t"label"\r\n"5"\t"plain"\r\n')
  })

  it('imports tab-separated text and repopulates through a transaction', async () => {
    const { driver, statements } = fakeDriver()
    const report = await importData({
      driver, connectionId: 'id', format: 'text', table: 'items',
      source: (async function* () { yield Buffer.from('id\tlabel\n7\tnew\n') })(),
      options: { mode: 'repopulate' }
    })
    expect(report).toMatchObject({ read: 1, inserted: 1, errors: 0 })
    expect(statements[0].sql).toBe('DELETE FROM `items`')
    expect(statements[1].sql).toBe('INSERT INTO `items` (`id`, `label`) VALUES (?, ?)')
  })

  it('asks after an import row error and can continue with the following row', async () => {
    let writes = 0
    const driver = {
      withTransaction: async <T>(_id: string, operation: (transaction: DbTransaction) => Promise<T>) => operation({
        execute: async (_sql: string, values: readonly SqlValue[] = []) => {
          if (values[0] === 1) throw new Error('constraint rejected')
          writes++
          return { affectedRows: 1, insertId: 2 }
        }
      })
    } as unknown as DbDriver
    const asked: Array<{ row: number; message: string }> = []
    const report = await importData({
      driver, connectionId: 'id', format: 'json', table: 'items',
      source: (async function* () { yield Buffer.from('[{"id":1},{"id":2}]') })(),
      options: { onRowError: 'prompt', onRowErrorPrompt: async (row, message) => { asked.push({ row, message }); return 'continue' } }
    })
    expect(asked).toEqual([{ row: 1, message: 'constraint rejected' }])
    expect(report).toMatchObject({ read: 2, inserted: 1, errors: 1 })
    expect(writes).toBe(1)
  })

  it('streams a parameterized import as a safe SQL script', async () => {
    const { driver } = fakeDriver()
    const lines: string[] = []
    for await (const line of generateImportSql({
      driver, connectionId: 'id', format: 'json', table: 'items',
      source: (async function* () { yield Buffer.from(JSON.stringify([{ id: 8, label: "x' OR 1=1 --" }])) })(),
      options: { mode: 'repopulate' }
    })) lines.push(line)
    expect(lines[0]).toBe('DELETE FROM `items`;\n')
    expect(lines[1]).toContain("INSERT INTO `items` (`id`, `label`) VALUES (8, 'x\\' OR 1=1 --');")
  })

  it('faz round trip CSV de exportação para importação com aspas, unicode e NULL', async () => {
    const original = [{ id: '8', name: `O'Brien, "雪"`, nullable: '' }]
    const source = fakeDriver(original)
    const csv = await outputOf((destination) => exportData({ driver: source.driver, connectionId: 'id', query: 'SELECT', destination, format: 'csv' }))
    const target = fakeDriver()
    const report = await importData({
      driver: target.driver,
      connectionId: 'id',
      source: (async function* () { yield csv })(),
      format: 'csv',
      table: 'round_trip'
    })
    expect(report).toMatchObject({ read: 1, inserted: 1, errors: 0 })
    expect(target.statements[0].values).toEqual(['8', `O'Brien, "雪"`, ''])
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

  it('importa XML em elementos de linha e faz preview de linhas do banco', async () => {
    const target = fakeDriver()
    const report = await importData({
      driver: target.driver, connectionId: 'id', format: 'xml', table: 'items',
      source: (async function* () { yield Buffer.from('<rows><row><id>7</id><label>A &amp; B</label></row></rows>') })()
    })
    expect(report.inserted).toBe(1)
    expect(target.statements[0].values).toEqual(['7', 'A & B'])

    const entities = fakeDriver()
    await importData({ driver: entities.driver, connectionId: 'id', format: 'xml', table: 'items', source: (async function* () { yield Buffer.from('<!DOCTYPE rows [<!ENTITY local SYSTEM "file:///etc/passwd">]><rows><row><label>&local;</label></row></rows>') })() })
    expect(entities.statements[0].values).toEqual(['&local;'])

    const source = fakeDriver([{ id: 1 }, { id: 2 }, { id: 3 }])
    const preview = await previewExport({ driver: source.driver, connectionId: 'id', query: 'SELECT * FROM items' }, 2)
    expect(preview).toEqual([{ id: 1 }, { id: 2 }])
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
