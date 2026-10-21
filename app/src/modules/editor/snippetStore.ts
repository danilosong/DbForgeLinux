import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SqlSnippet } from './snippets.js'

export interface UserSnippet extends SqlSnippet { id: string; category: string; scope: 'sql' }
export function validateSnippet(value: unknown, existing: readonly UserSnippet[] = [], exceptId?: string): Omit<UserSnippet, 'id'> {
  if (!value || typeof value !== 'object') throw new Error('Snippet data is invalid.')
  const item = value as Partial<UserSnippet>
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const prefix = typeof item.prefix === 'string' ? item.prefix.trim() : ''
  const description = typeof item.description === 'string' ? item.description.trim() : ''
  const body = typeof item.body === 'string' ? item.body : ''
  const category = typeof item.category === 'string' ? item.category.trim() || 'User' : 'User'
  if (!label || label.length > 120 || !/^[A-Za-z][\w-]{0,39}$/.test(prefix) || !body.trim() || body.length > 100_000 || category.length > 80) throw new Error('Snippet name, prefix, category or body is invalid.')
  if (/\$\{(?!\d+(?::[^{}]*)?\})/.test(body)) throw new Error('Snippet placeholders must use ${1}, ${2:default} or $0 syntax.')
  if (existing.some((other) => other.id !== exceptId && other.prefix.toLowerCase() === prefix.toLowerCase())) throw new Error(`Snippet prefix ${prefix} is already in use.`)
  return { label, prefix, description, body, category, scope: 'sql' }
}

export class UserSnippetStore {
  private readonly snippetsDirectory: string
  constructor(readonly filePath: string) { this.snippetsDirectory = join(dirname(filePath), 'items') }
  async list(): Promise<UserSnippet[]> {
    try {
      const files = (await readdir(this.snippetsDirectory).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error })).filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
      const migrated = await readFile(join(this.snippetsDirectory, '.migrated'), 'utf8').then(() => true).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error })
      const value: unknown = migrated ? await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(this.snippetsDirectory, name), 'utf8')))) : JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!Array.isArray(value) || value.length > 5000) throw new Error('Snippet file is invalid.')
      return value.filter((item): item is UserSnippet => Boolean(item && typeof item === 'object' && typeof (item as UserSnippet).id === 'string' && typeof (item as UserSnippet).label === 'string' && typeof (item as UserSnippet).prefix === 'string' && typeof (item as UserSnippet).description === 'string' && typeof (item as UserSnippet).body === 'string' && typeof (item as UserSnippet).category === 'string' && (item as UserSnippet).scope === 'sql'))
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async save(value: Partial<UserSnippet>): Promise<UserSnippet> {
    const items = await this.list(); const existing = value.id ? items.find((item) => item.id === value.id) : undefined
    if (value.id && !existing) throw new Error('Snippet not found.')
    const data = validateSnippet(value, items, value.id)
    const saved: UserSnippet = { ...data, id: existing?.id ?? randomUUID() }
    await this.write([...items.filter((item) => item.id !== saved.id), saved]); return saved
  }
  async delete(id: string): Promise<void> { const items = await this.list(); if (!items.some((item) => item.id === id)) throw new Error('Snippet not found.'); await this.write(items.filter((item) => item.id !== id)) }
  async import(json: string): Promise<number> {
    if (Buffer.byteLength(json, 'utf8') > 5 * 1024 * 1024) throw new Error('Snippet import exceeds the 5 MB safety limit.')
    let parsed: unknown
    try { parsed = JSON.parse(json) } catch { throw new Error('Snippet JSON is invalid.') }
    if (!Array.isArray(parsed) || parsed.length > 5000) throw new Error('Snippet JSON must contain a list of at most 5000 snippets.')
    const existing = await this.list(); const prefixes = new Set(existing.map((item) => item.prefix.toLowerCase())); const imported: UserSnippet[] = []
    for (const item of parsed) { const data = validateSnippet(item, [...existing, ...imported]); const key = data.prefix.toLowerCase(); if (prefixes.has(key)) throw new Error(`Snippet prefix ${data.prefix} conflicts with an existing snippet.`); prefixes.add(key); imported.push({ ...data, id: randomUUID() }) }
    await this.write([...existing, ...imported]); return imported.length
  }
  async export(): Promise<string> { return `${JSON.stringify(await this.list(), null, 2)}\n` }
  private async write(items: UserSnippet[]): Promise<void> {
    await mkdir(this.snippetsDirectory, { recursive: true, mode: 0o700 })
    await writeFile(join(this.snippetsDirectory, '.migrated'), '1\n', { mode: 0o600 })
    const wanted = new Set(items.map((item) => `${item.id}.json`))
    for (const name of await readdir(this.snippetsDirectory)) if (/^[0-9a-f-]{36}\.json$/i.test(name) && !wanted.has(name)) await unlink(join(this.snippetsDirectory, name))
    for (const item of items) {
      if (!/^[0-9a-f-]{36}$/i.test(item.id)) throw new Error('Snippet id is invalid.')
      const target = join(this.snippetsDirectory, `${item.id}.json`); const temp = `${target}.${randomUUID()}.tmp`
      await writeFile(temp, `${JSON.stringify(item, null, 2)}\n`, { mode: 0o600 }); await rename(temp, target)
    }
  }
}
