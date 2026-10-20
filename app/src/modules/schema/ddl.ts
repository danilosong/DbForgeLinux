import type { ColumnModel, DatabaseModel, ForeignKeyModel, IndexModel, SchemaObject, TableModel } from './model.js'
import { qualifiedName, quoteIdentifier } from './sql.js'

const literal = (value: string): string => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
const defaultValue = (column: ColumnModel): string | null | undefined => {
  const value = column.default
  if (value == null || typeof value !== 'string' || /^'.*'$|^".*"$/.test(value) || /^(?:NULL|TRUE|FALSE|CURRENT_TIMESTAMP(?:\(\d+\))?|CURRENT_DATE|CURRENT_TIME|NOW\(\)|UUID\(\))$/i.test(value) || /^[-+]?\d+(?:\.\d+)?$/.test(value)) return value
  return /^(?:char|varchar|tinytext|text|mediumtext|longtext|enum|set|json|binary|varbinary|tinyblob|blob|mediumblob|longblob)/i.test(column.type) ? literal(value) : value
}
const col = (column: ColumnModel): string => {
  let sql = `${quoteIdentifier(column.name)} ${column.type}`
  if (column.charset) sql += ` CHARACTER SET ${quoteIdentifier(column.charset)}`
  if (column.collation) sql += ` COLLATE ${quoteIdentifier(column.collation)}`
  if (column.generated) sql += ` GENERATED ALWAYS AS (${column.generated})${column.generatedStorage ? ` ${column.generatedStorage}` : ''}`
  else if (column.autoIncrement) sql += ' AUTO_INCREMENT'
  sql += column.nullable ? ' NULL' : ' NOT NULL'
  const defaultSql = defaultValue(column)
  if (defaultSql !== undefined && defaultSql !== null) sql += ` DEFAULT ${defaultSql}`
  if (column.onUpdate) sql += ` ON UPDATE ${column.onUpdate}`
  if (column.comment) sql += ` COMMENT ${literal(column.comment)}`
  return sql
}
const index = (item: IndexModel): string => {
  const cols = item.columns.map((part) => `${part.expression ?? quoteIdentifier(part.name)}${part.prefixLength ? `(${part.prefixLength})` : ''}${part.order ? ` ${part.order}` : ''}`).join(', ')
  const type = item.kind === 'PRIMARY' ? 'PRIMARY KEY' : `${item.kind === 'INDEX' ? '' : `${item.kind} `}KEY ${quoteIdentifier(item.name)}`
  return `${type} (${cols})${item.comment ? ` COMMENT ${literal(item.comment)}` : ''}${item.visible === false ? ' INVISIBLE' : ''}`
}
const fk = (item: ForeignKeyModel, database: string): string => `CONSTRAINT ${quoteIdentifier(item.name)} FOREIGN KEY (${item.columns.map(quoteIdentifier).join(', ')}) REFERENCES ${qualifiedName(item.referencedDatabase ?? database, item.referencedTable)} (${item.referencedColumns.map(quoteIdentifier).join(', ')})${item.onDelete ? ` ON DELETE ${item.onDelete}` : ''}${item.onUpdate ? ` ON UPDATE ${item.onUpdate}` : ''}`

export function createTable(table: TableModel, database: string): string {
  const parts = table.columns.map(col)
  parts.push(...table.indexes.map(index), ...table.foreignKeys.map((item) => fk(item, database)))
  parts.push(...table.checks.map((item) => `CONSTRAINT ${quoteIdentifier(item.name)} CHECK (${item.expression})${item.enforced === false ? ' NOT ENFORCED' : ''}`))
  let sql = `CREATE TABLE ${qualifiedName(database, table.name)} (\n  ${parts.join(',\n  ')}\n)`
  if (table.engine) sql += ` ENGINE=${table.engine}`
  if (table.charset) sql += ` DEFAULT CHARACTER SET=${quoteIdentifier(table.charset)}`
  if (table.collation) sql += ` COLLATE=${quoteIdentifier(table.collation)}`
  if (table.comment) sql += ` COMMENT=${literal(table.comment)}`
  if (table.options) sql += Object.entries(table.options).map(([key, value]) => ` ${key}=${value}`).join('')
  if (table.partitioning) sql += ` ${partitionSql(table.partitioning)}`
  return `${sql};`
}

export function createObject(object: SchemaObject, database: string): string {
  if (object.createSql) return qualifyCreatedObject(object.createSql, object, database).trim().replace(/;?$/, ';')
  if (object.kind === 'table') return createTable(object as TableModel, database)
  if (object.kind === 'database') {
    const db = object as DatabaseModel
    return `CREATE DATABASE ${quoteIdentifier(db.name)}${db.charset ? ` DEFAULT CHARACTER SET=${quoteIdentifier(db.charset)}` : ''}${db.collation ? ` COLLATE=${quoteIdentifier(db.collation)}` : ''};`
  }
  const body = object as SchemaObject & { definition?: string }
  if (body.definition) return body.definition.trim().replace(/;?$/, ';')
  throw new Error(`Não há definição para ${object.kind} ${object.name}.`)
}

function qualifyCreatedObject(sql: string, object: SchemaObject, database: string): string {
  if (object.kind === 'database') return sql
  const keyword = object.kind === 'table' || object.kind === 'view' ? object.kind : object.kind
  const namePattern = /(`(?:``|[^`])+`|[A-Za-z_$][\w$]*)/
  const statementPattern = new RegExp(`\\b${keyword}\\s+${namePattern.source}`, 'i')
  return sql.replace(statementPattern, (match, currentName: string) => {
    const unquoted = currentName.startsWith('`') ? currentName.slice(1, -1).replaceAll('``', '`') : currentName
    return match.slice(0, match.length - currentName.length) + qualifiedName(database, unquoted || object.name)
  })
}

export function dropObject(object: SchemaObject, database: string): string {
  if (object.kind === 'database') return `DROP DATABASE ${quoteIdentifier(object.name)};`
  if (object.kind === 'table' || object.kind === 'view') return `DROP ${object.kind.toUpperCase()} ${qualifiedName(database, object.name)};`
  return `DROP ${object.kind.toUpperCase()} ${qualifiedName(database, object.name)};`
}

export function alterObject(before: SchemaObject, after: SchemaObject, database: string, includeDrops = false): string[] {
  if (before.kind !== after.kind || before.name !== after.name) throw new Error('ALTER exige objetos do mesmo tipo e nome.')
  if (before.kind === 'table' && after.kind === 'table') return diffTables(before as TableModel, after as TableModel, database, includeDrops)
  if (before.kind === 'view' && after.kind === 'view') {
    const definition = (after as import('./model.js').ViewModel).definition
    return [`CREATE OR REPLACE VIEW ${qualifiedName(database, after.name)} AS ${definition};`]
  }
  return [dropObject(before, database), createObject(after, database)]
}

function sameColumn(a: ColumnModel, b: ColumnModel): boolean { return col(a) === col(b) }
function sameIndex(a: IndexModel, b: IndexModel): boolean { return index(a) === index(b) }
function sameFk(a: ForeignKeyModel, b: ForeignKeyModel, database: string): boolean { return fk(a, database) === fk(b, database) }

export function diffTables(source: TableModel, target: TableModel, database: string, includeDrops = false): string[] {
  const statements: string[] = []
  const sourceColumns = new Map(source.columns.map((item) => [item.name, item]))
  const targetColumns = new Map(target.columns.map((item) => [item.name, item]))
  for (const column of target.columns) {
    const old = sourceColumns.get(column.name)
    if (!old) statements.push(`ADD COLUMN ${col(column)}`)
    else if (!sameColumn(old, column)) statements.push(`MODIFY COLUMN ${col(column)}`)
  }
  if (includeDrops) for (const column of source.columns) if (!targetColumns.has(column.name)) statements.push(`DROP COLUMN ${quoteIdentifier(column.name)}`)

  const sourceIndexes = new Map(source.indexes.map((item) => [item.name, item]))
  const targetIndexes = new Map(target.indexes.map((item) => [item.name, item]))
  for (const old of source.indexes) {
    const next = targetIndexes.get(old.name)
    if ((!next || !sameIndex(old, next)) && includeDrops) statements.push(old.kind === 'PRIMARY' ? 'DROP PRIMARY KEY' : `DROP INDEX ${quoteIdentifier(old.name)}`)
  }
  for (const item of target.indexes) {
    const old = sourceIndexes.get(item.name)
    if (!old || (includeDrops && !sameIndex(old, item))) statements.push(`ADD ${index(item)}`)
  }
  const sourceFks = new Map(source.foreignKeys.map((item) => [item.name, item]))
  const targetFks = new Map(target.foreignKeys.map((item) => [item.name, item]))
  for (const old of source.foreignKeys) {
    const next = targetFks.get(old.name)
    if ((!next || !sameFk(old, next, database)) && includeDrops) statements.push(`DROP FOREIGN KEY ${quoteIdentifier(old.name)}`)
  }
  for (const item of target.foreignKeys) {
    const old = sourceFks.get(item.name)
    if (!old || (includeDrops && !sameFk(old, item, database))) statements.push(`ADD ${fk(item, database)}`)
  }
  for (const check of source.checks) {
    const next = target.checks.find((item) => item.name === check.name)
    if (includeDrops && (!next || next.expression !== check.expression)) statements.push(`DROP CHECK ${quoteIdentifier(check.name)}`)
  }
  for (const check of target.checks) {
    const old = source.checks.find((item) => item.name === check.name)
    if (!old || (includeDrops && old.expression !== check.expression)) statements.push(`ADD CONSTRAINT ${quoteIdentifier(check.name)} CHECK (${check.expression})${check.enforced === false ? ' NOT ENFORCED' : ''}`)
  }
  if (source.engine !== target.engine && target.engine) statements.push(`ENGINE=${target.engine}`)
  if (source.charset !== target.charset && target.charset) statements.push(`DEFAULT CHARACTER SET=${quoteIdentifier(target.charset)}`)
  if (source.collation !== target.collation && target.collation) statements.push(`COLLATE=${quoteIdentifier(target.collation)}`)
  if (source.comment !== target.comment) statements.push(`COMMENT=${literal(target.comment ?? '')}`)
  for (const [key, value] of Object.entries(target.options ?? {})) if (source.options?.[key] !== value) statements.push(`${key}=${value}`)
  for (const key of Object.keys(source.options ?? {})) if (!(key in (target.options ?? {})) && key === 'AUTO_INCREMENT') statements.push('AUTO_INCREMENT=1')
  if (JSON.stringify(source.partitioning) !== JSON.stringify(target.partitioning)) {
    if (target.partitioning) statements.push(partitionSql(target.partitioning))
    else if (source.partitioning) statements.push('REMOVE PARTITIONING')
  }
  return statements.length ? [`ALTER TABLE ${qualifiedName(database, target.name)}\n  ${statements.join(',\n  ')};`] : []
}

function partitionSql(partitioning: NonNullable<TableModel['partitioning']>): string {
  const method = partitioning.method.replace('LINEAR ', 'LINEAR ')
  const expression = partitioning.expression ? ` (${partitioning.expression})` : ''
  const definitions = partitioning.definitions?.length
    ? ` (${partitioning.definitions.map((item) => `PARTITION ${quoteIdentifier(item.name)} ${partitioning.method.includes('RANGE') ? `VALUES LESS THAN (${item.value ?? 'MAXVALUE'})` : partitioning.method.includes('LIST') ? `VALUES IN (${item.value ?? ''})` : ''}${item.comment ? ` COMMENT ${literal(item.comment)}` : ''}`).join(', ')})`
    : ''
  return `PARTITION BY ${method}${expression}${definitions}`
}
