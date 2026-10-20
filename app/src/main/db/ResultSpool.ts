import { createReadStream } from 'node:fs'
import { mkdir, open, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'

const BLOCK_SIZE = 256
const MAX_PAGE_SIZE = 500

/** Disk-backed query rows. Only one sparse byte offset per block is kept in memory. */
export class ResultSpool {
  private readonly offsets: number[] = []
  private count = 0
  private bytes = 0
  private pending: string[] = []
  private closed = false
  private constructor(readonly id: string, readonly path: string, private readonly handle: Awaited<ReturnType<typeof open>>) {}

  static async create(directory: string): Promise<ResultSpool> {
    const id = randomUUID()
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const path = join(directory, `${id}.jsonl`)
    return new ResultSpool(id, path, await open(path, 'wx', 0o600))
  }

  get rowCount(): number { return this.count }
  get sizeBytes(): number { return this.bytes }

  async append(row: Record<string, unknown>): Promise<void> {
    if (this.closed) throw new Error('Result spool is closed.')
    if (this.count % BLOCK_SIZE === 0) this.offsets.push(this.bytes)
    const line = `${JSON.stringify(row, (_key, value: unknown) => {
      if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { $dbforgeBinary: Buffer.from(value).toString('base64') }
      if (value && typeof value === 'object' && (value as { type?: string }).type === 'Buffer' && Array.isArray((value as { data?: unknown }).data)) return { $dbforgeBinary: Buffer.from((value as { data: number[] }).data).toString('base64') }
      if (value instanceof Date) return { $dbforgeDate: value.toISOString() }
      if (typeof value === 'bigint') return { $dbforgeBigInt: value.toString() }
      return value
    })}\n`
    this.pending.push(line)
    this.bytes += Buffer.byteLength(line, 'utf8')
    this.count++
    if (this.count % BLOCK_SIZE === 0) await this.flush()
  }

  async read(offset: number, limit: number): Promise<Array<Record<string, unknown>>> {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > MAX_PAGE_SIZE) throw new Error('Invalid result page range.')
    if (offset >= this.count || limit === 0) return []
    await this.flush()
    await this.handle.sync()
    const startRow = Math.floor(offset / BLOCK_SIZE) * BLOCK_SIZE
    const startByte = this.offsets[Math.floor(offset / BLOCK_SIZE)] ?? 0
    const stream = createReadStream(this.path, { start: startByte })
    const lines = createInterface({ input: stream, crlfDelay: Infinity })
    const result: Array<Record<string, unknown>> = []
    let rowIndex = startRow
    try {
      for await (const line of lines) {
        if (rowIndex >= offset && result.length < limit) result.push(JSON.parse(line, (_key, value: unknown) => {
          if (value && typeof value === 'object' && '$dbforgeBinary' in value) return Buffer.from(String((value as { $dbforgeBinary: string }).$dbforgeBinary), 'base64')
          if (value && typeof value === 'object' && '$dbforgeDate' in value) return new Date(String((value as { $dbforgeDate: string }).$dbforgeDate))
          if (value && typeof value === 'object' && '$dbforgeBigInt' in value) return BigInt(String((value as { $dbforgeBigInt: string }).$dbforgeBigInt))
          return value
        }) as Record<string, unknown>)
        rowIndex++
        if (result.length >= limit) { lines.close(); stream.destroy(); break }
      }
    } finally { lines.close(); stream.destroy() }
    return result
  }

  async dispose(): Promise<void> {
    if (this.closed) return
    await this.flush()
    this.closed = true
    await this.handle.close()
    await rm(this.path, { force: true })
  }

  private async flush(): Promise<void> {
    if (!this.pending.length) return
    const data = this.pending.join('')
    this.pending = []
    await this.handle.write(data, undefined, 'utf8')
  }
}

export class ResultSpoolRegistry {
  private readonly spools = new Map<string, ResultSpool>()
  constructor(private readonly directory: string) {}
  async cleanStaleFiles(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) await rm(join(this.directory, entry.name), { force: true })
    }
  }
  async create(): Promise<ResultSpool> {
    const spool = await ResultSpool.create(this.directory)
    this.spools.set(spool.id, spool)
    return spool
  }
  get(id: string): ResultSpool | undefined { return this.spools.get(id) }
  async dispose(id: string): Promise<void> {
    const spool = this.spools.get(id)
    this.spools.delete(id)
    await spool?.dispose()
  }
  async disposeAll(): Promise<void> { await Promise.all([...this.spools.keys()].map((id) => this.dispose(id))) }
  async diskUsage(): Promise<number> {
    let total = 0
    for (const spool of this.spools.values()) total += (await stat(spool.path)).size
    return total
  }
}
