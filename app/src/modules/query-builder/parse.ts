import type { QueryBuilderModel, QuerySelection } from './types.js'

function unquote(name: string): string { return name.replace(/^`|`$/g, '').replace(/``/g, '`') }

export function parseQuery(sql: string, database = ''): { model?: QueryBuilderModel; error?: string } {
  if (sql.includes(';') && sql.replace(/;\s*$/, '').includes(';')) return { error: "Query Builder doesn't support building more than one statement in a script." }
  const statement = sql.trim().replace(/;\s*$/, '')
  if (!/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(statement)) return { error: 'Only SELECT, INSERT, UPDATE or DELETE statement supported in Query Builder.' }
  if (!/^SELECT\b/i.test(statement)) return parseDml(statement, database)
  const match = /^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+([`\w.]+)(?:\s+(?:AS\s+)?(`?\w+`?))?(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+HAVING\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i.exec(statement)
  if (!match) return { error: 'SQL could not be represented visually.' }
  const from = match[3].replace(/`/g, '').split('.')
  const name = from.at(-1) ?? ''
  const db = from.length > 1 ? from.at(-2)! : database
  const aliasCandidate = match[4] ?? name
  const alias = /^(WHERE|ORDER|LIMIT|GROUP|HAVING)$/i.test(aliasCandidate) ? name : unquote(aliasCandidate)
  let selections: QuerySelection[]
  let conditions: QueryBuilderModel['conditions']
  try {
    const projections = splitComma(match[2])
    selections = projections.map((projection) => {
      const aggregateMatch = /^(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?(?:([`\w]+)\.)?([`\w*]+)\s*\)(?:\s+AS\s+(`?\w+`?))?$/i.exec(projection.trim())
      if (aggregateMatch) return { source: { table: unquote(aggregateMatch[3] ?? alias), column: unquote(aggregateMatch[4]) }, alias: aggregateMatch[5] ? unquote(aggregateMatch[5]) : undefined, aggregate: aggregateMatch[2] ? 'COUNT DISTINCT' as const : aggregateMatch[1].toUpperCase() as QuerySelection['aggregate'], included: true }
      const columnMatch = /^(?:([`\w]+)\.)?([`\w*]+)(?:\s+AS\s+(`?\w+`?))?$/i.exec(projection.trim())
      if (!columnMatch) throw new Error('SQL could not be represented visually.')
      return { source: { table: unquote(columnMatch[1] ?? alias), column: unquote(columnMatch[2]) }, alias: columnMatch[3] ? unquote(columnMatch[3]) : undefined, included: true }
    })
    conditions = match[5] ? parseConditions(match[5], alias) : []
    if (match[7]) conditions.push(...parseConditions(match[7], alias).map((condition) => ({ ...condition, having: true })))
  } catch (error) { return { error: error instanceof Error ? error.message : 'SQL could not be represented visually.' } }
  for (const part of match[8] ? splitComma(match[8]) : []) {
    const order = /^(?:([`\w]+)\.)?([`\w]+)(?:\s+(ASC|DESC))?$/i.exec(part.trim())
    if (!order) return { error: 'SQL could not be represented visually.' }
    const selection = selections.find((item) => item.source.column === unquote(order[2]) && (!order[1] || item.source.table === unquote(order[1])))
    if (selection) selection.sort = (order[3]?.toUpperCase() as 'ASC' | 'DESC') ?? 'ASC'
    else selections.push({ source: { table: unquote(order[1] ?? alias), column: unquote(order[2]) }, included: false, sort: (order[3]?.toUpperCase() as 'ASC' | 'DESC') ?? 'ASC' })
  }
  const groups = match[6] ? splitComma(match[6]).map((item) => item.trim()) : []
  for (const group of groups) {
    const column = /^(?:([`\w]+)\.)?([`\w]+)$/.exec(group)
    if (!column) return { error: 'SQL could not be represented visually.' }
    const selection = selections.find((item) => item.source.column === unquote(column[2]) && (!column[1] || item.source.table === unquote(column[1])))
    if (selection) selection.group = true
    else selections.push({ source: { table: unquote(column[1] ?? alias), column: unquote(column[2]) }, included: false, group: true })
  }
  return { model: { statement: 'SELECT', tables: [{ name, database: db, alias, columns: [...new Set(selections.map((item) => item.source.column))].map((column) => ({ name: column, type: 'unknown' })), foreignKeys: [] }], joins: [], selections, conditions, distinct: Boolean(match[1]), limit: match[9] ? Number(match[9]) : undefined } }
}

function parseDml(statement: string, database: string): { model?: QueryBuilderModel; error?: string } {
  const insert = /^INSERT\s+INTO\s+([`\w.]+)\s*\((.+)\)\s*VALUES\s*\((.+)\)$/i.exec(statement)
  if (insert) {
    const parts = insert[1].replace(/`/g, '').split('.'); const name = parts.at(-1) ?? ''; const db = parts.at(-2) ?? database
    const columns = splitComma(insert[2]).map((column) => unquote(column.trim())); const values = splitComma(insert[3]).map(parseLiteral)
    if (columns.length !== values.length) return { error: 'SQL could not be represented visually.' }
    return { model: { statement: 'INSERT', tables: [{ name, database: db, alias: name, columns: columns.map((column) => ({ name: column, type: 'unknown' })), foreignKeys: [] }], joins: [], selections: [], conditions: [], assignments: columns.map((column, index) => ({ column: { table: name, column }, value: values[index] })) } }
  }
  const update = /^UPDATE\s+([`\w.]+)(?:\s+(?:AS\s+)?(`?\w+`?))?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i.exec(statement)
  const remove = /^DELETE\s+FROM\s+([`\w.]+)(?:\s+(?:AS\s+)?(`?\w+`?))?(?:\s+WHERE\s+(.+))?$/i.exec(statement)
  const match = update ?? remove
  if (!match) return { error: 'SQL could not be represented visually.' }
  const parts = match[1].replace(/`/g, '').split('.'); const name = parts.at(-1) ?? ''; const db = parts.at(-2) ?? database
  const alias = match[2] ? unquote(match[2]) : name
  try {
    const assignments = update ? splitComma(match[3]).map((item) => {
      const assignment = /^([`\w]+)\s*=\s*(.+)$/.exec(item)
      if (!assignment) throw new Error('SQL could not be represented visually.')
      return { column: { table: alias, column: unquote(assignment[1]) }, value: parseLiteral(assignment[2]) }
    }) : []
    const where = update ? match[4] : match[3]
    const conditions = where ? parseConditions(where, alias) : []
    const columns = [...new Set([...assignments.map((item) => item.column.column), ...conditions.map((item) => item.column.column)])].map((column) => ({ name: column, type: 'unknown' }))
    return { model: { statement: update ? 'UPDATE' : 'DELETE', tables: [{ name, database: db, alias, columns, foreignKeys: [] }], joins: [], selections: [], conditions, assignments } }
  } catch (error) { return { error: error instanceof Error ? error.message : 'SQL could not be represented visually.' } }
}

function parseLiteral(value: string): unknown {
  const raw = value.trim()
  if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'")
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw)
  if (/^NULL$/i.test(raw)) return null
  if (/^(TRUE|FALSE)$/i.test(raw)) return /^TRUE$/i.test(raw)
  throw new Error('SQL could not be represented visually.')
}

function splitComma(input: string): string[] {
  const values: string[] = []; let start = 0; let depth = 0; let quote = ''
  for (let index = 0; index < input.length; index++) {
    const character = input[index]
    if (quote) { if (character === quote) { if (input[index + 1] === quote) index++; else quote = '' } }
    else if (character === '`' || character === '"' || character === "'") quote = character
    else if (character === '(') depth++
    else if (character === ')') depth--
    else if (character === ',' && depth === 0) { values.push(input.slice(start, index).trim()); start = index + 1 }
  }
  if (input.slice(start).trim()) values.push(input.slice(start).trim())
  return values
}

function parseConditions(input: string, alias: string): QueryBuilderModel['conditions'] {
  const parts = input.split(/\s+(AND|OR)\s+/i); const conditions: QueryBuilderModel['conditions'] = []
  for (let index = 0; index < parts.length; index += 2) {
    const match = /^(?:([`\w]+)\.)?([`\w]+)\s*(=|<>|>=|<=|>|<|LIKE|NOT LIKE)\s*(.+)$/i.exec(parts[index].trim())
    if (!match) throw new Error('SQL could not be represented visually.')
    const raw = match[4].trim(); let value: unknown = raw
    if (/^'.*'$/.test(raw)) value = raw.slice(1, -1).replace(/''/g, "'")
    else if (/^-?\d+(?:\.\d+)?$/.test(raw)) value = Number(raw)
    else if (/^NULL$/i.test(raw)) value = null
    else if (raw.includes('.')) { // column-to-column comparisons are kept as a visual limitation
      throw new Error('SQL could not be represented visually.')
    }
    conditions.push({ column: { table: unquote(match[1] ?? alias), column: unquote(match[2]) }, operator: match[3].toUpperCase() as QueryBuilderModel['conditions'][number]['operator'], value, connector: index ? parts[index - 1].toUpperCase() as 'AND' | 'OR' : undefined })
  }
  return conditions
}
