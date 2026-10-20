export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  affectedRows: number
  insertId: number
  warningStatus: number
}

export type DatabaseObjectKind = 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event'
export interface DatabaseObject { name: string; kind: DatabaseObjectKind }
export interface SqlFile { path: string; contents: string }
