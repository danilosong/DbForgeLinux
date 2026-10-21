import { describe, expect, it } from 'vitest'
import { compareCustomQueryRows, validateCustomCompareQuery } from '../../src/modules/data-compare/custom-query.js'

describe('custom query Data Compare', () => {
  it('matches rows by explicit keys and reports different and one-sided records', () => {
    const result = compareCustomQueryRows(
      [{ id: 1, label: 'same' }, { id: 2, label: 'source' }],
      [{ id: 1, label: 'same' }, { id: 3, label: 'target' }],
      ['id']
    )
    expect(result.report).toEqual({ compared: 3, same: 1, different: 0, sourceOnly: 1, targetOnly: 1, statements: 0 })
    expect(result.differences.map((row) => row.kind)).toEqual(['same', 'source-only', 'target-only'])
  })

  it('can ignore fractional seconds and round numeric columns', () => {
    const result = compareCustomQueryRows(
      [{ id: 1, updated_at: '2025-04-05 10:11:12.123456', score: 1.2341 }],
      [{ id: 1, updated_at: '2025-04-05 10:11:12.999999', score: 1.2344 }],
      ['id'], undefined, { ignoreMicroseconds: true, roundFloats: 2 }
    )
    expect(result.report.same).toBe(1)
  })

  it('rejects missing or duplicate keys', () => {
    expect(() => compareCustomQueryRows([{ name: 'x' }], [], ['id'])).toThrow(/missing key/i)
    expect(() => compareCustomQueryRows([{ id: 1 }, { id: 1 }], [], ['id'])).toThrow(/duplicate/i)
  })

  it('accepts a single read-only SELECT and rejects writes or multiple statements', () => {
    expect(validateCustomCompareQuery('SELECT id FROM items;')).toBe('SELECT id FROM items')
    expect(() => validateCustomCompareQuery('SELECT 1; DELETE FROM items')).toThrow(/read-only/i)
    expect(() => validateCustomCompareQuery('UPDATE items SET id = 2')).toThrow(/read-only/i)
  })
})
