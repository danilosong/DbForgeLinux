import { mkdtemp, mkdir, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSchemaSnapshot, parseSchemaSnapshot, parseStaticDdl, readScriptsFolder } from '../../src/modules/schema/offline.js'
import { compareSchemas } from '../../src/modules/schema/compare.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const schema: DatabaseModel = { kind: 'database', name: 'shop', tables: [{ kind: 'table', name: 'customers', columns: [{ name: 'id', type: 'int', nullable: false, autoIncrement: true }, { name: 'email', type: 'varchar(120)', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }, { name: 'uq_email', kind: 'UNIQUE', columns: [{ name: 'email' }] }], foreignKeys: [], checks: [], engine: 'InnoDB' }, { kind: 'table', name: 'orders', columns: [{ name: 'id', type: 'int', nullable: false }, { name: 'customer_id', type: 'int', nullable: false }], indexes: [], foreignKeys: [{ name: 'fk_orders_customer', columns: ['customer_id'], referencedTable: 'customers', referencedColumns: ['id'], onDelete: 'CASCADE' }], checks: [] }], views: [], procedures: [], functions: [], triggers: [], events: [] }
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('offline schema sources', () => {
  it('round-trips versioned snapshots and rejects unknown versions or malformed models', () => {
    const snapshot = createSchemaSnapshot(schema, '2026-01-01T00:00:00Z')
    expect(parseSchemaSnapshot(JSON.stringify(snapshot))).toEqual(schema)
    expect(() => parseSchemaSnapshot(JSON.stringify({ ...snapshot, version: 55 }))).toThrow(/version/i)
    expect(() => parseSchemaSnapshot(JSON.stringify({ ...snapshot, schema: { ...schema, tables: [{ name: 'bad' }] } }))).toThrow(/invalid/i)
  })

  it('parses CREATE TABLE statements statically without interpreting user SQL', () => {
    const model = parseStaticDdl("CREATE DATABASE forbidden; CREATE TABLE `shop`.`orders` (`id` int NOT NULL AUTO_INCREMENT, `customer_id` int, `amount` decimal(9,2) DEFAULT 0, PRIMARY KEY (`id`), KEY `idx_customer` (`customer_id`), CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop`.`customers` (`id`) ON DELETE CASCADE) ENGINE=InnoDB; DROP DATABASE forbidden;", 'offline')
    expect(model.tables).toHaveLength(1)
    expect(model.tables[0]).toMatchObject({ name: 'orders', engine: 'InnoDB', columns: [{ name: 'id', type: 'int', nullable: false, autoIncrement: true }, { name: 'customer_id', nullable: true }, { name: 'amount', type: 'decimal(9,2)', default: '0' }] })
    expect(model.tables[0].foreignKeys[0]).toMatchObject({ name: 'fk_orders_customer', referencedDatabase: 'shop', referencedTable: 'customers', onDelete: 'CASCADE' })
    expect(model.tables[0].indexes).toContainEqual({ name: 'idx_customer', kind: 'INDEX', columns: [{ name: 'customer_id' }] })
    const compared = compareSchemas(schema, model)
    expect(compared.differences.length).toBeGreaterThan(0)
    expect(compared.script).toMatch(/(?:CREATE|ALTER) TABLE/)
  })

  it('reads .sql files recursively in stable order and ignores non-SQL files', async () => {
    const folder = await mkdtemp(join(tmpdir(), `dbforge-scripts-${process.pid}-`)); dirs.push(folder)
    await writeFile(join(folder, '02.sql'), 'CREATE TABLE later (id int NOT NULL);')
    await writeFile(join(folder, '01.sql'), 'CREATE TABLE earlier (id int NOT NULL);')
    await writeFile(join(folder, 'ignored.txt'), 'CREATE TABLE ignored (id int);')
    await mkdir(join(folder, 'nested')); await writeFile(join(folder, 'nested', '03.sql'), 'CREATE TABLE nested_table (id int);')
    expect((await readScriptsFolder(folder)).tables.map((table) => table.name)).toEqual(['earlier', 'later', 'nested_table'])
  })
  it('rejects symlink roots and checks aggregate script size before reading', async () => {
    const parent = await mkdtemp(join(tmpdir(), `dbforge-scripts-link-${process.pid}-`)); dirs.push(parent)
    const actual = join(parent, 'actual'); const link = join(parent, 'link')
    await mkdir(actual); await symlink(actual, link)
    await expect(readScriptsFolder(link)).rejects.toThrow(/symbolic link/i)
    const oversized = join(actual, 'large.sql'); await writeFile(oversized, ''); await truncate(oversized, 64 * 1024 * 1024 + 1)
    await expect(readScriptsFolder(actual)).rejects.toThrow(/64 MiB/i)
  })
})
