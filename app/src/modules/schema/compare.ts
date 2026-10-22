import type { DatabaseModel, SchemaDifference, SchemaObject, TableModel, ViewModel } from './model.js'
import { createObject, createTable, diffTables, dropObject } from './ddl.js'
import { splitBackupSql } from '../database-tools/splitSql.js'

/** Schema synchronization accepts object DDL only, never arbitrary statements from an imported model. */
export function assertSchemaUpdateScript(script: string): string[] {
  const statements = splitBackupSql(script).map((statement) => statement.trim()).filter(Boolean)
  const objectDdl = /^(?:CREATE(?:\s+OR\s+REPLACE)?\s+(?:(?:TEMPORARY|ALGORITHM\s*=\s*(?:UNDEFINED|MERGE|TEMPTABLE)|DEFINER\s*=\s*[^\s]+|SQL\s+SECURITY\s+(?:DEFINER|INVOKER))\s+)*(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)|ALTER\s+TABLE|DROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT))\b/i
  if (!statements.length || statements.some((statement) => !objectDdl.test(statement))) {
    throw new Error('Schema update script contains a statement outside the supported object DDL allowlist.')
  }
  return statements
}

export interface CompareOptions { includeDrops?: boolean }
export interface SchemaComparison { differences: SchemaDifference[]; script: string }

export function compareSchemas(source: DatabaseModel, target: DatabaseModel, options: CompareOptions = {}): SchemaComparison {
  const includeDrops = options.includeDrops === true
  const differences: SchemaDifference[] = []
  const script: string[] = []
  const sourceTables = byName(source.tables)
  const targetTables = byName(target.tables)
  const sourceOther = objects(source)
  const targetOther = objects(target)
  const removedObjects: string[] = []
  const removedTables: TableModel[] = []

  for (const table of target.tables) {
    const old = sourceTables.get(table.name)
    if (!old) {
      differences.push({ kind: 'table', object: table.name, change: 'added', detail: 'Table added' })
      script.push(createTable({ ...table, foreignKeys: [] }, source.name))
    } else {
      const tableChanges = tableDiffs(old, table, source.name, target.name)
      differences.push(...tableChanges)
      const remapped = { ...table, foreignKeys: table.foreignKeys.map((fk) => ({ ...fk, referencedDatabase: fk.referencedDatabase === target.name ? source.name : fk.referencedDatabase })) }
      script.push(...diffTables(old, remapped, source.name, includeDrops))
    }
  }
  // All tables exist before constraints are added, so FK dependencies can point forward.
  for (const table of target.tables) {
    const old = sourceTables.get(table.name)
    const oldFks = new Map((old?.foreignKeys ?? []).map((fk) => [fk.name, fk]))
    const addedOrChanged = table.foreignKeys.filter((fk) => {
      const previous = oldFks.get(fk.name)
      return !previous || JSON.stringify(previous) !== JSON.stringify(fk)
    })
    if (!old && addedOrChanged.length) {
      script.push(`ALTER TABLE ${ident(source.name)}.${ident(table.name)}\n  ${addedOrChanged.map((fk) => `ADD CONSTRAINT ${ident(fk.name)} FOREIGN KEY (${fk.columns.map(ident).join(', ')}) REFERENCES ${ident(fk.referencedDatabase === target.name || !fk.referencedDatabase ? source.name : fk.referencedDatabase)}.${ident(fk.referencedTable)} (${fk.referencedColumns.map(ident).join(', ')})${fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''}${fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''}`).join(',\n  ')};`)
    }
  }

  for (const object of targetOther) {
    const old = sourceOther.find((candidate) => candidate.kind === object.kind && candidate.name === object.name)
    if (!old) {
      differences.push({ kind: object.kind, object: object.name, change: 'added', detail: `${object.kind} added` })
      script.push(schemaObjectScript(object, source.name))
    } else if (normalizeCreate(old) !== normalizeCreate(object)) {
      differences.push({ kind: object.kind, object: object.name, change: 'changed', detail: `${object.kind} definition changed` })
      if (object.kind === 'view') script.push(`CREATE OR REPLACE VIEW ${ident(source.name)}.${ident(object.name)} AS ${(object as ViewModel).definition};`)
      else if (includeDrops) script.push(dropObject(old, source.name), schemaObjectScript(object, source.name))
    }
  }
  for (const table of source.tables) if (!targetTables.has(table.name)) {
    differences.push({ kind: 'table', object: table.name, change: 'removed', detail: 'Table removed' })
    if (includeDrops) removedTables.push(table)
  }
  for (const object of sourceOther) if (!targetOther.some((candidate) => candidate.kind === object.kind && candidate.name === object.name)) {
    differences.push({ kind: object.kind, object: object.name, change: 'removed', detail: `${object.kind} removed` })
    if (includeDrops) removedObjects.push(dropObject(object, source.name))
  }
  if (includeDrops) script.push(...removedObjects, ...reverseDependencyOrder(removedTables).map((table) => dropObject(table, source.name)))
  return { differences, script: script.join('\n\n') }
}

function byName<T extends { name: string }>(items: T[]): Map<string, T> { return new Map(items.map((item) => [item.name, item])) }
function ident(value: string): string { return `\`${value.replaceAll('`', '``')}\`` }
function objects(db: DatabaseModel): SchemaObject[] { return [...db.views, ...db.procedures, ...db.functions, ...db.triggers, ...db.events] }
function normalizeCreate(object: SchemaObject): string { return (object.createSql ?? ('definition' in object ? String(object.definition) : '')).replace(/\s+/g, ' ').trim().toLowerCase() }

function schemaObjectScript(object: SchemaObject, database: string): string {
  const sql = createObject(object, database).trim()
  if (!['procedure', 'function', 'trigger', 'event'].includes(object.kind)) return sql
  let delimiter = '$$DBFL_SCHEMA_SYNC$$'
  while (sql.includes(delimiter)) delimiter += '$'
  return `DELIMITER ${delimiter}\n${sql.replace(/;\s*$/, '')}${delimiter}\nDELIMITER ;`
}

function tableDiffs(source: TableModel, target: TableModel, sourceDatabase: string, targetDatabase: string): SchemaDifference[] {
  const result: SchemaDifference[] = []
  for (const column of target.columns) {
    const old = source.columns.find((candidate) => candidate.name === column.name)
    if (!old) result.push({ kind: 'column', object: `${target.name}.${column.name}`, change: 'added', detail: 'Column added' })
    else if (JSON.stringify(old) !== JSON.stringify(column)) result.push({ kind: 'column', object: `${target.name}.${column.name}`, change: 'changed', detail: 'Column changed' })
  }
  for (const column of source.columns) if (!target.columns.some((candidate) => candidate.name === column.name)) result.push({ kind: 'column', object: `${source.name}.${column.name}`, change: 'removed', detail: 'Column removed' })
  for (const index of target.indexes) {
    const old = source.indexes.find((candidate) => candidate.name === index.name)
    if (!old) result.push({ kind: 'index', object: `${target.name}.${index.name}`, change: 'added', detail: 'Index added' })
    else if (JSON.stringify(old) !== JSON.stringify(index)) result.push({ kind: 'index', object: `${target.name}.${index.name}`, change: 'changed', detail: 'Index changed' })
  }
  for (const index of source.indexes) if (!target.indexes.some((candidate) => candidate.name === index.name)) result.push({ kind: 'index', object: `${source.name}.${index.name}`, change: 'removed', detail: 'Index removed' })
  for (const fk of target.foreignKeys) {
    const old = source.foreignKeys.find((candidate) => candidate.name === fk.name)
    if (!old) result.push({ kind: 'foreignKey', object: `${target.name}.${fk.name}`, change: 'added', detail: 'Foreign key added' })
    else if (!sameForeignKey(old, fk, sourceDatabase, targetDatabase)) result.push({ kind: 'foreignKey', object: `${target.name}.${fk.name}`, change: 'changed', detail: 'Foreign key changed' })
  }
  for (const fk of source.foreignKeys) if (!target.foreignKeys.some((candidate) => candidate.name === fk.name)) result.push({ kind: 'foreignKey', object: `${source.name}.${fk.name}`, change: 'removed', detail: 'Foreign key removed' })
  return result
}

function sameForeignKey(a: TableModel['foreignKeys'][number], b: TableModel['foreignKeys'][number], sourceDatabase: string, targetDatabase: string): boolean {
  const normalize = (foreignKey: TableModel['foreignKeys'][number], localDatabase: string): string => JSON.stringify({
    ...foreignKey,
    referencedDatabase: !foreignKey.referencedDatabase || foreignKey.referencedDatabase === localDatabase ? '$local' : foreignKey.referencedDatabase
  })
  return normalize(a, sourceDatabase) === normalize(b, targetDatabase)
}

function reverseDependencyOrder(tables: TableModel[]): TableModel[] {
  const byName = new Map(tables.map((table) => [table.name, table]))
  const visited = new Set<string>()
  const ordered: TableModel[] = []
  const visit = (table: TableModel): void => {
    if (visited.has(table.name)) return
    visited.add(table.name)
    for (const foreignKey of table.foreignKeys) {
      const dependency = byName.get(foreignKey.referencedTable)
      if (dependency) visit(dependency)
    }
    ordered.push(table)
  }
  for (const table of tables) visit(table)
  return ordered.reverse()
}
