import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseModel, ForeignKeyModel } from '../schema/model.js'
import type { DiagramPoint, DiagramRelation, ERDiagram, VirtualRelationInput } from './types.js'

export type { DiagramContainer, DiagramNote, DiagramPoint, DiagramRelation, DiagramTable, ERDiagram, VirtualRelationInput } from './types.js'
export { type RelationCardinality } from './types.js'
const CARD_WIDTH = 260
const LAYER_GAP = 100
const ROW_GAP = 40

export function autoLayout(names: string[], edges: Array<{ from: string; to: string }>): Record<string, DiagramPoint> {
  const levels = new Map(names.map((name) => [name, 0]))
  const incoming = new Map(names.map((name) => [name, 0]))
  const outgoing = new Map<string, string[]>(names.map((name) => [name, []]))
  for (const edge of edges) if (incoming.has(edge.from) && incoming.has(edge.to) && edge.from !== edge.to) {
    outgoing.get(edge.from)!.push(edge.to); incoming.set(edge.to, incoming.get(edge.to)! + 1)
  }
  const queue = names.filter((name) => incoming.get(name) === 0)
  const visited = new Set<string>()
  while (queue.length) {
    const parent = queue.shift()!
    if (visited.has(parent)) continue
    visited.add(parent)
    for (const child of outgoing.get(parent) ?? []) {
      levels.set(child, Math.max(levels.get(child) ?? 0, (levels.get(parent) ?? 0) + 1))
      incoming.set(child, incoming.get(child)! - 1)
      if (incoming.get(child) === 0) queue.push(child)
    }
  }
  const groups = new Map<number, string[]>()
  for (const name of names) {
    const level = visited.has(name) ? levels.get(name) ?? 0 : 0
    const group = groups.get(level) ?? []; group.push(name); groups.set(level, group)
  }
  const result: Record<string, DiagramPoint> = {}
  for (const [level, group] of groups) group.forEach((name, index) => { result[name] = { x: 40 + level * (CARD_WIDTH + LAYER_GAP), y: 40 + index * (260 + ROW_GAP) } })
  return result
}

function physicalRelation(table: string, fk: ForeignKeyModel): DiagramRelation {
  return { id: `${table}:${fk.name}`, name: fk.name, fromTable: table, fromColumns: fk.columns, toTable: fk.referencedTable, toColumns: fk.referencedColumns, virtual: false, onDelete: fk.onDelete, onUpdate: fk.onUpdate }
}

export function buildDiagram(source: DatabaseModel, connectionId: string, virtualRelations: DiagramRelation[] = []): ERDiagram {
  const names = source.tables.map((table) => table.name)
  const physical = source.tables.flatMap((table) => table.foreignKeys.filter((fk) => names.includes(fk.referencedTable)).map((fk) => ({ ...physicalRelation(table.name, fk), cardinality: relationCardinality(source, physicalRelation(table.name, fk)) })))
  const positions = autoLayout(names, physical.map((relation) => ({ from: relation.toTable, to: relation.fromTable })))
  const validVirtuals = virtualRelations.filter((relation) => names.includes(relation.fromTable) && names.includes(relation.toTable)).map((relation) => ({ ...relation, cardinality: relationCardinality(source, relation) }))
  return {
    version: 1, connectionId, database: source.name,
    tables: source.tables.map((table) => ({
      name: table.name,
      columns: table.columns,
      position: positions[table.name] ?? { x: 40, y: 40 },
      primaryColumns: table.indexes.filter((index) => index.kind === 'PRIMARY').flatMap((index) => index.columns.map((column) => column.name)),
      constraintNames: [...table.foreignKeys.map((key) => key.name), ...table.checks.map((check) => check.name)],
      indexNames: table.indexes.filter((index) => index.kind !== 'PRIMARY').map((index) => index.name),
      triggerNames: source.triggers.filter((trigger) => trigger.table === table.name).map((trigger) => trigger.name)
    })),
    relations: [...physical, ...validVirtuals], virtualRelations: validVirtuals
  }
}

/** Cardinality from child (from) and referenced parent (to) ends of a relation. */
export function relationCardinality(source: DatabaseModel, relation: DiagramRelation): import('./types.js').RelationCardinality {
  const child = source.tables.find((table) => table.name === relation.fromTable)
  const foreignKey = child?.foreignKeys.find((item) => item.name === relation.name && item.columns.join('\0') === relation.fromColumns.join('\0'))
  const nullable = foreignKey ? foreignKey.columns.some((name) => child?.columns.find((column) => column.name === name)?.nullable) : relation.fromColumns.some((name) => child?.columns.find((column) => column.name === name)?.nullable)
  const unique = Boolean(child?.indexes.some((index) => (index.kind === 'PRIMARY' || index.kind === 'UNIQUE') && index.columns.length === relation.fromColumns.length && index.columns.every((column, i) => column.name === relation.fromColumns[i])))
  return { from: unique ? (nullable ? '0..1' : '1') : '0..N', to: nullable ? '0..1' : '1' }
}

export function moveTable(diagram: ERDiagram, tableName: string, position: DiagramPoint): ERDiagram {
  if (![position.x, position.y].every(Number.isFinite)) throw new Error('Posição do diagrama inválida.')
  return { ...diagram, tables: diagram.tables.map((table) => table.name === tableName ? { ...table, position: { x: Math.max(0, position.x), y: Math.max(0, position.y) } } : table) }
}

export function createVirtualRelation(input: VirtualRelationInput, tableNames: string[]): DiagramRelation {
  const name = input.name.trim()
  if (!name || !tableNames.includes(input.fromTable) || !tableNames.includes(input.toTable)) throw new Error('Informe nome e tabelas válidas para a relação virtual.')
  if (!input.fromColumns.length || input.fromColumns.length !== input.toColumns.length) throw new Error('As colunas de origem e destino devem formar pares.')
  return { id: randomUUID(), name, fromTable: input.fromTable, fromColumns: input.fromColumns, toTable: input.toTable, toColumns: input.toColumns, comment: input.comment?.trim(), virtual: true }
}

export function serializeDiagram(diagram: ERDiagram): string { return JSON.stringify(diagram, null, 2) }
export function deserializeDiagram(value: string): ERDiagram {
  if (value.length > 20 * 1024 * 1024) throw new Error('Diagram file exceeds the 20 MB safety limit.')
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { throw new Error('Diagram deserialization failed.') }
  if (!parsed || typeof parsed !== 'object') throw new Error('Diagram deserialization failed.')
  const candidate = parsed as ERDiagram
  if (candidate.version !== 1 || typeof candidate.database !== 'string' || candidate.database.length > 256 || typeof candidate.connectionId !== 'string' || candidate.connectionId.length > 256 || !Array.isArray(candidate.tables) || candidate.tables.length > 5000 || !Array.isArray(candidate.relations) || candidate.relations.length > 20000 || !Array.isArray(candidate.virtualRelations) || candidate.virtualRelations.length > 20000) throw new Error('Diagram deserialization failed.')
  if (candidate.tables.some((table) => !table || typeof table.name !== 'string' || table.name.length > 256 || !Array.isArray(table.columns) || table.columns.length > 1000 || !table.position || ![table.position.x, table.position.y].every((number) => Number.isFinite(number) && Math.abs(number) <= 1_000_000))) throw new Error('Diagram deserialization failed.')
  const safeRelation = (relation: DiagramRelation): boolean => Boolean(relation && typeof relation === 'object' && typeof relation.id === 'string' && relation.id.length <= 512 && typeof relation.name === 'string' && relation.name.length <= 256 && typeof relation.fromTable === 'string' && typeof relation.toTable === 'string' && Array.isArray(relation.fromColumns) && relation.fromColumns.length <= 1000 && relation.fromColumns.every((name) => typeof name === 'string' && name.length <= 256) && Array.isArray(relation.toColumns) && relation.toColumns.length <= 1000 && relation.toColumns.every((name) => typeof name === 'string' && name.length <= 256) && typeof relation.virtual === 'boolean')
  if (candidate.relations.some((relation) => !safeRelation(relation)) || candidate.virtualRelations.some((relation) => !safeRelation(relation) || !relation.virtual)) throw new Error('Diagram deserialization failed.')
  if (candidate.containers !== undefined && (!Array.isArray(candidate.containers) || candidate.containers.length > 1000 || candidate.containers.some((item) => !item || typeof item.id !== 'string' || item.id.length > 128 || typeof item.title !== 'string' || item.title.length > 256 || !item.position || ![item.position.x, item.position.y, item.width, item.height].every((number) => Number.isFinite(number) && number >= 0 && number <= 1_000_000)))) throw new Error('Diagram deserialization failed.')
  if (candidate.notes !== undefined && (!Array.isArray(candidate.notes) || candidate.notes.length > 1000 || candidate.notes.some((item) => !item || typeof item.id !== 'string' || item.id.length > 128 || typeof item.text !== 'string' || item.text.length > 500 || !item.position || ![item.position.x, item.position.y].every((number) => Number.isFinite(number) && number >= 0 && number <= 1_000_000)))) throw new Error('Diagram deserialization failed.')
  return candidate
}

export function validateVirtualRelation(relation: DiagramRelation, source: DatabaseModel): string | undefined {
  const child = source.tables.find((table) => table.name === relation.fromTable)
  const parent = source.tables.find((table) => table.name === relation.toTable)
  if (!child || !parent) return `Tabela ausente: ${!child ? relation.fromTable : relation.toTable}`
  if (relation.fromColumns.some((name) => !child.columns.some((column) => column.name === name)) || relation.toColumns.some((name) => !parent.columns.some((column) => column.name === name))) return 'Coluna inexistente.'
  return undefined
}

export class VirtualRelationStore {
  constructor(private readonly directory: string) {}
  private file(connectionId: string, database: string): string { return join(this.directory, `${encodeURIComponent(connectionId)}--${encodeURIComponent(database)}.relations.json`) }
  async read(connectionId: string, database: string): Promise<DiagramRelation[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.file(connectionId, database), 'utf8'))
      if (!Array.isArray(value) || value.length > 20000) throw new Error('Virtual relation file is invalid.')
      return value.filter(isVirtualRelation)
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async write(connectionId: string, database: string, relations: DiagramRelation[]): Promise<void> {
    if (!connectionId || !database || relations.length > 20000 || relations.some((relation) => !isVirtualRelation(relation))) throw new Error('Virtual relation data is invalid.')
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const destination = this.file(connectionId, database); const temporary = `${destination}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(relations, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, destination); await chmod(destination, 0o600)
  }
}

function isVirtualRelation(value: unknown): value is DiagramRelation {
  if (!value || typeof value !== 'object') return false
  const relation = value as Partial<DiagramRelation>
  return relation.virtual === true && typeof relation.id === 'string' && relation.id.length <= 512 && typeof relation.name === 'string' && relation.name.length > 0 && relation.name.length <= 256 && typeof relation.fromTable === 'string' && relation.fromTable.length <= 256 && typeof relation.toTable === 'string' && relation.toTable.length <= 256 && Array.isArray(relation.fromColumns) && relation.fromColumns.length > 0 && relation.fromColumns.length <= 1000 && relation.fromColumns.every((name) => typeof name === 'string' && name.length <= 256) && Array.isArray(relation.toColumns) && relation.toColumns.length === relation.fromColumns.length && relation.toColumns.every((name) => typeof name === 'string' && name.length <= 256) && (relation.comment === undefined || typeof relation.comment === 'string' && relation.comment.length <= 4000)
}
