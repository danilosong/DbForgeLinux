export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  /** Set for disk-backed results; rows are fetched by window from the main process. */
  resultStoreId?: string
  rowCount?: number
  affectedRows: number
  insertId: number
  warningStatus: number
  editable?: import('../../modules/grid-editing/index.js').EditableResult
}

export type DatabaseObjectKind = 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event'
export interface DatabaseObject { name: string; kind: DatabaseObjectKind }
export interface SqlFile { path: string; contents: string }
