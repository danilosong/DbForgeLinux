import { describe, expect, it } from 'vitest'
import { findDangerousStatements, warningSuppressedAt } from '../../src/modules/options/executionWarnings.js'
import { splitSqlStatements } from '../../src/shared/sqlStatements.js'

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

describe('editor destructive statement gate', () => {
  it('treats a commented-out or quoted WHERE as missing', async () => {
    const { isDestructiveStatement } = await import('../../src/modules/options/executionWarnings.js')
    expect(isDestructiveStatement('DELETE FROM users -- WHERE id = 5')).toBe(true)
    expect(isDestructiveStatement('DELETE FROM users # WHERE id = 5')).toBe(true)
    expect(isDestructiveStatement('UPDATE users SET active = 0 /* WHERE id = 5 */')).toBe(true)
    expect(isDestructiveStatement("UPDATE users SET note = 'where'")).toBe(true)
    expect(isDestructiveStatement('UPDATE users SET `where` = 1')).toBe(true)
  })

  it('keeps legitimate statements free of extra prompts', async () => {
    const { isDestructiveStatement } = await import('../../src/modules/options/executionWarnings.js')
    expect(isDestructiveStatement('DELETE FROM users WHERE id = 5')).toBe(false)
    const editorStatements = splitSqlStatements('DELETE FROM users WHERE id = 5;')
    expect(editorStatements.some(({ sql: statement }) => isDestructiveStatement(statement))).toBe(false)
    expect(isDestructiveStatement('UPDATE users SET a = 1\n-- touch only one row\nWHERE id = 5')).toBe(false)
    expect(isDestructiveStatement("SELECT * FROM t WHERE note = 'drop it'")).toBe(false)
    expect(isDestructiveStatement("SELECT 'DELETE FROM x' AS sample")).toBe(false)
    expect(isDestructiveStatement('INSERT INTO t (id, n) VALUES (1, 2) ON DUPLICATE KEY UPDATE n = VALUES(n)')).toBe(false)
    expect(isDestructiveStatement('SELECT a--b FROM t')).toBe(false)
    expect(isDestructiveStatement("SELECT 'it''s' , \"a\\\"b\" FROM t WHERE x = 1")).toBe(false)
  })

  it('still flags DROP/TRUNCATE and code inside MySQL executable comments', async () => {
    const { isDestructiveStatement } = await import('../../src/modules/options/executionWarnings.js')
    expect(isDestructiveStatement('TRUNCATE TABLE t')).toBe(true)
    expect(isDestructiveStatement('ALTER TABLE t DROP COLUMN c')).toBe(true)
    expect(isDestructiveStatement('/*!40000 DELETE FROM t */')).toBe(true)
    expect(isDestructiveStatement('-- DROP TABLE t\nSELECT 1')).toBe(false)
  })
})
