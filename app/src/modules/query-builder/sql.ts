import type { BuiltQuery, ColumnRef, QueryBuilderModel, QueryCondition, QuerySelection } from './types.js'

export function quoteIdentifier(name: string): string {
  if (!name || name.includes('\0')) throw new Error('Identifier cannot be empty.')
  return `\`${name.replace(/`/g, '``')}\``
}

function qcol(ref: ColumnRef, model: QueryBuilderModel): string {
  const table = model.tables.find((item) => item.alias === ref.table || item.name === ref.table)
  if (!table) throw new Error(`Unknown table alias: ${ref.table}`)
  if (!table.columns.some((column) => column.name === ref.column) && ref.column !== '*') throw new Error(`Unknown column: ${ref.table}.${ref.column}`)
  return ref.column === '*' ? `${quoteIdentifier(table.alias || table.name)}.*` : `${quoteIdentifier(table.alias || table.name)}.${quoteIdentifier(ref.column)}`
}

function conditionSql(condition: QueryCondition, model: QueryBuilderModel, parameters: unknown[]): string {
  const column = qcol(condition.column, model)
  if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') return `${column} ${condition.operator}`
  const operator = condition.operator
  if (operator === 'IN' || operator === 'NOT IN') {
    if (!Array.isArray(condition.value) || condition.value.length === 0) throw new Error(`${operator} needs at least one value.`)
    parameters.push(...condition.value)
    return `${column} ${operator} (${condition.value.map(() => '?').join(', ')})`
  }
  if (operator === 'BETWEEN') {
    parameters.push(condition.value, condition.secondValue)
    return `${column} BETWEEN ? AND ?`
  }
  if (!['=', '<>', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE'].includes(operator)) throw new Error(`Unsupported operator ${operator}.`)
  parameters.push(condition.value)
  return `${column} ${operator} ?`
}

function conditionsSql(conditions: QueryCondition[], model: QueryBuilderModel, parameters: unknown[]): string {
  return conditions.map((condition, index) => `${index ? `${condition.connector ?? 'AND'} ` : ''}${conditionSql(condition, model, parameters)}`).join(' ')
}

function selectionSql(selection: QuerySelection, model: QueryBuilderModel): string {
  const column = qcol(selection.source, model)
  const aggregate = selection.aggregate ?? 'NONE'
  if (selection.source.column === '*' && aggregate !== 'NONE' && aggregate !== 'COUNT') throw new Error('Asterisk cannot be used in subqueries without a function.')
  const expression = aggregate === 'NONE' ? column : selection.source.column === '*' ? 'COUNT(*)' : aggregate === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${column})` : `${aggregate}(${column})`
  return `${expression}${selection.alias ? ` AS ${quoteIdentifier(selection.alias)}` : ''}`
}

function tableSql(table: QueryBuilderModel['tables'][number]): string {
  return `${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)} AS ${quoteIdentifier(table.alias || table.name)}`
}

function joinsSql(model: QueryBuilderModel): string {
  if (!model.tables.length) throw new Error('Add at least one table.')
  // The FK-owning table is the natural FROM root, matching the direction of the
  // relationship shown in the diagram and keeping the child-to-parent join readable.
  const root = model.tables.find((table) => table.foreignKeys.some((key) => model.tables.some((candidate) => candidate.name === key.referencedTable))) ?? model.tables[0]
  const joined = new Set([root.alias || root.name])
  let sql = tableSql(root)
  const remaining = model.tables.filter((table) => table !== root)
  while (remaining.length) {
    const next = remaining.find((table) => model.joins.some((join) => (join.leftTable === table.alias || join.leftTable === table.name) && joined.has(join.rightTable) || (join.rightTable === table.alias || join.rightTable === table.name) && joined.has(join.leftTable)))
    if (!next) {
      const table = remaining.shift()!
      sql += `\n  CROSS JOIN ${tableSql(table)}`
      joined.add(table.alias || table.name)
      continue
    }
    remaining.splice(remaining.indexOf(next), 1)
    const join = model.joins.find((item) => (item.leftTable === next.alias || item.leftTable === next.name) && joined.has(item.rightTable) || (item.rightTable === next.alias || item.rightTable === next.name) && joined.has(item.leftTable))!
    if (join.type === 'FULL') throw new Error('FULL JOIN is not directly supported by MySQL; use a UNION query in Text view.')
    const keyword = join.type === 'CROSS' ? 'CROSS JOIN' : `${join.type} JOIN`
    sql += `\n  ${keyword} ${tableSql(next)}`
    if (join.type !== 'CROSS') {
      if (!join.conditions.length) throw new Error('Join needs at least one condition.')
      sql += `\n    ON ${join.conditions.map((condition, index) => `${index ? `${condition.connector ?? 'AND'} ` : ''}${qcol(condition.left, model)} ${condition.operator} ${qcol(condition.right, model)}`).join(' ')}`
    }
    joined.add(next.alias || next.name)
  }
  return sql
}

export function buildQuery(model: QueryBuilderModel): BuiltQuery {
  const parameters: unknown[] = []
  const conditions = (model.conditions ?? []).filter((condition) => !condition.having)
  const having = (model.conditions ?? []).filter((condition) => condition.having)
  if (!model.tables.length) throw new Error('Add at least one table.')
  if (model.statement === 'SELECT') {
    const columns = model.selections.filter((selection) => selection.included)
    if (!columns.length) throw new Error('Select at least one output column.')
    let sql = `SELECT${model.distinct ? ' DISTINCT' : ''}\n${columns.map((selection) => `  ${selectionSql(selection, model)}`).join(',\n')}\nFROM ${joinsSql(model)}`
    if (conditions.length) sql += `\nWHERE ${conditionsSql(conditions, model, parameters)}`
    const groups = model.selections.filter((selection) => selection.included && selection.group).map((selection) => qcol(selection.source, model))
    if (groups.length) sql += `\nGROUP BY ${groups.join(', ')}`
    if (having.length) sql += `\nHAVING ${conditionsSql(having, model, parameters)}`
    const orders = columns.filter((selection) => selection.sort).map((selection) => `${selectionSql(selection, model)} ${selection.sort}`)
    if (orders.length) sql += `\nORDER BY ${orders.join(', ')}`
    if (model.limit !== undefined) {
      if (!Number.isInteger(model.limit) || model.limit < 0) throw new Error('Limit must be a non-negative integer.')
      sql += `\nLIMIT ${model.limit}`
    }
    return { sql, parameters }
  }
  if (model.statement === 'INSERT') {
    const table = model.tables[0]
    const assignments = model.assignments ?? []
    if (!assignments.length) throw new Error('INSERT needs at least one value.')
    parameters.push(...assignments.map((assignment) => assignment.value))
    return { sql: `INSERT INTO ${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)} (${assignments.map((item) => quoteIdentifier(item.column.column)).join(', ')}) VALUES (${assignments.map(() => '?').join(', ')})`, parameters }
  }
  const table = model.tables[0]
  const tableRef = quoteIdentifier(table.database) + '.' + quoteIdentifier(table.name)
  const whereParameters: unknown[] = []
  const where = conditions.length ? ` WHERE ${conditionsSql(conditions, model, whereParameters)}` : ''
  if (model.statement === 'DELETE') return { sql: `DELETE FROM ${tableRef}${where}`, parameters: whereParameters }
  const assignments = model.assignments ?? []
  if (!assignments.length) throw new Error('UPDATE needs at least one assignment.')
  const set = assignments.map((assignment) => `${quoteIdentifier(assignment.column.column)} = ?`).join(', ')
  parameters.push(...assignments.map((assignment) => assignment.value), ...whereParameters)
  return { sql: `UPDATE ${tableRef} SET ${set}${where}`, parameters }
}
