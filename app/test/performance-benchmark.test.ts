import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterAll, describe, expect, it } from 'vitest'
import { ResultSpool } from '../src/main/db/ResultSpool.js'
import { exportData } from '../src/modules/data-export-import/export.js'
import { splitSqlStatements } from '../src/shared/sqlStatements.js'

const directoryPromise = mkdtemp(join(tmpdir(), 'dbforge-perf-'))
const rssMb = (): number => Math.round(process.memoryUsage().rss / 1024 / 1024)
function monitorRss(): { startMb: number; peakMb(): number; stop(): void } {
  const startMb = rssMb(); let peak = startMb
  const timer = setInterval(() => { peak = Math.max(peak, rssMb()) }, 20)
  return { startMb, peakMb: () => peak, stop: () => clearInterval(timer) }
}

afterAll(async () => rm(await directoryPromise, { recursive: true, force: true }))

describe('performance baselines (run with pnpm perf:benchmark)', () => {
  it('parses 10k SQL statements', async () => {
    const sql = Array.from({ length: 10_000 }, (_, index) => `UPDATE bench SET value = ${index} WHERE id = ${index}`).join(';\n') + ';'
    const started = performance.now()
    const parsed = splitSqlStatements(sql)
    const elapsedMs = Math.round(performance.now() - started)
    console.log(JSON.stringify({ benchmark: 'sql-script-10k', statements: parsed.length, elapsedMs, inputBytes: Buffer.byteLength(sql) }))
    expect(parsed).toHaveLength(10_000)
  }, 60_000)

  it('spools one million rows and reads viewport-sized pages', async () => {
    const directory = await directoryPromise
    const memory = monitorRss()
    const started = performance.now()
    const spool = await ResultSpool.create(directory)
    for (let index = 0; index < 1_000_000; index++) await spool.append({ id: index, name: `row-${index}`, amount: index / 100 })
    const writeMs = Math.round(performance.now() - started)
    const pageStarted = performance.now()
    let pageRowsRead = 0
    for (const offset of [0, 250_000, 500_000, 750_000, 999_900]) pageRowsRead += (await spool.read(offset, 100)).length
    const fivePageReadMs = Math.round(performance.now() - pageStarted)
    memory.stop()
    console.log(JSON.stringify({ benchmark: 'result-grid-1m', rows: spool.rowCount, spoolMb: Math.round(spool.sizeBytes / 1024 / 1024), writeMs, fivePageReadMs, pageRowsRead, sparseIndexEntries: Math.ceil(spool.rowCount / 256), rssStartMb: memory.startMb, rssPeakMb: memory.peakMb(), rssDeltaMb: memory.peakMb() - memory.startMb }))
    expect(spool.rowCount).toBe(1_000_000)
    expect(pageRowsRead).toBe(500)
    await spool.dispose()
  }, 120_000)

  it('exports one million CSV rows as a stream', async () => {
    const path = join(await directoryPromise, 'one-million.csv')
    const memory = monitorRss()
    const started = performance.now()
    const driver = { async *streamRows() { for (let index = 0; index < 1_000_000; index++) yield { id: index, name: `row-${index}`, amount: index / 100 } } }
    const report = await exportData({ driver, connectionId: 'synthetic', query: 'SELECT id,name,amount', format: 'csv', destination: createWriteStream(path) })
    const elapsedMs = Math.round(performance.now() - started)
    const file = await stat(path)
    memory.stop()
    console.log(JSON.stringify({ benchmark: 'export-csv-1m', rows: report.rows, outputMb: Math.round(file.size / 1024 / 1024), elapsedMs, rssStartMb: memory.startMb, rssPeakMb: memory.peakMb(), rssDeltaMb: memory.peakMb() - memory.startMb }))
    expect(report.rows).toBe(1_000_000)
    expect(file.size).toBeGreaterThan(1_000_000)
  }, 120_000)
})
