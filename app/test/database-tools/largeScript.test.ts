import { describe, expect, it } from 'vitest'
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeLargeScript } from '../../src/modules/database-tools/largeScript.js'

describe('large script streaming', () => {
  it('splits quoted statements, skips database switching when a target is selected, and continues errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'script.sql')
      await writeFile(path, "USE other;\nCREATE DATABASE x;\nINSERT INTO t VALUES ('a;b');\nBAD;\nSELECT 2;", 'utf8')
      const ran: string[] = []
      const result = await executeLargeScript({ path, encoding: 'utf8', databaseSelected: true, execute: async (sql) => { if (sql === 'BAD') throw new Error('bad statement'); ran.push(sql) }, onProgress: () => undefined, onError: async () => 'continue' })
      expect(ran).toEqual(["INSERT INTO t VALUES ('a;b')", 'SELECT 2'])
      expect(result.skipped).toBe(2)
      expect(result.errors).toHaveLength(1)
      expect(result.statements).toBe(3)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('stops after a stop decision', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'script.sql'); await writeFile(path, 'BAD; SELECT 2;', 'utf8')
      const ran: string[] = []
      const result = await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { ran.push(sql); throw new Error('failure') }, onProgress: () => undefined, onError: async () => 'stop' })
      expect(result.stopped).toBe(true); expect(ran).toEqual(['BAD'])
      expect((await readFile(path, 'utf8')).length).toBeGreaterThan(0)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('supports Ignore All without asking again and aborts the stream', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'script.sql'); await writeFile(path, 'BAD;SELECT 2;SELECT 3;', 'utf8')
      let prompts = 0; const ran: string[] = []
      const result = await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { ran.push(sql); if (sql === 'BAD') throw new Error('failure') }, onProgress: () => undefined, onError: async () => { prompts++; return 'ignore-all' } })
      expect(prompts).toBe(1); expect(ran).toEqual(['BAD', 'SELECT 2', 'SELECT 3']); expect(result.errors).toHaveLength(1)
      const controller = new AbortController(); controller.abort(); ran.length = 0
      const canceled = await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, signal: controller.signal, execute: async (sql) => { ran.push(sql) }, onProgress: () => undefined, onError: async () => 'stop' })
      expect(canceled.stopped).toBe(true); expect(ran).toEqual([])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('decodes selected Windows-1252 text', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'script.sql'); await writeFile(path, Buffer.from("SELECT 'café';", 'latin1'))
      const ran: string[] = []
      await executeLargeScript({ path, encoding: 'latin1', databaseSelected: false, execute: async (sql) => { ran.push(sql) }, onProgress: () => undefined, onError: async () => 'stop' })
      expect(ran).toEqual(["SELECT 'café'"])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('uses custom DELIMITER for stored routines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'routine.sql')
      await writeFile(path, 'DELIMITER $$\nCREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END$$\nDELIMITER ;\nSELECT 3;')
      const ran: string[] = []
      await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { ran.push(sql) }, onProgress: () => undefined, onError: async () => 'stop' })
      expect(ran).toEqual(['CREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END', 'SELECT 3'])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('streams a 50 MB single-line extended insert within measured memory bounds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'extended.sql')
      const handle = await open(path, 'w')
      const block = 'x'.repeat(1024 * 1024)
      try {
        await handle.write("INSERT INTO t VALUES ('")
        for (let index = 0; index < 50; index++) await handle.write(block)
        await handle.write("');")
      } finally { await handle.close() }
      const before = process.memoryUsage()
      let actualLength = 0
      await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { actualLength = sql.length; expect(sql.startsWith("INSERT INTO t VALUES ('x")).toBe(true); expect(sql.endsWith("x');")).toBe(true) }, onProgress: () => undefined, onError: async () => 'stop' })
      const after = process.memoryUsage()
      expect(actualLength).toBeGreaterThan(50 * 1024 * 1024)
      expect(actualLength).toBeLessThan(50 * 1024 * 1024 + 64)
      expect(after.heapUsed - before.heapUsed).toBeLessThan(200 * 1024 * 1024)
    } finally { await rm(dir, { recursive: true, force: true }) }
  }, 60_000)
  it('rejects an oversized statement with file position and without SQL text', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'too-large.sql')
      await writeFile(path, `INSERT INTO t VALUES ('${'SENSITIVE_LITERAL'.repeat(200)}');`)
      await expect(executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, maxStatementBytes: 1024, execute: async () => { throw new Error('must not execute') }, onProgress: () => undefined, onError: async () => 'stop' }))
        .rejects.toThrow(new RegExp(`Statement exceeds the configured limit.*${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*line 1, column`))
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('destroys the input stream and returns when the signal aborts during execution', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-script-'))
    try {
      const path = join(dir, 'cancel.sql'); await writeFile(path, 'SELECT 1;SELECT 2;')
      const controller = new AbortController(); let statements = 0
      const resultPromise = executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, signal: controller.signal, execute: async () => {
        statements++
        await new Promise<void>((resolve) => controller.signal.addEventListener('abort', () => resolve(), { once: true }))
      }, onProgress: () => undefined, onError: async () => 'stop' })
      setTimeout(() => controller.abort(), 10)
      const result = await resultPromise
      expect(result.stopped).toBe(true)
      expect(statements).toBe(1)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
