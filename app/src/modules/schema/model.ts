export type SchemaObjectKind = 'database' | 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event'
export interface SchemaObject { kind: SchemaObjectKind; name: string; createSql?: string }
export interface DatabaseModel extends SchemaObject {
  kind: 'database'; charset?: string; collation?: string
  tables: TableModel[]; views: ViewModel[]; procedures: RoutineModel[]; functions: RoutineModel[]; triggers: TriggerModel[]; events: EventModel[]
}
export interface TableModel extends SchemaObject {
  kind: 'table'; columns: ColumnModel[]; indexes: IndexModel[]; foreignKeys: ForeignKeyModel[]; checks: CheckConstraintModel[]
  partitions?: PartitionModel[]; partitioning?: { method: 'RANGE' | 'LIST' | 'HASH' | 'KEY' | 'LINEAR HASH' | 'LINEAR KEY'; expression?: string; definitions?: Array<{ name: string; value?: string; comment?: string }> }
  engine?: string; charset?: string; collation?: string; comment?: string; options?: Record<string, string>
}
export interface ColumnModel { name: string; type: string; nullable: boolean; default?: string | null; autoIncrement?: boolean; comment?: string; generated?: string; generatedStorage?: 'VIRTUAL' | 'STORED'; charset?: string; collation?: string; onUpdate?: string }
export interface IndexModel { name: string; columns: Array<{ name: string; order?: 'ASC' | 'DESC'; prefixLength?: number; expression?: string }>; kind: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT' | 'SPATIAL'; comment?: string; visible?: boolean }
export interface ForeignKeyModel { name: string; columns: string[]; referencedTable: string; referencedColumns: string[]; referencedDatabase?: string; onUpdate?: string; onDelete?: string }
export interface CheckConstraintModel { name: string; expression: string; enforced?: boolean }
export interface PartitionModel { name: string; method: string; expression?: string; description?: string; subpartition?: string }
export interface ViewModel extends SchemaObject { kind: 'view'; definition: string; algorithm?: string; definer?: string; security?: string; checkOption?: string; columns?: ColumnModel[] }
export interface RoutineModel extends SchemaObject { kind: 'procedure' | 'function'; definition: string; definer?: string; security?: string; sqlDataAccess?: string; deterministic?: boolean; comment?: string; parameters?: string[]; returnType?: string }
export interface TriggerModel extends SchemaObject { kind: 'trigger'; table: string; timing: 'BEFORE' | 'AFTER'; event: 'INSERT' | 'UPDATE' | 'DELETE'; definition: string; definer?: string }
export interface EventModel extends SchemaObject { kind: 'event'; definition: string; status?: string; schedule?: string; definer?: string }

export interface SchemaDifference { kind: SchemaObjectKind | 'column' | 'index' | 'foreignKey'; object: string; change: 'added' | 'removed' | 'changed'; detail: string }
