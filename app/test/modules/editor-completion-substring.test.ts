import { describe, expect, it } from 'vitest'
import { applyKeywordCaseAtOffset, buildSqlSuggestions, expandSnippetLiterals } from '../../src/modules/editor/completion.js'
import type { EditorMetadata } from '../../src/shared/contracts/editor.js'

const metadata: EditorMetadata = {
  database: 'sales', databases: ['sales'], routines: [],
  objects: [{ name: 'customers', kind: 'table', columns: [{ name: 'customer_id', type: 'int' }, { name: 'display_name', type: 'varchar(80)' }] }]
}

describe('SQL completion substring matching', () => {
  it('expands predefined and user-defined snippet literals', () => {
    expect(expandSnippetLiterals('SELECT $DATE$, $USER$, $DB$, $x$, $CARET$', 'my_db')).toMatch(/SELECT \d{4}-\d{2}-\d{2}, CURRENT_USER\(\), my_db, \$\{1:x\}, \$0/)
  })
  it('matches object names from the middle of a token and carries schema details', () => {
    const suggestions = buildSqlSuggestions('SELECT * FROM tom', 18, metadata)
    expect(suggestions).toContainEqual(expect.objectContaining({ label: 'customers', schema: 'sales', kind: 'table' }))
  })
  it('matches qualified columns by substring', () => {
    const suggestions = buildSqlSuggestions('SELECT c.name FROM customers c WHERE c.ame', 43, metadata)
    expect(suggestions).toContainEqual(expect.objectContaining({ label: 'display_name', kind: 'column', schema: 'sales' }))
  })
})

describe('SQL keyword case option', () => {
  it('changes completed keywords while preserving adjacent SQL', () => {
    expect(applyKeywordCaseAtOffset('select * from t', 6, 'upper')).toBe('SELECT * from t')
    expect(applyKeywordCaseAtOffset('SELECT * FROM t', 6, 'lower')).toBe('select * FROM t')
    expect(applyKeywordCaseAtOffset('select * from t', 6, 'as-typed')).toBe('select * from t')
  })
  it('uppercases keywords as they are typed without touching identifiers, strings, or comments', () => {
    const type = (source: string): string => {
      let sql = ''
      for (const char of source) {
        sql += char
        sql = applyKeywordCaseAtOffset(sql, sql.length, 'upper')
      }
      return sql
    }
    expect(type('select * from customers limit 50;')).toBe('SELECT * FROM customers LIMIT 50;')
    expect(type("select 'select', `select`, customers -- select\nfrom customers /* select */;"))
      .toBe("SELECT 'select', `select`, customers -- select\nFROM customers /* select */;")
  })
})
