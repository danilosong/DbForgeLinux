import { describe, expect, it, vi } from 'vitest'
import { compareProfileRuns, executeProfiledQuery, explainQuery, normalizeQuery, parseExplain, ProfilerHistory, type ProfileResult } from '../../src/modules/profiler/index.js'
import { layoutPlanDiagram, planCostHue } from '../../src/modules/profiler/planDiagram.js'
import { describeStatusVariable } from '../../src/modules/profiler/statusDescriptions.js'
import type { SqlClient } from '../../src/modules/sql.js'

function client(overrides: Partial<SqlClient> = {}): SqlClient {
  return { query: vi.fn(async () => []), execute: vi.fn(async () => undefined), ...overrides }
}

describe('query profiler', () => {
  it('lays out a two dimensional plan graph with row-count edges and relative cost colors', () => {
    const roots = [{ operation: 'Nested loop', cost: 9, children: [
      { operation: 'Table scan', table: 'orders', rows: 20, cost: 8, children: [] },
      { operation: 'Index lookup', table: 'customers', rows: 1, cost: 1, children: [] }
    ] }]
    const layout = layoutPlanDiagram(roots)
    expect(layout.nodes).toHaveLength(3)
    expect(layout.edges.map((edge) => edge.rows)).toEqual([20, 1])
    expect(layout.nodes.find((node) => node.node.operation === 'Nested loop')?.x).toBeLessThan(layout.nodes.find((node) => node.node.table === 'orders')!.x)
    expect(layout.width).toBeGreaterThan(layout.nodes.at(-1)!.x)
    expect(planCostHue(9, 9)).toBe(0)
    expect(planCostHue(0, 9)).toBe(120)
  })

  it('describes common server status counters in English', () => {
    expect(describeStatusVariable('Rows_examined')).toContain('read while evaluating')
    expect(describeStatusVariable('unknown_custom_counter')).toContain('scope depend')
  })
  it('compares selected runs by duration, events, session counters and structural plan shape', () => {
    const make = (overrides: Partial<ProfileResult> = {}): ProfileResult => ({
      query: 'SELECT * FROM items', normalizedQuery: 'select * from items', mode: 'JSON', startedAt: new Date().toISOString(),
      durationMs: 12, plan: { format: 'JSON', roots: [{ operation: 'Index lookup', table: 'items', key: 'PRIMARY', rows: 4, cost: 1, children: [] }], warnings: [], raw: [] },
      statusDelta: { Questions: 3, Rows_examined: 5 }, events: [{ eventId: 1 }, { eventId: 2 }], ...overrides
    })
    const first = make()
    const second = make({
      durationMs: 17,
      statusDelta: { Questions: 5, Rows_sent: 2 },
      events: [{ eventId: 3 }],
      plan: { format: 'JSON', roots: [{ operation: 'Table scan', table: 'items', rows: 20, cost: 8, children: [] }], warnings: [], raw: [] }
    })
    expect(compareProfileRuns(first, second)).toEqual({
      durationDeltaMs: 5, eventCountDelta: -1, planChanged: true,
      statusCounters: [
        { name: 'Questions', first: 3, second: 5, delta: 2 },
        { name: 'Rows_examined', first: 5, second: 0, delta: -5 },
        { name: 'Rows_sent', first: 0, second: 2, delta: 2 }
      ]
    })
    const sameShape = make({ durationMs: 15, plan: { ...first.plan, roots: [{ ...first.plan.roots[0]!, rows: 90, cost: 12 }] } })
    expect(compareProfileRuns(first, sameShape).planChanged).toBe(false)
  })

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
    await expect(explainQuery(client({ query }), 'SELECT 1', 'ANALYZE')).rejects.toThrow('requires explicit confirmation')
    await expect(explainQuery(client({ query }), 'DELETE FROM t', 'ANALYZE', { confirmAnalyze: true })).rejects.toThrow('limited to read-only queries')
    await expect(explainQuery(client({ query }), 'WITH c AS (SELECT 1) DELETE FROM t', 'ANALYZE', { confirmAnalyze: true })).rejects.toThrow('limited to read-only queries')
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
