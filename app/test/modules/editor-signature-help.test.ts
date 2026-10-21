import { describe, expect, it } from 'vitest'
import { getActiveSqlSignature } from '../../src/modules/editor/signatureHelp.js'

describe('SQL parameter info', () => {
  it('identifies the current argument and provides a range for its highlight', () => {
    const sql = "SELECT SUBSTRING(CONCAT('a,b', name), 2, "
    expect(getActiveSqlSignature(sql, sql.length)).toMatchObject({
      name: 'SUBSTRING',
      label: 'SUBSTRING(text, start_position, length)',
      activeParameter: 2,
      parameterRanges: [[10, 14], [16, 30], [32, 38]]
    })
  })

  it('uses the innermost unfinished call and ignores commas in strings and comments', () => {
    const sql = "SELECT IF(flag, CONCAT('x,y', value), /* , */ "
    expect(getActiveSqlSignature(sql, sql.length)).toMatchObject({ name: 'IF', activeParameter: 2 })
  })

  it('returns no signature outside a recognized function call', () => {
    expect(getActiveSqlSignature('SELECT value, other', 12)).toBeUndefined()
    expect(getActiveSqlSignature('SELECT UNKNOWN(value, ', 22)).toBeUndefined()
  })

  it('resolves a recognized call inside an outer parenthesized expression', () => {
    const sql = 'SELECT (IF(test, CONCAT(left_value, '
    expect(getActiveSqlSignature(sql, sql.length)).toMatchObject({ name: 'CONCAT', activeParameter: 1 })
  })
})
