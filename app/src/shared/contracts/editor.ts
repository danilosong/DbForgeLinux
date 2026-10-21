export interface EditorColumnMetadata { name: string; type: string; nullable?: boolean }
export interface EditorObjectMetadata { name: string; kind: 'table' | 'view'; columns: EditorColumnMetadata[]; engine?: string }
export interface EditorRoutineMetadata { name: string; kind: 'procedure' | 'function' }
export interface EditorMetadata { database: string; databases: string[]; objects: EditorObjectMetadata[]; routines: EditorRoutineMetadata[] }

export type EditorApi = {
  getEditorMetadata(connectionId: string, database: string, refresh?: boolean): Promise<EditorMetadata>
  invalidateEditorMetadata(connectionId: string, database?: string): Promise<void>
}

