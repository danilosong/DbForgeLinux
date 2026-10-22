import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import v8 from 'node:v8'
import vm from 'node:vm'
import { DEFAULT_MAX_SCRIPT_STATEMENT_BYTES, executeLargeScript, scanLargeScript } from '../../src/modules/database-tools/largeScript.js'

// Forced GC makes the heap baseline repeatable; without it leftover garbage hides or inflates the peak.
v8.setFlagsFromString('--expose_gc')
const gc = vm.runInNewContext('gc') as () => void
const MB = 1024 * 1024

/** One mysqldump-style extended INSERT on a single line: many short tuples, the worst case for per-piece concatenation. */
async function writeExtendedInsert(path: string, targetBytes: number, statements = 1): Promise<number> {
  const handle = await open(path, 'w')
  let total = 0
  try {
    for (let statement = 0; statement < statements; statement++) {
      let size = 0; let index = 0; let batch: string[] = []
      await handle.write('INSERT INTO `orders` VALUES ')
      while (size < targetBytes) {
        const row = `(${index},'customer ${index}','2026-10-22 00:00:00',${index * 3}.50)`
        index++; batch.push(row); size += row.length + 1
        if (batch.length === 5000) { await handle.write(`${batch.join(',')},`); batch = [] }
      }
      await handle.write(`${batch.join(',')},(0,NULL,NULL,0);\n`)
      total += size
    }
  } finally { await handle.close() }
  return total
}

async function measure(run: () => Promise<void>): Promise<number> {
  gc(); gc()
  const before = process.memoryUsage().heapUsed
  let peak = before
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed) }, 2)
  try { await run() } finally { clearInterval(timer) }
  return Math.max(peak, process.memoryUsage().heapUsed) - before
}

describe('Execute Large Script memory', () => {
  let dir = ''
  let path = ''
  let length = 0
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-memory-'))
    path = join(dir, 'extended.sql')
    length = await writeExtendedInsert(path, 50 * MB)
  }, 120_000)
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

  it('defaults the statement cap to 64 MB (still configurable up to 1 GiB)', () => {
    expect(DEFAULT_MAX_SCRIPT_STATEMENT_BYTES).toBe(64 * MB)
  })

  it('peaks below 3x a 50 MB extended INSERT with the new and the old cap (was ~6.9x before the fix)', async () => {
    for (const maxStatementBytes of [undefined, 256 * MB]) {
      let executed = { start: '', end: '', size: 0 }
      let peak = 0
      const delta = await measure(async () => {
        await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, maxStatementBytes, execute: async (sql) => { peak = process.memoryUsage().heapUsed; executed = { start: sql.slice(0, 29), end: sql.slice(-16), size: sql.length } }, onProgress: () => undefined, onError: async () => 'continue' })
      })
      expect(executed.start).toBe('INSERT INTO `orders` VALUES (')
      expect(executed.end).toBe(',(0,NULL,NULL,0)')
      expect(executed.size).toBeGreaterThan(length)
      expect(peak).toBeGreaterThan(0)
      expect(delta / length, `cap ${maxStatementBytes ?? 'default'}: ${(delta / MB).toFixed(0)} MB`).toBeLessThan(3)
    }
  }, 120_000)

  it('the pre-check scan of the same statement also stays below 3x', async () => {
    const delta = await measure(async () => { await scanLargeScript({ path, encoding: 'utf8', databaseSelected: false }) })
    expect(delta / length, `${(delta / MB).toFixed(0)} MB`).toBeLessThan(3)
  }, 120_000)

  it('rejects a statement above the new default cap with a clear error that echoes no content', async () => {
    const oversized = join(dir, 'oversized.sql')
    await writeExtendedInsert(oversized, 65 * MB)
    const executed: string[] = []
    const failure = executeLargeScript({ path: oversized, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { executed.push(sql) }, onProgress: () => undefined, onError: async () => 'continue' })
    await expect(failure).rejects.toThrow(`Statement exceeds the configured limit (${64 * MB} bytes)`)
    const message = await failure.catch((error: Error) => error.message)
    expect(message).toMatch(/line 1, column \d+\.$/)
    expect(message).not.toMatch(/customer|INSERT|orders/)
    expect(executed).toEqual([])
    await rm(oversized, { force: true })
  }, 120_000)

  it('does not keep failed statements alive through the error excerpt', async () => {
    const failing = join(dir, 'failing.sql')
    const each = await writeExtendedInsert(failing, 20 * MB, 3)
    gc(); gc()
    const before = process.memoryUsage().heapUsed
    const report = await executeLargeScript({ path: failing, encoding: 'utf8', databaseSelected: false, execute: async () => { throw new Error('Duplicate entry') }, onProgress: () => undefined, onError: async () => 'continue' })
    gc(); gc()
    const retained = process.memoryUsage().heapUsed - before
    expect(report.errors).toHaveLength(3)
    expect(report.errors.every((error) => error.sql.length === 2000)).toBe(true)
    // Three 20 MB statements would be ~60 MB if the 2000-character excerpts still pointed at them.
    expect(retained, `${(retained / MB).toFixed(1)} MB retained for ${(each / MB).toFixed(0)} MB of failed SQL`).toBeLessThan(8 * MB)
    await rm(failing, { force: true })
  }, 120_000)
})
