import { describe, expect, it } from 'vitest'
import { assertSchemaUpdateScript, compareSchemas, createObject, diffTables, quoteIdentifier, SchemaIntrospector, type DatabaseModel, type TableModel } from '../../src/modules/schema/index.js'

const table = (name: string, columns = ['id']): TableModel => ({
  kind: 'table', name,
  columns: columns.map((column) => ({ name: column, type: column === 'id' ? 'int' : 'varchar(50)', nullable: false, autoIncrement: column === 'id' })),
  indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: []
})
const database = (name: string, tables: TableModel[]): DatabaseModel => ({ kind: 'database', name, tables, views: [], procedures: [], functions: [], triggers: [], events: [] })

describe('schema DDL and diff', () => {
  it('allows object DDL scripts while rejecting executable side statements from offline models', () => {
    expect(assertSchemaUpdateScript('CREATE TABLE `app`.`items` (`id` INT);')).toHaveLength(1)
    expect(assertSchemaUpdateScript('DELIMITER $$\nCREATE PROCEDURE p() BEGIN INSERT INTO t VALUES (1); END$$\nDELIMITER ;')).toHaveLength(1)
    expect(() => assertSchemaUpdateScript('CREATE VIEW v AS SELECT 1; DELETE FROM accounts;')).toThrow(/allowlist/)
    expect(() => assertSchemaUpdateScript('CREATE PROCEDURE p() BEGIN SELECT 1; END$$\nGRANT ALL ON *.* TO attacker;')).toThrow(/allowlist/)
  })

  it('wraps routine bodies with a delimiter and blocks trailing executable SQL from snapshot DDL', () => {
    const source = database('app', [])
    const routine = { kind: 'procedure' as const, name: 'p', definition: 'BEGIN SELECT 1; END', createSql: 'CREATE DEFINER=`app`@`localhost` PROCEDURE `p`() BEGIN SELECT 1; END' }
    const result = compareSchemas(source, { ...source, procedures: [routine] })
    expect(assertSchemaUpdateScript(result.script)).toHaveLength(1)
    const injected = { ...source, views: [{ kind: 'view' as const, name: 'v', definition: 'SELECT 1', createSql: 'CREATE VIEW `v` AS SELECT 1; DELETE FROM accounts;' }] }
    const malicious = compareSchemas(source, injected).script
    expect(() => assertSchemaUpdateScript(malicious)).toThrow(/allowlist/)
  })

  it('escapes identifiers and generates CREATE TABLE definitions', () => {
    expect(quoteIdentifier('a`b')).toBe('`a``b`')
    expect(createObject(table('items'), 'my db')).toContain('CREATE TABLE `my db`.`items`')
  })

  it('generates column and index changes while keeping drops opt-in', () => {
    const before = table('items', ['id', 'old'])
    const after = table('items', ['id', 'new'])
    expect(diffTables(before, after, 'app').join('\n')).toContain('ADD COLUMN `new` varchar(50)')
    expect(diffTables(before, after, 'app').join('\n')).not.toContain('DROP COLUMN')
    expect(diffTables(before, after, 'app', true).join('\n')).toContain('DROP COLUMN `old`')
  })

  it('orders table dependencies and quotes the schema parameter', async () => {
    const calls: Array<{ sql: string; parameters?: unknown[] }> = []
    const query = async (sql: string, parameters?: unknown[]): Promise<unknown> => {
      calls.push({ sql, parameters })
      if (sql.includes('SCHEMATA')) return [{ charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }]
      if (sql.includes('TABLES t') && sql.includes('AS name')) return [{ name: 'child', engine: 'InnoDB' }, { name: 'parent', engine: 'InnoDB' }]
      if (sql.includes('REFERENCED_TABLE_NAME IS NOT NULL')) return [{ tableName: 'child', name: 'fk_parent', columnName: 'parent_id', referencedTable: 'parent', referencedDatabase: 'demo', referencedColumn: 'id', seq: 1, onUpdate: 'RESTRICT', onDelete: 'CASCADE' }]
      if (sql.startsWith('SHOW CREATE TABLE')) return [{ 'Table': 'x', 'Create Table': 'CREATE TABLE `x` (`id` int)' }]
      if (sql.includes('TABLE_NAME AS tableName')) return []
      return []
    }
    const result = await new SchemaIntrospector(query).inspect('demo')
    expect(result.tables.map((item) => item.name)).toEqual(['parent', 'child'])
    expect(calls[0].parameters).toEqual(['demo'])
    expect(result.tables[1].foreignKeys[0]).toMatchObject({ name: 'fk_parent', referencedTable: 'parent' })
  })

  it('classifies differences and omits DROP statements by default', () => {
    const result = compareSchemas(database('app', [table('old')]), database('app', [table('new')]))
    expect(result.differences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'table', change: 'added', object: 'new' }),
      expect.objectContaining({ kind: 'table', change: 'removed', object: 'old' })
    ]))
    expect(result.script).toContain('CREATE TABLE')
    expect(result.script).not.toContain('DROP TABLE')
    expect(compareSchemas(database('app', [table('old')]), database('app', []), { includeDrops: true }).script).toContain('DROP TABLE')
  })
})
