import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeLargeScript } from '../../src/modules/database-tools/largeScript.js'

describe('large script streaming', () => {
  it('splits quoted statements, skips database switching when a target is selected, and continues errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-large-script-'))
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
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-large-script-'))
    try {
      const path = join(dir, 'script.sql'); await writeFile(path, 'BAD; SELECT 2;', 'utf8')
      const ran: string[] = []
      const result = await executeLargeScript({ path, encoding: 'utf8', databaseSelected: false, execute: async (sql) => { ran.push(sql); throw new Error('failure') }, onProgress: () => undefined, onError: async () => 'stop' })
      expect(result.stopped).toBe(true); expect(ran).toEqual(['BAD'])
      expect((await readFile(path, 'utf8')).length).toBeGreaterThan(0)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
