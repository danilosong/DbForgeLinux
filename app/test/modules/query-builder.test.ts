import { describe, expect, it } from 'vitest'
import { buildQuery, parseQuery, inspectQueryBuilderSchema, selectAllRowsFromTable, wrapSelectAsInsert, wrapSelectAsSubquery } from '../../src/modules/query-builder/index.js'
import type { QueryBuilderModel } from '../../src/modules/query-builder/index.js'
import type { DbDriver } from '../../src/main/db/DbDriver.js'
import { exportFormats } from '../../src/renderer/src/ui/panels/import-export/formats.js'
import { columnPortY, joinPath, joinPortXs } from '../../src/modules/query-builder/diagram.js'
import { joinFromDraggedColumns } from '../../src/modules/query-builder/drag-drop.js'
import { parseDatabaseObjectDrag } from '../../src/shared/databaseObjectDrag.js'

function model(): QueryBuilderModel {
  return {
    statement: 'SELECT', distinct: true, limit: 25,
    tables: [
      { name: 'orders', database: 'shop', alias: 'o', columns: [{ name: 'id', type: 'int' }, { name: 'customer_id', type: 'int' }, { name: 'amount', type: 'decimal' }], foreignKeys: [] },
      { name: 'customers', database: 'shop', alias: 'c', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }], foreignKeys: [] }
    ],
    joins: [{ leftTable: 'o', rightTable: 'c', type: 'LEFT', conditions: [{ left: { table: 'o', column: 'customer_id' }, operator: '=', right: { table: 'c', column: 'id' } }] }],
    selections: [{ source: { table: 'c', column: 'name' }, included: true, sort: 'ASC' }, { source: { table: 'o', column: 'amount' }, included: true, aggregate: 'SUM', group: true }],
    conditions: [{ column: { table: 'o', column: 'amount' }, operator: '>=', value: 12, connector: 'AND' }]
  }
}

describe('query builder', () => {
  it('creates joins from dragged columns and rejects same-table or malformed drags', () => {
    const join = joinFromDraggedColumns({ table: 'o', column: 'customer_id' }, { table: 'c', column: 'id' }, 'LEFT')
    expect(join).toEqual({ leftTable: 'o', rightTable: 'c', type: 'LEFT', conditions: [{ left: { table: 'o', column: 'customer_id' }, operator: '=', right: { table: 'c', column: 'id' } }] })
    expect(joinFromDraggedColumns({ table: 'o', column: 'id' }, { table: 'o', column: 'amount' }, 'INNER')).toBeNull()
    expect(joinFromDraggedColumns({ table: 'o', column: '' }, { table: 'c', column: 'id' }, 'INNER')).toBeNull()
    const payload = parseDatabaseObjectDrag(JSON.stringify({ connectionId: 'conn', database: 'shop', kind: 'view', name: 'active_orders' }))
    expect(payload).toEqual({ connectionId: 'conn', database: 'shop', kind: 'view', name: 'active_orders' })
    expect(parseDatabaseObjectDrag('{bad json')).toBeNull()
  })
  it('selects every projection on one side of a join and wraps single SELECT statements safely', () => {
    const selections = model().selections
    expect(selectAllRowsFromTable(selections, 'o').map((selection) => selection.included)).toEqual([false, true])
    expect(() => selectAllRowsFromTable(selections, '')).toThrow('Choose a table first.')
    const source = 'SELECT id, name FROM `shop`.`customers`;'
    expect(wrapSelectAsSubquery(source)).toBe('SELECT *\nFROM (\nSELECT id, name FROM `shop`.`customers`\n) AS `source_query`')
    expect(wrapSelectAsInsert(source, model().tables[0]!)).toBe('INSERT INTO `shop`.`orders` (`id`, `customer_id`, `amount`)\nSELECT id, name FROM `shop`.`customers`')
    expect(() => wrapSelectAsSubquery('SELECT 1; DELETE FROM users')).toThrow('Wrap requires one SELECT statement.')
    expect(() => wrapSelectAsSubquery('SELECT 1', 'bad`alias')).toThrow('Invalid subquery alias.')
  })
  it('anchors the visual join path at the selected table-column rows', () => {
    const value = model()
    expect(columnPortY(value.tables[0], 'customer_id', 32)).toBe(131)
    expect(columnPortY(value.tables[1], 'id', 32)).toBe(107)
    expect(joinPath(300, 131, 400, 107)).toBe('M 300 131 C 350 131, 350 107, 400 107')
    expect(joinPortXs(40, 330)).toEqual({ startX: 300, endX: 330 })
    expect(joinPortXs(330, 40)).toEqual({ startX: 330, endX: 300 })
  })
  it('generates safe parameterized SQL with joins, criteria, grouping, order, and limit', () => {
    const built = buildQuery(model())
    expect(built.sql).toContain('\n  LEFT JOIN `shop`.`customers` AS `c`\n    ON `o`.`customer_id` = `c`.`id`')
    expect(built.sql).toContain('\nWHERE `o`.`amount` >= ?')
    expect(built.sql).toContain('\nGROUP BY `o`.`amount`')
    expect(built.sql).toContain('\nORDER BY `c`.`name` ASC')
    expect(built.sql).toContain('\nLIMIT 25')
    expect(built.parameters).toEqual([12])
  })

  it('formats projections one per line and starts from the child table when metadata contains a foreign key', () => {
    const query = model()
    query.tables[0]!.foreignKeys = [{ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'id' }]
    query.tables.reverse()
    const built = buildQuery(query)
    expect(built.sql).toMatch(/^SELECT DISTINCT\n {2}`c`\.`name`,\n {2}SUM\(`o`\.`amount`\)\nFROM `shop`\.`orders` AS `o`\n {2}LEFT JOIN/)
  })

  it('builds assignment values before WHERE values and rejects unconfirmed destructive IPC elsewhere', () => {
    const query = model(); query.statement = 'UPDATE'; query.assignments = [{ column: { table: 'o', column: 'amount' }, value: 30 }]
    const built = buildQuery(query)
    expect(built.sql).toContain('UPDATE `shop`.`orders` SET `amount` = ? WHERE')
    expect(built.parameters).toEqual([30, 12])
  })

  it('maps simple SQL back into a visual model and flags unsupported scripts', () => {
    const parsed = parseQuery("SELECT DISTINCT `o`.`id`, `o`.`amount` AS `total` FROM `shop`.`orders` AS `o` WHERE `o`.`amount` >= 10 ORDER BY `o`.`id` DESC LIMIT 15")
    expect(parsed.model?.tables[0]).toMatchObject({ name: 'orders', database: 'shop', alias: 'o' })
    expect(parsed.model?.distinct).toBe(true)
    expect(parsed.model?.conditions[0]).toMatchObject({ operator: '>=', value: 10 })
    expect(parsed.model?.limit).toBe(15)
    const grouped = parseQuery('SELECT `category`, COUNT(*) AS `total` FROM `shop`.`products` GROUP BY `category` HAVING `category` <> \'archived\' ORDER BY `category`')
    expect(grouped.model?.selections).toMatchObject([{ source: { column: 'category' }, group: true }, { aggregate: 'COUNT', alias: 'total' }])
    expect(grouped.model?.conditions[0]).toMatchObject({ having: true, value: 'archived' })
    expect(parseQuery('SELECT 1; DELETE FROM x').error).toContain('more than one statement')
    expect(parseQuery("INSERT INTO `shop`.`orders` (`id`, `amount`) VALUES (1, 9.5)").model).toMatchObject({ statement: 'INSERT', assignments: [{ value: 1 }, { value: 9.5 }] })
    expect(parseQuery('DELETE FROM `shop`.`orders` WHERE `id` = 1').model).toMatchObject({ statement: 'DELETE', conditions: [{ operator: '=', value: 1 }] })
  })

  it('loads table metadata using a bound database name and includes foreign keys', async () => {
    const calls: unknown[][] = []
    const driver = { queryRows: async (...args: unknown[]) => { calls.push(args); return String(args[1]).includes('KEY_COLUMN_USAGE') ? [{ tableName: 'orders', columnName: 'customer_id', referencedTable: 'customers', referencedColumn: 'id' }] : [{ tableName: 'orders', name: 'customer_id', type: 'int', keyName: '', nullable: 'NO' }] } } as unknown as DbDriver
    const schema = await inspectQueryBuilderSchema(driver, 'session', 'shop`db')
    expect(calls[0][2]).toEqual(['shop`db'])
    expect(schema.tables[0].foreignKeys[0]).toEqual({ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'id' })
  })

  it('exports only one XML card in the wizard format list', () => {
    expect(exportFormats.filter((format) => format.id === 'xml')).toHaveLength(1)
    expect(new Set(exportFormats.map((format) => format.id)).size).toBe(exportFormats.length)
  })
})
