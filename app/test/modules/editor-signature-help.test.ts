import { describe, expect, it } from 'vitest'
import { getActiveSqlSignature, mysql84NativeSignatures } from '../../src/modules/editor/signatureHelp.js'
import { ptBrModulesSignature } from '../../src/renderer/src/i18n/ptBrModulesSignature.js'

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

  it('uses active database routine parameters when available', () => {
    const sql = 'SELECT app_total(order_id, '
    expect(getActiveSqlSignature(sql, sql.length, [{ name: 'app_total', kind: 'function', parameters: ['IN order_id BIGINT', 'IN currency_code VARCHAR'] }])).toMatchObject({
      name: 'app_total', label: 'app_total(IN order_id BIGINT, IN currency_code VARCHAR)', activeParameter: 1
    })
  })

  it('covers native MySQL 8.4 JSON, spatial, arithmetic, and no-argument functions', () => {
    expect(new Set(mysql84NativeSignatures.map(({ name }) => name)).size).toBe(367)
    const jsonCall = 'SELECT JSON_VALUE(payload, \'$.items[0]\', '
    expect(getActiveSqlSignature(jsonCall, jsonCall.length)).toMatchObject({ name: 'JSON_VALUE', activeParameter: 1, parameters: ['document', 'path RETURNING type ON EMPTY clause ON ERROR clause'] })
    const spatialCall = 'SELECT ST_BUFFER(shape, '
    expect(getActiveSqlSignature(spatialCall, spatialCall.length)).toMatchObject({ name: 'ST_BUFFER', activeParameter: 1 })
    const arithmeticCall = 'SELECT LOG10('
    expect(getActiveSqlSignature(arithmeticCall, arithmeticCall.length)).toMatchObject({ name: 'LOG10', activeParameter: 0 })
    const zeroArgumentCall = 'SELECT CURRENT_USER('
    expect(getActiveSqlSignature(zeroArgumentCall, zeroArgumentCall.length)).toMatchObject({ name: 'CURRENT_USER', label: 'CURRENT_USER()', parameters: [] })
  })

  it('provides a translated description for every native catalog entry', () => {
    const descriptions = [...new Set(mysql84NativeSignatures.map(({ description }) => description))]
    expect(descriptions.every((description) => Boolean(ptBrModulesSignature[description]) && ptBrModulesSignature[description] !== description)).toBe(true)
    expect(descriptions.some((description) => description.startsWith('MySQL 8.4 native '))).toBe(false)
  })
})
