import type { EditableResult, GridChange } from '../../modules/grid-editing/index.js'
export interface GridEditingApi {
  describeGridResult(connectionId: string, sql: string, database?: string): Promise<EditableResult>
  previewGridChanges(descriptor: EditableResult, changes: GridChange[]): Promise<Array<{ sql: string; values: unknown[] }>>
  applyGridChanges(connectionId: string, descriptor: EditableResult, changes: GridChange[], autoCommit: boolean): Promise<{ updated: number; inserted: number; deleted: number }>
}
