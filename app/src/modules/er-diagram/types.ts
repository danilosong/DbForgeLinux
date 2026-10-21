import type { ColumnModel, DatabaseModel } from '../schema/model.js'

export interface DiagramPoint { x: number; y: number }
export interface DiagramTable { name: string; columns: ColumnModel[]; position: DiagramPoint; collapsed?: boolean; primaryColumns?: string[]; constraintNames?: string[]; indexNames?: string[]; triggerNames?: string[]; collapsedSections?: Partial<Record<'Constraints' | 'Indexes' | 'Triggers', boolean>> }
export interface DiagramRelation {
  id: string
  name: string
  fromTable: string
  fromColumns: string[]
  toTable: string
  toColumns: string[]
  virtual: boolean
  onDelete?: string
  onUpdate?: string
  comment?: string
  cardinality?: RelationCardinality
}
export interface ERDiagram {
  version: 1
  connectionId: string
  database: string
  tables: DiagramTable[]
  relations: DiagramRelation[]
  virtualRelations: DiagramRelation[]
}
export interface VirtualRelationInput { name: string; fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[]; comment?: string }
export interface ERDiagramSource extends Pick<DatabaseModel, 'name' | 'tables'> { kind: 'database' }
export interface RelationCardinality { from: '1' | 'N' | '0..1' | '0..N'; to: '1' | 'N' | '0..1' | '0..N' }
