import { describe, expect, it } from 'vitest'
import { expandSqlWildcards, qualifyObjectNames, transformIdentifiers } from './refactoring.js'

const metadata = { database: 'appdb', databases: ['appdb'], objects: [{ name: 'orders', kind: 'table' as const, columns: [{ name: 'order_id', type: 'BIGINT' }, { name: 'created_at', type: 'DATETIME' }] }], routines: [] }

describe('SQL editor refactoring', () => {
  it('adds/removes safe identifier quoting without changing SQL keywords or literals', () => {
    const source = "SELECT order_id, 'orders' FROM orders; -- SELECT order_id"
    expect(transformIdentifiers(source, 'add-backticks')).toBe("SELECT `order_id`, 'orders' FROM `orders`; -- SELECT order_id")
    expect(transformIdentifiers('SELECT `order_id` FROM `orders`', 'remove-backticks')).toBe('SELECT order_id FROM orders')
  })
  it('qualifies object names and expands wildcard columns with the alias', () => {
    expect(qualifyObjectNames("SELECT * FROM orders WHERE note = 'orders' -- orders", metadata)).toBe("SELECT * FROM `appdb`.`orders` WHERE note = 'orders' -- orders")
    expect(expandSqlWildcards('SELECT * FROM orders o;', metadata)).toBe('SELECT o.order_id,\n       o.created_at FROM orders o;')
    expect(expandSqlWildcards('SELECT o.* FROM appdb.orders o;', metadata)).toBe('SELECT o.order_id,\n       o.created_at FROM appdb.orders o;')
  })
})
