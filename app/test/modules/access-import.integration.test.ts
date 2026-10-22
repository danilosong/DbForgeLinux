import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { buildCreateTableSql } from '../../src/modules/data-export-import/inference.js'
import { importData, previewImport } from '../../src/modules/data-export-import/index.js'
import { parseAccessSchema, parseAccessTables } from '../../src/modules/data-export-import/access.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const execFileAsync = promisify(execFile)
const fixture = new URL('../fixtures/sample-access.mdb', import.meta.url)
const tools = ['mdb-tables', 'mdb-schema', 'mdb-export'] as const
const mdbtoolsInstalled = await Promise.all(tools.map(async (tool) => {
  try { await execFileAsync(tool, ['--version'], { timeout: 3_000, shell: false }); return true } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ENOENT' }
})).then((installed) => installed.every(Boolean))
const enabled = process.env.MYSQL_INTEGRATION === '1' && mdbtoolsInstalled

describe.skipIf(!enabled)('Access mdbtools MySQL integration', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('access_fixture')
  const table = 'customers_imported'
  let connectionId = ''

  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``) }
    finally { await driver.disconnect(connectionId) }
  })

  it('reads mdb-tables, mdb-schema and mdb-export output, maps Access values, and imports into MySQL', async () => {
    const path = fixture.pathname
    const [tableOutput, nativeSchema, mysqlSchema, exportOutput] = await Promise.all([
      execFileAsync('mdb-tables', ['-1', '--', path], { timeout: 10_000, encoding: 'utf8', shell: false }),
      execFileAsync('mdb-schema', ['--indexes', '--', path], { timeout: 30_000, encoding: 'utf8', shell: false }),
      execFileAsync('mdb-schema', ['--indexes', '--', path, 'mysql'], { timeout: 30_000, encoding: 'utf8', shell: false }),
      execFileAsync('mdb-export', ['-B', '-D', '%Y-%m-%d', '-T', '%Y-%m-%d %H:%M:%S', '--', path, 'Customers'], { timeout: 30_000, encoding: 'buffer', shell: false })
    ])
    expect(parseAccessTables(tableOutput.stdout)).toEqual(['Customers', 'Orders', 'Tags'])
    const schema = parseAccessSchema(nativeSchema.stdout, mysqlSchema.stdout, 'Customers')
    expect(schema.columns.map(({ name, type, primaryKey }) => ({ name, type, primaryKey }))).toEqual([
      { name: 'CustomerID', type: 'INT', primaryKey: true },
      { name: 'DisplayName', type: 'VARCHAR(50)', primaryKey: false },
      { name: 'CreditLimit', type: 'DECIMAL(19,4)', primaryKey: false },
      { name: 'CreatedAt', type: 'DATETIME', primaryKey: false },
      { name: 'IsActive', type: 'TINYINT(1)', primaryKey: false },
      { name: 'Notes', type: 'TEXT', primaryKey: false },
      { name: 'OptionalCode', type: 'VARCHAR(15)', primaryKey: false }
    ])
    const source = Buffer.isBuffer(exportOutput.stdout) ? exportOutput.stdout : Buffer.from(exportOutput.stdout)
    const preview = await previewImport({
      driver: {} as MysqlDriver,
      connectionId: '',
      table: '',
      format: 'csv',
      source: (async function* () { yield source })(),
      options: { nullString: '', booleanTrueValue: 'true', booleanFalseValue: 'false' }
    }, 20)
    expect(preview.columns).toEqual(schema.columns.map(({ name }) => name))
    expect(preview.rows).toHaveLength(3)
    expect(preview.rows[0]).toMatchObject({ CustomerID: '1', DisplayName: "João d'Ávila", CreditLimit: '1234.5600', CreatedAt: '2024-02-29 14:35:06', IsActive: true })
    expect(String(preview.rows[0]?.Notes)).toContain('Conteúdo longo de teste')
    expect(preview.rows[1]?.CreatedAt).toBe('2025-12-01 08:05:00')
    expect(preview.rows[2]).toMatchObject({ CreditLimit: null, CreatedAt: null, Notes: null, OptionalCode: null })

    connectionId = await driver.connect({
      ...createDefaultConnection(mysqlTestPrefix('access_conn'), 'Access import integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067),
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only'
    })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(connectionId, buildCreateTableSql(database, table, schema.columns), undefined, database)
    const report = await importData({
      driver,
      connectionId,
      source: (async function* () { yield source })(),
      format: 'csv',
      table: `${database}.${table}`,
      options: { nullString: '', booleanTrueValue: 'true', booleanFalseValue: 'false', transactional: true }
    })
    expect(report).toMatchObject({ read: 3, inserted: 3, errors: 0 })
    const imported: Array<Record<string, unknown>> = []
    for await (const row of driver.streamRows(connectionId, `SELECT * FROM \`${database}\`.\`${table}\` ORDER BY CustomerID`)) imported.push(row)
    expect(imported[0]).toMatchObject({ DisplayName: "João d'Ávila", CreditLimit: '1234.5600', CreatedAt: expect.anything(), IsActive: true })
    expect(imported[2]).toMatchObject({ CreditLimit: null, CreatedAt: null, Notes: null, OptionalCode: null })
  }, 120_000)
})
