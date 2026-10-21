import { describe, expect, it } from 'vitest'
import { findDangerousStatements, warningSuppressedAt } from '../../src/modules/options/executionWarnings.js'

describe('categorized execution warning markers', () => {
  it('suppresses warnings only between the paired SQL comment directives', () => {
    const sql = 'DELETE FROM a;\n-- nowarn\nUPDATE b SET c=1;\n-- endnowarn\nTRUNCATE TABLE c;'
    expect(findDangerousStatements(sql, 10).map(({ kind }) => kind)).toEqual(['delete', 'truncate'])
    expect(warningSuppressedAt(sql, sql.indexOf('UPDATE'))).toBe(true)
    expect(warningSuppressedAt(sql, sql.indexOf('TRUNCATE'))).toBe(false)
  })

  it('does not interpret directive text inside a SQL string or block comment', () => {
    const sql = "SELECT '-- nowarn'; /* -- endnowarn */ DELETE FROM t;"
    expect(findDangerousStatements(sql, 10).map(({ kind }) => kind)).toEqual(['delete'])
  })

  it('skips large scripts over the configured warning analysis limit', () => {
    expect(findDangerousStatements('DELETE FROM t;', 1)).toHaveLength(1)
    expect(findDangerousStatements(`-- ${'x'.repeat(1100)}\nDELETE FROM t;`, 1)).toHaveLength(0)
  })
})
