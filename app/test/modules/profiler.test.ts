import { describe, expect, it, vi } from 'vitest'
import { executeProfiledQuery, explainQuery, normalizeQuery, parseExplain, ProfilerHistory } from '../../src/modules/profiler/index.js'
import type { SqlClient } from '../../src/modules/sql.js'

function client(overrides: Partial<SqlClient> = {}): SqlClient {
  return { query: vi.fn(async () => []), execute: vi.fn(async () => undefined), ...overrides }
}

describe('query profiler', () => {
  it('parses MySQL JSON explain into a tree with costs, rows, and keys', () => {
    const plan = parseExplain([{ EXPLAIN: JSON.stringify({ query_block: { nested_loop: [{ table: { table_name: 'parent', access_type: 'ALL', rows_examined_per_scan: 10, possible_keys: ['PRIMARY'], cost_info: { query_cost: '3.5' } } }, { table: { table_name: 'child', access_type: 'ref', key: 'fk_parent', rows_examined_per_scan: 2 } }] } }) }])
    expect(plan.roots[0].operation).toBe('Query block')
    expect(plan.roots[0].children[0].table).toBe('parent')
    expect(plan.roots[0].children[0].cost).toBe(3.5)
    expect(plan.roots[0].children[0].rows).toBe(10)
    expect(plan.roots[0].children[1].key).toBe('fk_parent')
  })

  it('parses EXPLAIN TREE indentation and rejects unconfirmed ANALYZE', async () => {
    const plan = parseExplain([{ EXPLAIN: '-> Nested loop inner join  (cost=2.10 rows=4)\n    -> Table scan on p  (cost=1.00 rows=2)\n    -> Index lookup on c using fk_p (p_id=p.id)  (cost=0.55 rows=2)' }], 'TREE')
    expect(plan.roots[0].children).toHaveLength(2)
    const query = vi.fn(async () => [{ EXPLAIN: '{}' }])
    await expect(explainQuery(client({ query }), 'SELECT 1', 'ANALYZE')).rejects.toThrow('confirmação')
    await expect(explainQuery(client({ query }), 'DELETE FROM t', 'ANALYZE', { confirmAnalyze: true })).rejects.toThrow('leitura')
    await expect(explainQuery(client({ query }), 'WITH c AS (SELECT 1) DELETE FROM t', 'ANALYZE', { confirmAnalyze: true })).rejects.toThrow('leitura')
    expect(query).not.toHaveBeenCalled()
  })

  it('uses MariaDB ANALYZE FORMAT=JSON after explicit confirmation', async () => {
    const query = vi.fn(async () => [{ ANALYZE: JSON.stringify({ query_block: { message: 'Select 1' } }) }])
    await explainQuery(client({ query }), 'WITH c AS (SELECT 1) SELECT * FROM c', 'ANALYZE', { confirmAnalyze: true, serverFamily: 'mariadb' })
    expect(query).toHaveBeenCalledWith('ANALYZE FORMAT=JSON WITH c AS (SELECT 1) SELECT * FROM c')
  })

  it('normalizes query literals for comparable history entries', () => {
    const normalized = normalizeQuery("SELECT * FROM t WHERE id = 12 AND name = 'alice' -- note")
    expect(normalized).toBe('select * from t where id = ? and name = ?')
    const history = new ProfilerHistory(2)
    const result = (query: string) => ({ query, normalizedQuery: normalizeQuery(query), mode: 'JSON' as const, startedAt: new Date().toISOString(), durationMs: 1, plan: { format: 'JSON' as const, roots: [], warnings: [], raw: [] }, statusDelta: {}, events: [] })
    const first = result('SELECT * FROM t WHERE id=1')
    history.add(first)
    history.add(result('SELECT * FROM t WHERE id=2'))
    expect(history.comparableTo(first)).toHaveLength(1)
    expect(history.list()).toHaveLength(2)
  })

  it('captures execution duration, status deltas and statement results', async () => {
    let statusRead = 0
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('SHOW SESSION STATUS')) return [{ Variable: 'Questions', Value: statusRead++ === 0 ? '10' : '13' }]
      throw new Error('performance schema unavailable')
    })
    const executeQuery = vi.fn(async () => [{ value: 1 }])
    const result = await executeProfiledQuery(client({ query }), 'SELECT 1', executeQuery)
    expect(result.result).toEqual([{ value: 1 }])
    expect(result.statusDelta).toEqual({ Questions: 3 })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(executeQuery).toHaveBeenCalledOnce()
  })
})
