import { describe, expect, it } from 'vitest'
import { splitSqlStatements, statementAtOffset } from '../src/shared/sqlStatements.js'

describe('SQL statement selection', () => {
  it('splits only on semicolons outside strings and comments', () => {
    const sql = "SELECT ';'; -- ignored ;\nSELECT `a;b` /* ; */ FROM t; SELECT 3"
    expect(splitSqlStatements(sql).map(({ sql: statement }) => statement)).toEqual(["SELECT ';'", '-- ignored ;\nSELECT `a;b` /* ; */ FROM t', 'SELECT 3'])
  })

  it('finds the statement at the cursor and keeps source offsets', () => {
    const sql = 'SELECT 1;\n\nSELECT 2;'
    const range = statementAtOffset(sql, sql.indexOf('2'))
    expect(range?.sql).toBe('SELECT 2')
    expect(sql.slice(range!.start, range!.end).trim()).toBe(range!.sql)
  })
})
