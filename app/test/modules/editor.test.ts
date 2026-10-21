import { describe, expect, it, vi } from 'vitest'
import { buildSqlSuggestions } from '../../src/modules/editor/completion.js'
import { formatSql } from '../../src/modules/editor/formatter.js'
import { builtInFormatProfiles, formatProfileNames } from '../../src/modules/editor/formatProfiles.js'
import { EditorMetadataCache } from '../../src/modules/editor/metadataCache.js'
import { sqlSnippets } from '../../src/modules/editor/snippets.js'
import type { EditorMetadata } from '../../src/shared/contracts/editor.js'

const metadata: EditorMetadata = {
  database: 'shop', databases: ['shop', 'analytics'],
  objects: [
    { name: 'customers', kind: 'table', columns: [{ name: 'id', type: 'int' }, { name: 'email', type: 'varchar(120)' }] },
    { name: 'order_view', kind: 'view', columns: [{ name: 'order_id', type: 'bigint' }] }
  ],
  routines: [{ name: 'rebuild_index', kind: 'procedure' }, { name: 'normalize_email', kind: 'function' }]
}

describe('SQL editor features', () => {
  it('suggests alias columns, tables, routines, databases, keywords, and original snippets', () => {
    expect(buildSqlSuggestions('SELECT c.', 9, metadata).map((item) => item.label)).toEqual([])
    const alias = buildSqlSuggestions('SELECT c. FROM customers AS c', 9, metadata)
    expect(alias.map((item) => item.label)).toContain('email')
    expect(buildSqlSuggestions('SELECT * FROM cust', 21, metadata)[0]?.label).toBe('customers')
    expect(buildSqlSuggestions('CALL reb', 8, metadata)[0]?.label).toBe('rebuild_index')
    expect(buildSqlSuggestions('SELECT sel', 10, metadata).some((item) => item.kind === 'snippet' && item.label === 'Select rows')).toBe(true)
    expect(buildSqlSuggestions('SELECT shop.', 12, metadata).map((item) => item.label)).toContain('customers')
  })

  it('provides at least 35 unique custom snippets', () => {
    expect(sqlSnippets.length).toBeGreaterThanOrEqual(35)
    expect(new Set(sqlSnippets.map((item) => item.prefix)).size).toBe(sqlSnippets.length)
    expect(sqlSnippets.every((item) => item.body.length > 0)).toBe(true)
  })

  it('formats clauses and preserves quoted strings and comments', () => {
    expect(formatSql("select id,name from customers where name='a  b' and id>2; -- keep  this"))
      .toBe("SELECT id,\n  name\nFROM customers\nWHERE name = 'a  b'\n  AND id > 2;\n-- keep  this")
  })

  it('keeps noformat regions unchanged and exposes the nine named formatting profiles', () => {
    const sql = 'select id from users;\n-- noformat\n  select   x  from  y;\n-- endnoformat\nselect n from notes;'
    const output = formatSql(sql)
    expect(output).toContain('-- noformat\n  select   x  from  y;\n-- endnoformat')
    expect(output).toContain('SELECT id\nFROM users;')
    expect(output).toContain('SELECT n\nFROM notes;')
    expect(builtInFormatProfiles.map((profile) => profile.name)).toEqual(formatProfileNames)
    expect(formatSql('select a,b from t;', { profile: builtInFormatProfiles.find((profile) => profile.name === 'Extended') })).toContain('SELECT')
  })

  it('caches metadata, deduplicates loads, expires, and invalidates by connection/database', async () => {
    let now = 100
    const cache = new EditorMetadataCache(20, () => now)
    const load = vi.fn(async () => metadata)
    const [first, second] = await Promise.all([
      cache.get('c1', 'shop', load), cache.get('c1', 'shop', load)
    ])
    expect(first).toBe(second)
    expect(load).toHaveBeenCalledOnce()
    await cache.get('c1', 'shop', load)
    expect(load).toHaveBeenCalledOnce()
    now = 121
    await cache.get('c1', 'shop', load)
    expect(load).toHaveBeenCalledTimes(2)
    cache.invalidate('c1', 'shop')
    await cache.get('c1', 'shop', load)
    expect(load).toHaveBeenCalledTimes(3)
  })
})
