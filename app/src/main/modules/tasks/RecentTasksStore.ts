import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RecentTask, TaskKind } from '../../../shared/contracts/tasks.js'

const kinds = new Set<TaskKind>(['backup', 'export', 'import', 'schema-compare', 'data-compare'])
const cleanText = (value: unknown, max: number): string => typeof value === 'string' ? Array.from(value, (character) => { const code = character.codePointAt(0) ?? 0; return code <= 31 || code === 127 ? ' ' : character }).join('').replace(/\b(password|passwd|token|secret|api[_-]?key|credential)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').trim().slice(0, max) : ''

export class RecentTasksStore {
  constructor(private readonly filePath: string) {}
  async list(): Promise<RecentTask[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!Array.isArray(value)) return []
      return value.filter((item): item is RecentTask => Boolean(item && typeof item === 'object' && typeof item.id === 'string' && kinds.has(item.kind) && typeof item.title === 'string' && typeof item.detail === 'string' && typeof item.updatedAt === 'string')).slice(0, 100)
    } catch { return [] }
  }
  async record(input: { kind: TaskKind; title: string; detail: string }): Promise<RecentTask> {
    if (!input || !kinds.has(input.kind)) throw new Error('Invalid task type.')
    const title = cleanText(input.title, 120)
    if (!title) throw new Error('Task title is required.')
    const entry: RecentTask = { id: randomUUID(), kind: input.kind, title, detail: cleanText(input.detail, 240), updatedAt: new Date().toISOString() }
    const rows = [entry, ...(await this.list()).filter((item) => item.kind !== entry.kind || item.title !== entry.title)].slice(0, 100)
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    await writeFile(this.filePath, JSON.stringify(rows, null, 2), { mode: 0o600 })
    await chmod(this.filePath, 0o600)
    return entry
  }
  async delete(id: string): Promise<void> {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid task id.')
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    await writeFile(this.filePath, JSON.stringify((await this.list()).filter((item) => item.id !== id), null, 2), { mode: 0o600 })
    await chmod(this.filePath, 0o600)
  }
}
