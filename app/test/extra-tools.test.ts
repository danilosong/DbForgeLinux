import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SchemaUpdateStore, isDestructiveSchemaScript, splitSchemaScript } from '../src/modules/schema-update/index.js'
import { UserSnippetStore, validateSnippet } from '../src/modules/editor/snippetStore.js'
import { BackupScheduleStore, cronMatches, scheduledBackupPath, validateBackupSchedule, validateCron } from '../src/modules/database-tools/scheduler.js'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })
async function temp(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'dbforge-extra-')); dirs.push(path); return path }

describe('schema update queue', () => {
  it('persists scripts, marks destructive statements and splits queued SQL', async () => {
    const store = new SchemaUpdateStore(join(await temp(), 'queue.json'))
    const item = await store.add({ connectionId: 'c1', database: 'shop', source: 'Designer', script: "ALTER TABLE `t` ADD `x` varchar(20) DEFAULT 'a;b';\nDROP TABLE `old`;" })
    expect(item.destructive).toBe(true)
    expect(splitSchemaScript(item.script)).toEqual(["ALTER TABLE `t` ADD `x` varchar(20) DEFAULT 'a;b';", 'DROP TABLE `old`;'])
    expect(isDestructiveSchemaScript('TRUNCATE TABLE t')).toBe(true)
    expect((await new SchemaUpdateStore(store.filePath).list())[0]?.id).toBe(item.id)
  })
  it('rejects empty and unbounded queue entries', async () => {
    const store = new SchemaUpdateStore(join(await temp(), 'queue.json'))
    await expect(store.add({ connectionId: '', database: 'x', source: 'x', script: 'SELECT 1' })).rejects.toThrow()
  })
})

describe('user SQL snippets', () => {
  it('creates, exports, imports and deletes snippets with validated placeholders', async () => {
    const store = new UserSnippetStore(join(await temp(), 'snippets.json'))
    const saved = await store.save({ label: 'Select by id', prefix: 'selid', description: 'Lookup', body: 'SELECT * FROM ${1:table} WHERE id = ${2};$0' })
    expect((await store.list())[0]?.body).toContain('${1:table}')
    const copy = new UserSnippetStore(join(await temp(), 'copy.json'))
    expect(await copy.import(await store.export())).toBe(1)
    await copy.delete((await copy.list())[0]!.id)
    expect(await copy.list()).toEqual([])
    await expect(store.save({ label: 'Dup', prefix: 'SELID', body: 'SELECT 1' })).rejects.toThrow(/already in use/i)
    expect(() => validateSnippet({ label: 'Invalid', prefix: 'bad', body: '${foo}' })).toThrow()
    await store.delete(saved.id)
  })
})

describe('local backup scheduler', () => {
  it('validates cron, matches local schedule, persists it and sanitizes output names', async () => {
    expect(validateCron('*/15 2 * * 1-5')).toBe('*/15 2 * * 1-5')
    expect(cronMatches('*/15 2 * * *', new Date(2026, 0, 5, 2, 30))).toBe(true)
    expect(cronMatches('*/15 2 * * *', new Date(2026, 0, 5, 3, 0))).toBe(false)
    expect(cronMatches('0 0 * * 7', new Date(2026, 0, 4, 0, 0))).toBe(true)
    expect(cronMatches('0 0 1 * 0', new Date(2026, 0, 4, 0, 0))).toBe(true)
    expect(() => validateCron('61 * * * *')).toThrow()
    const directory = await temp(); const store = new BackupScheduleStore(join(directory, 'schedules.json'))
    const saved = await store.save({ connectionId: 'c1', database: 'shop/test', directory, cron: '0 3 * * *', retention: 4, enabled: true })
    expect((await store.list())[0]?.id).toBe(saved.id)
    expect((await readFile(store.filePath, 'utf8'))).not.toContain('password')
    expect(scheduledBackupPath(directory, 'shop/test', new Date('2026-02-03T04:05:06.000Z'))).toContain('shop_test-2026-02-03T04-05-06-000Z.sql')
    await store.delete(saved.id)
    expect(await store.list()).toEqual([])
  })
  it('rejects relative paths and invalid retention', () => {
    expect(() => validateBackupSchedule({ connectionId: 'c', database: 'd', directory: 'relative', cron: '* * * * *', retention: 1 })).toThrow()
    expect(() => validateBackupSchedule({ connectionId: 'c', database: 'd', directory: '/tmp', cron: '* * * * *', retention: 0 })).toThrow()
  })
})
