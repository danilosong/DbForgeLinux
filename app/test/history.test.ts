import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { redactSqlSecrets, SqlExecutionHistoryStore } from '../src/main/history/SqlExecutionHistoryStore.js'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

async function createStore(): Promise<{ directory: string; path: string; store: SqlExecutionHistoryStore }> {
  const directory = await mkdtemp(join(tmpdir(), 'dbforge-history-'))
  directories.push(directory)
  const path = join(directory, 'sql-history.json')
  return { directory, path, store: new SqlExecutionHistoryStore(path) }
}

describe('SQL execution history store', () => {
  it('persists searchable execution records and redacts SQL credentials', async () => {
    const { path, store } = await createStore()
    await store.record({ id: '1', timestamp: '2026-10-20T12:00:00.000Z', connection: 'dev', database: 'shop', sql: "CREATE USER 'app'@'%' IDENTIFIED BY 'secret'; SET PASSWORD = 'other-secret'", elapsedMs: 24, success: false, error: "failed with password='error-secret'" })
    const stored = await readFile(path, 'utf8')
    expect(stored).not.toContain('secret')
    expect(stored).not.toContain('error-secret')
    expect(redactSqlSecrets("SELECT 'ok'; mysql://user:pass@host/db")).toContain('mysql://user:****@host/db')
    const results = await new SqlExecutionHistoryStore(path).list({ search: 'secret' })
    expect(results).toHaveLength(0)
    const found = await store.list({ search: 'CREATE USER' })
    expect(found[0]?.sql).toContain("IDENTIFIED BY '****'")
    expect(found[0]?.sql).toContain("PASSWORD = '****'")
    expect(found[0]?.success).toBe(false)
  })

  it('replaces duplicate ids and enforces a bounded newest-first result', async () => {
    const { store } = await createStore()
    await store.record({ id: 'a', timestamp: '2026-10-20T12:00:00.000Z', connection: 'one', sql: 'SELECT 1', elapsedMs: 2, success: true })
    await store.record({ id: 'a', timestamp: '2026-10-20T12:01:00.000Z', connection: 'one', sql: 'SELECT 2', elapsedMs: 3, success: true })
    await store.record({ id: 'b', timestamp: '2026-10-20T12:02:00.000Z', connection: 'two', sql: 'SELECT 3', elapsedMs: 4, success: true })
    expect((await store.list({ limit: 1 }))[0]?.sql).toBe('SELECT 3')
    expect((await store.list()).filter((item) => item.id === 'a')).toHaveLength(1)
    expect((await store.list()).find((item) => item.id === 'a')?.sql).toBe('SELECT 2')
  })
})
