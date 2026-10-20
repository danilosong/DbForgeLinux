import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { generateData } from '../../src/modules/data-generation/index.js'
import { compareData } from '../../src/modules/data-compare/index.js'
import { writeDocumentation } from '../../src/modules/documenter/index.js'
import type { DatabaseModel, TableModel } from '../../src/modules/schema/model.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('M14, M9 Data Compare e M15 MySQL integration', () => {
  const driver = new MysqlDriver()
  const suffix = `${process.pid}_${Date.now()}`
  const db = `imex_${suffix}`
  const sourceDb = `cmp_a_${suffix}`
  const targetDb = `cmp_b_${suffix}`
  let connectionId = ''

  afterAll(async () => {
    if (connectionId) {
      await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${db}\`; DROP DATABASE IF EXISTS \`${sourceDb}\`; DROP DATABASE IF EXISTS \`${targetDb}\`;`)
      await driver.disconnect(connectionId)
    }
  })

  it('generates 100k FK rows, synchronizes A to B, and writes documentation artifacts', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection('m14-integration', 'Data modules integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only'
    })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${db}\`; CREATE DATABASE \`${sourceDb}\`; CREATE DATABASE \`${targetDb}\`;`)
    await driver.executeSql(connectionId, `CREATE TABLE \`${db}\`.parents (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE); CREATE TABLE \`${db}\`.children (id INT PRIMARY KEY, parent_id INT NOT NULL, email VARCHAR(100) NOT NULL UNIQUE, age INT NOT NULL, CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES \`${db}\`.parents(id), CONSTRAINT ck_age CHECK (age >= 0));`)
    await driver.executeSql(connectionId, `CREATE TABLE \`${sourceDb}\`.items (id INT PRIMARY KEY, label VARCHAR(100) NOT NULL); CREATE TABLE \`${targetDb}\`.items (id INT PRIMARY KEY, label VARCHAR(100) NOT NULL);`)

    const parent: TableModel = { kind: 'table', name: 'parents', columns: [{ name: 'id', type: 'int', nullable: false }, { name: 'name', type: 'varchar(80)', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }, { name: 'uq_name', kind: 'UNIQUE', columns: [{ name: 'name' }] }], foreignKeys: [], checks: [] }
    const child: TableModel = { kind: 'table', name: 'children', columns: [{ name: 'id', type: 'int', nullable: false }, { name: 'parent_id', type: 'int', nullable: false }, { name: 'email', type: 'varchar(100)', nullable: false }, { name: 'age', type: 'int', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }, { name: 'uq_email', kind: 'UNIQUE', columns: [{ name: 'email' }] }], foreignKeys: [{ name: 'fk_parent', columns: ['parent_id'], referencedDatabase: db, referencedTable: 'parents', referencedColumns: ['id'] }], checks: [{ name: 'ck_age', expression: 'age >= 0' }] }
    const schema: DatabaseModel = { kind: 'database', name: db, tables: [child, parent], views: [], procedures: [], functions: [], triggers: [], events: [] }
    const generation = await generateData({
      driver, connectionId, database: db, schema, rowsPerTable: { parents: 100, children: 100_000 }, seed: 710,
      batchSize: 250, locale: 'pt-BR', generators: { 'parents.name': { kind: 'name' }, 'children.email': { kind: 'email' }, 'children.age': { kind: 'number', min: 0, max: 120 } }
    })
    expect(generation).toMatchObject({ generated: 100_100, inserted: 100_100 })
    const counts = await driver.queryRows(connectionId, `SELECT COUNT(*) AS total, COUNT(DISTINCT parent_id) AS parents_used FROM \`${db}\`.children`)
    expect(Number(counts[0]?.total)).toBe(100_000)
    const orphans = await driver.queryRows(connectionId, `SELECT COUNT(*) AS total FROM \`${db}\`.children c LEFT JOIN \`${db}\`.parents p ON p.id = c.parent_id WHERE p.id IS NULL`)
    expect(Number(orphans[0]?.total)).toBe(0)

    await driver.executeParameterized(connectionId, `INSERT INTO \`${sourceDb}\`.items (id, label) VALUES (?, ?)`, [1, "O'Reilly"])
    await driver.executeParameterized(connectionId, `INSERT INTO \`${sourceDb}\`.items (id, label) VALUES (?, ?)`, [2, 'from source'])
    await driver.executeParameterized(connectionId, `INSERT INTO \`${targetDb}\`.items (id, label) VALUES (?, ?)`, [1, 'old'])
    await driver.executeParameterized(connectionId, `INSERT INTO \`${targetDb}\`.items (id, label) VALUES (?, ?)`, [3, 'delete me'])
    const statements: string[] = []
    const synced = await compareData({
      source: { driver, connectionId, database: sourceDb, table: 'items' }, target: { driver, connectionId, database: targetDb, table: 'items' },
      keyColumns: ['id'], allowDeletes: true,
      onStatement: async (statement) => { statements.push(statement.kind); await driver.executeParameterized(connectionId, statement.sql, statement.values) }
    })
    expect(synced).toMatchObject({ different: 1, sourceOnly: 1, targetOnly: 1, statements: 3 })
    expect(statements).toEqual(['UPDATE', 'INSERT', 'DELETE'])
    const verified = await compareData({ source: { driver, connectionId, database: sourceDb, table: 'items' }, target: { driver, connectionId, database: targetDb, table: 'items' }, keyColumns: ['id'] })
    expect(verified).toMatchObject({ compared: 2, same: 2, different: 0, sourceOnly: 0, targetOnly: 0 })

    const outputDirectory = await mkdtemp(join(tmpdir(), 'dbforge-m15-'))
    try {
      const artifacts = await writeDocumentation(schema, { outputDirectory, formats: ['html', 'markdown'], includeDiagram: true })
      expect((await readFile(artifacts.html!, 'utf8')).startsWith('<!doctype html>')).toBe(true)
      expect((await readFile(artifacts.markdown!, 'utf8')).startsWith('# Database documentation')).toBe(true)
      expect((await readFile(artifacts.diagram!, 'utf8')).startsWith('<svg')).toBe(true)
    } finally { await rm(outputDirectory, { recursive: true, force: true }) }
  }, 240_000)
})
