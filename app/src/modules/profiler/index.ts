import type { SqlClient, SqlRow } from '../sql.js'
import { compareStatus, getServerStatus } from '../sessions/index.js'

export type ExplainMode = 'JSON' | 'TREE' | 'ANALYZE'
export interface ExplainNode { operation: string; table?: string; accessType?: string; key?: string; possibleKeys?: string[]; rows?: number; filteredPercent?: number; cost?: number; actualTimeMs?: number; actualRows?: number; warnings?: string[]; children: ExplainNode[] }
export interface ExplainPlan { format: ExplainMode; roots: ExplainNode[]; warnings: string[]; raw: unknown }
export interface StatementEvent { eventId: number; sqlText?: string; timerWaitPs?: number; rowsExamined?: number; rowsSent?: number; errors?: number; warnings?: number; digest?: string }
export interface ProfileResult { query: string; normalizedQuery: string; mode: ExplainMode; startedAt: string; durationMs: number; plan: ExplainPlan; statusDelta: Record<string, number>; events: StatementEvent[] }
export interface ExecutionProfile<T> { query: string; normalizedQuery: string; startedAt: string; durationMs: number; statusDelta: Record<string, number>; events: StatementEvent[]; result: T }
export interface ProfileOptions { mode?: ExplainMode; confirmAnalyze?: true; eventLimit?: number; serverFamily?: 'mysql' | 'mariadb' }
export interface ProfileRunComparison {
  durationDeltaMs: number
  eventCountDelta: number
  planChanged: boolean
  statusCounters: Array<{ name: string; first: number; second: number; delta: number }>
}

export function compareProfileRuns(first: ProfileResult, second: ProfileResult): ProfileRunComparison {
  const firstPlan = JSON.stringify({ format: first.plan.format, roots: planShape(first.plan.roots) })
  const secondPlan = JSON.stringify({ format: second.plan.format, roots: planShape(second.plan.roots) })
  const names = [...new Set([...Object.keys(first.statusDelta), ...Object.keys(second.statusDelta)])].sort((a, b) => a.localeCompare(b))
  return {
    durationDeltaMs: second.durationMs - first.durationMs,
    eventCountDelta: second.events.length - first.events.length,
    planChanged: firstPlan !== secondPlan,
    statusCounters: names.map((name) => {
      const firstValue = first.statusDelta[name] ?? 0
      const secondValue = second.statusDelta[name] ?? 0
      return { name, first: firstValue, second: secondValue, delta: secondValue - firstValue }
    })
  }
}

function planShape(nodes: ExplainNode[]): unknown[] {
  return nodes.map((node) => ({ operation: node.operation, table: node.table, accessType: node.accessType, key: node.key, children: planShape(node.children) }))
}

export async function explainQuery(client: SqlClient, query: string, mode: ExplainMode = 'JSON', options: { confirmAnalyze?: true; serverFamily?: 'mysql' | 'mariadb' } = {}): Promise<ExplainPlan> {
  const trimmed = query.trim().replace(/;+$/, '')
  if (!trimmed) throw new Error('The query is empty.')
  if (mode === 'ANALYZE') {
    if (options.confirmAnalyze !== true) throw new Error('EXPLAIN ANALYZE runs the query and requires explicit confirmation.')
    if (!isReadOnlyStatement(trimmed)) throw new Error('EXPLAIN ANALYZE is limited to read-only queries.')
  }
  const family = options.serverFamily ?? 'mysql'
  const prefix = mode === 'JSON' ? 'EXPLAIN FORMAT=JSON' : mode === 'TREE' ? 'EXPLAIN FORMAT=TREE' : family === 'mariadb' ? 'ANALYZE FORMAT=JSON' : 'EXPLAIN ANALYZE'
  const rows = await client.query(`${prefix} ${trimmed}`)
  return parseExplain(rows, mode)
}

export async function profileQuery(client: SqlClient, query: string, options: ProfileOptions = {}): Promise<ProfileResult> {
  const mode = options.mode ?? 'JSON'
  const startedAt = new Date().toISOString()
  const start = performance.now()
  const before = await getServerStatus(client, 'SESSION')
  const plan = await explainQuery(client, query, mode, { confirmAnalyze: options.confirmAnalyze, serverFamily: options.serverFamily })
  const events = await readRecentStatementEvents(client, options.eventLimit ?? 10)
  const after = await getServerStatus(client, 'SESSION')
  const durationMs = performance.now() - start
  return { query, normalizedQuery: normalizeQuery(query), mode, startedAt, durationMs, plan, statusDelta: compareStatus(before, after), events }
}

export async function executeProfiledQuery<T>(client: SqlClient, query: string, executeQuery: () => Promise<T>, eventLimit = 10): Promise<ExecutionProfile<T>> {
  const startedAt = new Date().toISOString()
  const start = performance.now()
  const before = await getServerStatus(client, 'SESSION')
  const result = await executeQuery()
  const events = await readRecentStatementEvents(client, eventLimit)
  const after = await getServerStatus(client, 'SESSION')
  return { query, normalizedQuery: normalizeQuery(query), startedAt, durationMs: performance.now() - start, statusDelta: compareStatus(before, after), events, result }
}

export function parseExplain(rows: SqlRow[], format: ExplainMode = 'JSON'): ExplainPlan {
  const raw = rows
  const first = rows[0]
  const text = first ? String(Object.values(first)[0] ?? '') : ''
  if (format === 'TREE' || format === 'ANALYZE' && !looksLikeJson(text)) {
    const roots = parseTreeText(text)
    return { format, roots, warnings: allNodeWarnings(roots), raw }
  }
  let data: unknown
  try { data = typeof text === 'string' ? JSON.parse(text) : text }
  catch { return { format, roots: [{ operation: text || 'Empty plan', children: [] }], warnings: ['The server returned a plan in an unrecognized format.'], raw } }
  const warnings: string[] = []
  const roots = collectNodes(data, warnings)
  warnings.push(...allNodeWarnings(roots))
  if (!roots.length) warnings.push('The plan contains no recognized nodes.')
  return { format, roots, warnings, raw }
}

export async function readRecentStatementEvents(client: SqlClient, limit = 10): Promise<StatementEvent[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('The event limit must be between 1 and 1000.')
  try {
    const rows = await client.query('SELECT EVENT_ID AS eventId, SQL_TEXT AS sqlText, TIMER_WAIT AS timerWaitPs, ROWS_EXAMINED AS rowsExamined, ROWS_SENT AS rowsSent, ERRORS AS errors, WARNINGS AS warnings, DIGEST AS digest FROM performance_schema.events_statements_history_long WHERE THREAD_ID = (SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID = CONNECTION_ID()) ORDER BY EVENT_ID DESC LIMIT ?', [limit])
    return rows.filter((row) => !String(row.sqlText ?? '').toLowerCase().startsWith('select event_id as')).map((row) => ({ eventId: Number(row.eventId), sqlText: value(row.sqlText), timerWaitPs: number(row.timerWaitPs), rowsExamined: number(row.rowsExamined), rowsSent: number(row.rowsSent), errors: number(row.errors), warnings: number(row.warnings), digest: value(row.digest) }))
  } catch {
    try {
      const rows = await client.query(`SHOW PROFILES`)
      return rows.slice(-limit).reverse().map((row) => ({ eventId: Number(row.Query_ID ?? row.query_id), sqlText: value(row.Query ?? row.query), timerWaitPs: number(row.Duration ?? row.duration) === undefined ? undefined : Number(row.Duration ?? row.duration) * 1_000_000_000_000 }))
    } catch { return [] }
  }
}

export class ProfilerHistory {
  private readonly items: ProfileResult[] = []
  constructor(private readonly maxItems = 100) {
    if (!Number.isInteger(maxItems) || maxItems < 1) throw new Error('The history size must be a positive number.')
  }
  add(result: ProfileResult): void { this.items.unshift(result); this.items.length = Math.min(this.items.length, this.maxItems) }
  list(): readonly ProfileResult[] { return this.items }
  comparableTo(result: ProfileResult): ProfileResult[] { return this.items.filter((item) => item.normalizedQuery === result.normalizedQuery && item.mode === result.mode && item !== result) }
}

export function normalizeQuery(query: string): string {
  return query
    .replace(/'(?:''|\\.|[^'])*'|"(?:""|\\.|[^"])*"|--\s[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//g, (token) => token.startsWith("'") || token.startsWith('"') ? '?' : ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?').replace(/\s+/g, ' ').trim().replace(/;$/, '').toLowerCase()
}

function collectNodes(value: unknown, warnings: string[], parent?: ExplainNode): ExplainNode[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectNodes(item, warnings, parent))
  if (!value || typeof value !== 'object') return []
  const object = value as Record<string, unknown>
  if (object.query_block && typeof object.query_block === 'object') {
    const block = object.query_block as Record<string, unknown>
    const costInfo = block.cost_info as Record<string, unknown> | undefined
    const node: ExplainNode = { operation: 'Query block', rows: number(block.rows_examined_per_scan ?? block.rows_produced_per_join), cost: number(costInfo?.query_cost), children: [] }
    node.children.push(...collectNodes(block, warnings, node))
    return [node]
  }
  const current = parent
  const roots: ExplainNode[] = []
  for (const [key, child] of Object.entries(object)) {
    if (key === 'table' && child && typeof child === 'object') {
      const table = child as Record<string, unknown>
      const costInfo = table.cost_info as Record<string, unknown> | undefined
      const nodeWarnings = [] as string[]
      if (table.using_filesort === true) nodeWarnings.push('Using filesort')
      if (table.using_temporary_table === true) nodeWarnings.push('Using temporary table')
      const node: ExplainNode = {
        operation: `${string(table.access_type) ?? 'TABLE'}${table.table_name ? ` ${String(table.table_name)}` : ''}`,
        table: string(table.table_name), accessType: string(table.access_type), key: string(table.key),
        possibleKeys: Array.isArray(table.possible_keys) ? table.possible_keys.map(String) : undefined,
        rows: number(table.rows_examined_per_scan ?? table.rows), filteredPercent: number(table.filtered),
        cost: number(costInfo?.query_cost ?? costInfo?.read_cost), warnings: nodeWarnings.length ? nodeWarnings : undefined, children: []
      }
      if (current) current.children.push(node); else roots.push(node)
      for (const [nestedKey, nested] of Object.entries(table)) if (nestedKey !== 'cost_info') node.children.push(...collectNodes(nested, warnings))
    } else if (/warning/i.test(key)) warnings.push(...flattenStrings(child))
    else if (child && typeof child === 'object') {
      const nestedRoots = collectNodes(child, warnings, current)
      if (!current) roots.push(...nestedRoots)
    }
  }
  return roots
}

function parseTreeText(text: string): ExplainNode[] {
  const roots: ExplainNode[] = []
  const stack: Array<{ depth: number; node: ExplainNode }> = []
  for (const line of text.split('\n').filter((item) => item.trim())) {
    const depth = line.search(/\S/)
    const raw = line.trim().replace(/^->\s*/, '')
    const costMatch = /cost=([\d.]+)/i.exec(raw), rowsMatch = /rows=([\d.]+)/i.exec(raw), actualMatch = /actual time=([\d.]+)\.\.([\d.]+) rows=([\d.]+)/i.exec(raw)
    const warning = /using (?:filesort|temporary)|warning/i.test(raw) ? [raw] : undefined
    const node: ExplainNode = { operation: raw.replace(/\s*\(cost=.*$/i, '').replace(/\s*\(actual time=.*$/i, ''), rows: rowsMatch ? Number(rowsMatch[1]) : undefined, cost: costMatch ? Number(costMatch[1]) : undefined, actualTimeMs: actualMatch ? Number(actualMatch[2]) : undefined, actualRows: actualMatch ? Number(actualMatch[3]) : undefined, warnings: warning, children: [] }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parent = stack[stack.length - 1]?.node
    if (parent) parent.children.push(node); else roots.push(node)
    stack.push({ depth, node })
  }
  return roots
}

function looksLikeJson(value: string): boolean { return value.trim().startsWith('{') || value.trim().startsWith('[') }
function flattenStrings(value: unknown): string[] { return Array.isArray(value) ? value.flatMap(flattenStrings) : typeof value === 'string' ? [value] : [] }
function string(value: unknown): string | undefined { return value == null ? undefined : String(value) }
function value(input: unknown): string | undefined { return input == null ? undefined : String(input) }
function number(input: unknown): number | undefined { const result = Number(input); return input == null || !Number.isFinite(result) ? undefined : result }
function allNodeWarnings(nodes: ExplainNode[]): string[] { return nodes.flatMap((node) => [...(node.warnings ?? []), ...allNodeWarnings(node.children)]) }

function isReadOnlyStatement(query: string): boolean {
  if (/^SELECT\b/i.test(query)) return true
  if (!/^WITH\b/i.test(query)) return false
  let depth = 0
  let quote = ''
  for (let index = 0; index < query.length; index++) {
    const char = query[index]
    if (quote) {
      if (char === quote && query[index + 1] === quote) { index++; continue }
      if (char === quote && query[index - 1] !== '\\') quote = ''
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '(') { depth++; continue }
    if (char !== ')' || --depth !== 0) continue
    const remainder = query.slice(index + 1).trimStart()
    if (/^SELECT\b/i.test(remainder)) return true
    if (/^(?:,|AS\b)/i.test(remainder)) continue
    if (remainder) return false
  }
  return false
}
