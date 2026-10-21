import { describe, expect, it } from 'vitest'
import { assertSafeSearchRegex, findInvalidObjects, searchObjectText } from '../../src/modules/database-tools/index.js'
import type { DatabaseObject } from '../../src/shared/contracts/sql.js'

const objects: DatabaseObject[] = [{ kind: 'view', name: 'customer_view' }, { kind: 'procedure', name: 'refresh_customer' }]
describe('database tools', () => {
  it('searches object names and definitions with literal, word, case and regex filters', () => {
    const definitions = new Map([['view:customer_view', 'SELECT CustomerId FROM customers;'], ['procedure:refresh_customer', 'CALL customer_view();']])
    expect(searchObjectText(objects, definitions, 'customer', { names: true, definitions: false })).toHaveLength(2)
    expect(searchObjectText(objects, definitions, 'CustomerId', { names: false, definitions: true, caseSensitive: true })).toMatchObject([{ object: { name: 'customer_view' }, line: 1 }])
    expect(searchObjectText(objects, definitions, '^CALL', { names: false, definitions: true, regex: true })).toHaveLength(1)
    expect(() => searchObjectText(objects, definitions, '[', { names: true, definitions: false, regex: true })).toThrow('invalid')
    expect(searchObjectText(objects, definitions, 'customer', { names: false, definitions: true, wholeWord: true })).toHaveLength(0)
  })
  it('rejects nested quantified groups that can backtrack exponentially', () => {
    expect(() => assertSafeSearchRegex('(a+)+$')).toThrow(/backtracking|repetition/i)
    expect(() => searchObjectText(objects, new Map(), '([a-z]+)*$', { names: true, definitions: false, regex: true })).toThrow(/backtracking|repetition/i)
    expect(() => assertSafeSearchRegex('a*a*')).toThrow(/repetition/i)
    expect(() => assertSafeSearchRegex('^CALL.*')).not.toThrow()
  })
  it('checks each object and reports invalid definitions separately from scan errors', async () => {
    const result = await findInvalidObjects(objects, async (object) => `CREATE ${object.kind} ${object.name}`, async (object) => {
      if (object.name === 'customer_view') throw new Error("Unknown column 'x' in field list")
      if (object.name === 'refresh_customer') throw new Error('Access denied')
    })
    expect(result.checked).toBe(0)
    expect(result.invalid.map((item) => item.object.name)).toEqual(['customer_view'])
    expect(result.errors.map((item) => item.object.name)).toEqual(['refresh_customer'])
    expect(result.invalid[0].definition).toContain('CREATE view')
  })
})
