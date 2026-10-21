export const databaseObjectDragType = 'application/x-dbforgelinux-database-object'

export interface DatabaseObjectDragPayload {
  connectionId: string
  database: string
  kind: 'table' | 'view'
  name: string
}

export function parseDatabaseObjectDrag(value: string): DatabaseObjectDragPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<DatabaseObjectDragPayload>
    if (typeof parsed.connectionId !== 'string' || !parsed.connectionId || typeof parsed.database !== 'string' || !parsed.database || (parsed.kind !== 'table' && parsed.kind !== 'view') || typeof parsed.name !== 'string' || !parsed.name) return null
    return { connectionId: parsed.connectionId, database: parsed.database, kind: parsed.kind, name: parsed.name }
  } catch { return null }
}
