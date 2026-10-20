import type { SchemaObject, SchemaObjectKind, TableModel } from '../../modules/schema/model.js'

export interface ObjectEditorTarget { connectionId: string; database: string; kind: Exclude<SchemaObjectKind, 'database'>; name: string }
export interface ObjectEditorApi {
  loadObjectEditor(target: ObjectEditorTarget): Promise<SchemaObject>
  applyTableEditor(connectionId: string, database: string, original: TableModel | null, target: TableModel): Promise<string[]>
  applyObjectEditor(target: ObjectEditorTarget, sql: string): Promise<void>
  mutateDatabaseObject(target: ObjectEditorTarget, action: 'drop' | 'rename' | 'truncate', newName?: string): Promise<void>
}

