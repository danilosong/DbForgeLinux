import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

export interface SchemaUpdateItem { id: string; connectionId: string; database: string; source: string; script: string; createdAt: string; destructive: boolean }
export interface SchemaUpdateInput { connectionId: string; database: string; source: string; script: string }

export function splitSchemaScript(script: string): string[] {
  return splitSqlStatements(script).map(({ sql }) => `${sql};`)
}
export function isDestructiveSchemaScript(script: string): boolean { return /\b(?:DROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE|COLUMN)|TRUNCATE\s+TABLE)\b/i.test(script) }

export class SchemaUpdateStore {
  constructor(readonly filePath: string) {}
  async list(): Promise<SchemaUpdateItem[]> {
    try {
      const data: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) throw new Error('Schema Update Script data is invalid.')
      return (data as { items: SchemaUpdateItem[] }).items.filter((item) => validItem(item))
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async add(input: SchemaUpdateInput): Promise<SchemaUpdateItem> {
    const connectionId = input.connectionId.trim(); const database = input.database.trim(); const source = input.source.trim(); const script = input.script.trim()
    if (!connectionId || !database || !source || !script || script.length > 2_000_000 || !splitSchemaScript(script).length) throw new Error('Schema update entry is invalid.')
    const items = await this.list()
    const item = { id: randomUUID(), connectionId, database, source, script, createdAt: new Date().toISOString(), destructive: isDestructiveSchemaScript(script) }
    items.push(item); await this.save(items); return item
  }
  async remove(ids: string[]): Promise<void> { const removed = new Set(ids); await this.save((await this.list()).filter((item) => !removed.has(item.id))) }
  async clear(): Promise<void> { await this.save([]) }
  private async save(items: SchemaUpdateItem[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    const temp = `${this.filePath}.${randomUUID()}.tmp`
    await writeFile(temp, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, { mode: 0o600 })
    await rename(temp, this.filePath)
  }
}
function validItem(item: unknown): item is SchemaUpdateItem {
  if (!item || typeof item !== 'object') return false
  const value = item as Partial<SchemaUpdateItem>
  return typeof value.id === 'string' && typeof value.connectionId === 'string' && typeof value.database === 'string' && typeof value.source === 'string' && typeof value.script === 'string' && typeof value.createdAt === 'string' && typeof value.destructive === 'boolean'
}
