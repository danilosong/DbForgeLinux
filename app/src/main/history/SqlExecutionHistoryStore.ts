import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SqlExecutionHistoryEntry, SqlExecutionHistoryQuery } from '../../shared/contracts/history.js'

const MAX_HISTORY_ENTRIES = 500

export function redactSqlSecrets(sql: string): string {
  return sql.slice(0, 100_000)
    .replace(/(\bIDENTIFIED\s+BY\s+(?:PASSWORD\s+)?)(?:'(?:\\.|''|[^'])*'|"(?:\\.|""|[^"])*"|`[^`]*`|[^\s;,]+)/gi, '$1\'****\'')
    .replace(/(\b(?:PASSWORD|PASSWD|PASSPHRASE)\s*=\s*)(?:'(?:\\.|''|[^'])*'|"(?:\\.|""|[^"])*"|`[^`]*`|[^\s;,]+)/gi, '$1\'****\'')
    .replace(/(\bmysql:\/\/[^:/\s]+:)[^@/\s]+@/gi, '$1****@')
}

export class SqlExecutionHistoryStore {
  private entries?: SqlExecutionHistoryEntry[]
  private operations: Promise<void> = Promise.resolve()

  constructor(private readonly path: string) {}

  list(query: SqlExecutionHistoryQuery = {}): Promise<SqlExecutionHistoryEntry[]> {
    return this.enqueue(async () => {
      await this.load()
      const needle = query.search?.trim().toLocaleLowerCase()
      const limit = Math.max(1, Math.min(500, Math.floor(query.limit ?? 200)))
      return (this.entries ?? []).filter((entry) => !needle || `${entry.connection} ${entry.database ?? ''} ${entry.sql} ${entry.error ?? ''}`.toLocaleLowerCase().includes(needle)).slice(0, limit)
    })
  }

  record(entry: SqlExecutionHistoryEntry): Promise<void> {
    return this.enqueue(async () => {
      await this.load()
      const safeEntry: SqlExecutionHistoryEntry = {
        id: String(entry.id).slice(0, 120),
        timestamp: validTimestamp(entry.timestamp),
        connection: String(entry.connection).slice(0, 255),
        ...(entry.database ? { database: String(entry.database).slice(0, 255) } : {}),
        sql: redactSqlSecrets(String(entry.sql)),
        elapsedMs: Math.max(0, Number.isFinite(entry.elapsedMs) ? entry.elapsedMs : 0),
        success: entry.success === true,
        ...(entry.rowCount === undefined ? {} : { rowCount: Math.max(0, Math.floor(entry.rowCount)) }),
        ...(entry.error ? { error: redactSqlSecrets(String(entry.error)).slice(0, 2000) } : {})
      }
      this.entries = [safeEntry, ...(this.entries ?? []).filter((item) => item.id !== safeEntry.id)].slice(0, MAX_HISTORY_ENTRIES)
      await this.persist()
    })
  }

  private async load(): Promise<void> {
    if (this.entries) return
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
      this.entries = Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, MAX_HISTORY_ENTRIES) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.entries = []
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
    const temp = `${this.path}.tmp`
    await writeFile(temp, JSON.stringify(this.entries ?? [], null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temp, this.path)
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation, operation)
    this.operations = result.then(() => undefined, () => undefined)
    return result
  }
}

function isHistoryEntry(value: unknown): value is SqlExecutionHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SqlExecutionHistoryEntry>
  return typeof item.id === 'string' && typeof item.timestamp === 'string' && typeof item.connection === 'string' && typeof item.sql === 'string' && typeof item.elapsedMs === 'number' && typeof item.success === 'boolean'
}

function validTimestamp(value: string): string {
  const time = Date.parse(value)
  return Number.isNaN(time) ? new Date().toISOString() : new Date(time).toISOString()
}
