import type { EditorMetadata } from '../../shared/contracts/editor.js'

export class EditorMetadataCache {
  private readonly values = new Map<string, { value: EditorMetadata; expiresAt: number }>()
  private readonly pending = new Map<string, Promise<EditorMetadata>>()
  private readonly generations = new Map<string, number>()
  constructor(private readonly ttlMs = 30_000, private readonly now = Date.now) {}

  async get(connectionId: string, database: string, load: () => Promise<EditorMetadata>, refresh = false): Promise<EditorMetadata> {
    const key = `${connectionId}\0${database.toLowerCase()}`
    const cached = this.values.get(key)
    if (!refresh && cached && cached.expiresAt > this.now()) return cached.value
    if (!refresh) {
      const pending = this.pending.get(key)
      if (pending) return pending
    }
    const generation = this.generations.get(key) ?? 0
    const request = load().then((value) => { if ((this.generations.get(key) ?? 0) === generation) this.values.set(key, { value, expiresAt: this.now() + this.ttlMs }); return value }).finally(() => this.pending.delete(key))
    this.pending.set(key, request)
    return request
  }

  invalidate(connectionId: string, database?: string): void {
    const prefix = `${connectionId}\0`
    const keys = new Set([...this.values.keys(), ...this.pending.keys()])
    for (const key of keys) if (key.startsWith(prefix) && (!database || key === `${prefix}${database.toLowerCase()}`)) {
      this.values.delete(key)
      this.pending.delete(key)
      this.generations.set(key, (this.generations.get(key) ?? 0) + 1)
    }
  }
}
