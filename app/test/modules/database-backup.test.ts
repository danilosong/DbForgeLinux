import { mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDropObjectStatements, cleanupOwnedBackupFiles, createBackupSql, createBackupSqlWithOptions, decodeBackupFile, encodeBackupFile, encodeZipArchive, restoreBackup, splitBackupSql } from '../../src/modules/database-tools/backup.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const model: DatabaseModel = {
  kind: 'database', name: 'shop',
  tables: [{ kind: 'table', name: 'customers', createSql: 'CREATE TABLE `customers` (`id` int, `name` varchar(20));', columns: [], indexes: [], foreignKeys: [], checks: [] }],
  views: [{ kind: 'view', name: 'customer_names', createSql: 'CREATE VIEW `customer_names` AS SELECT `name` FROM `customers`;' }],
  procedures: [{ kind: 'procedure', name: 'refresh', createSql: 'CREATE DEFINER=`root`@`localhost` PROCEDURE `refresh`() BEGIN SELECT 1; SELECT 2; END;' }],
  functions: [], triggers: [], events: []
}

describe('database backup and restore', () => {
  it('creates export ZIP archives with a named entry and optional authenticated encryption', async () => {
    const contents = Buffer.from('rows,1\n')
    const zip = await encodeZipArchive(contents, 'customers.csv', { compressionLevel: 4, comment: 'export', password: '' })
    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
    const entryNameLength = zip.readUInt16LE(26)
    expect(zip.subarray(30, 30 + entryNameLength).toString()).toBe('customers.csv')
    const protectedArchive = await encodeZipArchive(contents, 'customers.csv', { compressionLevel: 4, comment: '', password: 'safe-pass' })
    expect(protectedArchive.readUInt32LE(0)).toBe(0x04034b50)
    expect(protectedArchive.includes(Buffer.from([0x01, 0x99]))).toBe(true)
    expect(protectedArchive.includes(contents)).toBe(false)
  })
  it('drops target objects in dependency-safe order and escapes identifiers', () => {
    const statements = buildDropObjectStatements('target`db', [
      { kind: 'table', name: 'detail' }, { kind: 'view', name: 'v' }, { kind: 'trigger', name: 'tr' }, { kind: 'procedure', name: 'p' }
    ])
    expect(statements).toEqual([
      'DROP TRIGGER IF EXISTS `target``db`.`tr`',
      'DROP PROCEDURE IF EXISTS `target``db`.`p`',
      'DROP VIEW IF EXISTS `target``db`.`v`',
      'DROP TABLE IF EXISTS `target``db`.`detail`'
    ])
  })
  it('creates schema and data scripts with escaped values and delimiter-safe routines', async () => {
    const backup = await createBackupSql(model, true, async (_table, offset) => offset ? [] : [{ id: 1, name: "O'Hara" }, { id: 2, name: 'Second' }])
    expect(backup.rows).toBe(2); expect(backup.skipped).toEqual([])
    expect(backup.sql).toContain("'O''Hara'"); expect(backup.sql).toContain('DELIMITER $$')
    const statements = splitBackupSql(backup.sql)
    expect(statements.some((item) => item.includes('BEGIN SELECT 1; SELECT 2; END'))).toBe(true)
    expect(statements.filter((item) => item.startsWith('INSERT INTO'))).toHaveLength(2)
  })
  it('requires explicit destination confirmation and rejects destructive commands', async () => {
    const executed: string[] = []
    await expect(restoreBackup('shop', 'wrong', 'CREATE TABLE x (id int);', async (statement) => { executed.push(statement) })).rejects.toThrow('typing the destination')
    await expect(restoreBackup('shop', 'shop', 'DROP TABLE customers;', async (statement) => { executed.push(statement) })).rejects.toThrow('not allowed')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE `production`.`users` (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'INSERT INTO `production`.`users` VALUES (1);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE production/**/.users (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE /*!50000 production.users */ (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('executable SQL comments')
    await expect(restoreBackup('shop', 'shop', 'CREATE EVENT cleanup ON SCHEDULE EVERY 1 SECOND DO DROP TABLE customers;', async (statement) => { executed.push(statement) })).rejects.toThrow('not allowed')
    expect(executed).toEqual([])
  })
  it('omits scheduled events from portable backups so restoring cannot enable server jobs', async () => {
    const database = { ...model, events: [{ kind: 'event' as const, name: 'cleanup', createSql: 'CREATE EVENT cleanup ON SCHEDULE EVERY 1 DAY DO SELECT 1;' }] }
    const backup = await createBackupSql(database, false, async () => [])
    expect(backup.sql).not.toContain('CREATE EVENT')
    expect(backup.skipped).toContain('event cleanup (restore disabled for scheduled events)')
  })
  it('restores only approved statements and can continue after a statement error', async () => {
    const executed: string[] = []
    const report = await restoreBackup('shop', 'shop', 'CREATE TABLE a (id int); INSERT INTO a VALUES (1);', async (statement) => { executed.push(statement); if (statement.startsWith('CREATE')) throw new Error('already exists') }, true)
    expect(report).toEqual({ executed: 1, errors: [{ statement: 1, message: 'already exists' }] })
    expect(executed).toHaveLength(2)
  })
  it('supports object/content options, extended inserts, cancellation, and password protected ZIP archives', async () => {
    const backup = await createBackupSqlWithOptions(model, { includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: true, extendedInserts: true, charset: 'utf8mb4', errorPolicy: 'abort' }, async (_table, offset) => offset ? [] : [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }])
    expect(backup.rows).toBe(2); expect(backup.sql).toContain('START TRANSACTION;'); expect(backup.sql).toContain('COMMIT;'); expect(backup.sql).toContain('VALUES\n(1, \'One\'),\n(2, \'Two\')'); expect(backup.sql).not.toContain('CREATE VIEW')
    const archive = await encodeBackupFile(backup.sql, { zip: true, compressionLevel: 6, comment: 'unit test', password: 'strong-password' })
    expect(archive.readUInt32LE(0)).toBe(0x04034b50)
    await expect(decodeBackupFile(archive, 'strong-password')).resolves.toBe(backup.sql)
    await expect(decodeBackupFile(archive, 'wrong-password')).rejects.toThrow()
    const controller = new AbortController(); controller.abort()
    await expect(createBackupSqlWithOptions(model, { includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: false, extendedInserts: false, charset: 'utf8mb4', errorPolicy: 'abort' }, async () => [], controller.signal)).rejects.toThrow('cancelled')
  })
  it('stores a ZIP backup in a temporary file and reads the archive back', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dbfl-backup-'))
    try {
      const bytes = await encodeBackupFile('SET NAMES utf8mb4;\n', { zip: true, compressionLevel: 3, comment: '', password: '' })
      const path = join(directory, 'backup.zip'); await (await import('node:fs/promises')).writeFile(path, bytes, { mode: 0o600 })
      await expect(decodeBackupFile(await (await import('node:fs/promises')).readFile(path))).resolves.toBe('SET NAMES utf8mb4;\n')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('opens a password-protected WinZip AES-256 archive in 7-Zip', async () => {
    if (spawnSync('7z', ['-h'], { stdio: 'ignore' }).error) return
    const directory = await mkdtemp(join(tmpdir(), 'dbfl-zip-interop-'))
    try {
      const secret = Buffer.from('CREATE TABLE customers (id INT);\n')
      const archive = await encodeZipArchive(secret, 'backup.sql', { compressionLevel: 6, comment: 'interop', password: 'external-tool-passphrase' })
      const path = join(directory, 'interop.zip'); await writeFile(path, archive, { mode: 0o600 })
      const password = 'external-tool-passphrase'
      execFileSync('7z', ['t', '-bd', `-p${password}`, path], { env: { ...process.env, LC_ALL: 'C' }, stdio: 'pipe' })
      const listing = execFileSync('7z', ['l', '-slt', '-bd', `-p${password}`, path], { env: { ...process.env, LC_ALL: 'C' }, encoding: 'utf8', stdio: 'pipe' })
      expect(listing).toContain('AES-256')
      const extracted = execFileSync('7z', ['x', '-so', '-bd', `-p${password}`, path, 'backup.sql'], { env: { ...process.env, LC_ALL: 'C' }, encoding: 'buffer', stdio: 'pipe' })
      expect(extracted).toEqual(secret)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('retention deletes only assistant-owned regular files inside the selected folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dbfl-backup-retention-')); const directory = join(root, 'chosen'); await mkdir(directory)
    try {
      const old = join(directory, 'old.sql'); const recent = join(directory, 'recent.sql'); const newest = join(directory, 'newest.sql'); const outside = join(root, 'keep.sql'); const link = join(directory, 'linked.sql')
      await Promise.all([writeFile(old, 'old'), writeFile(recent, 'recent'), writeFile(newest, 'newest'), writeFile(outside, 'outside')]); await symlink(outside, link)
      const now = Date.now(); const older = new Date(now - 100 * 86_400_000); await utimes(old, older, older); await utimes(recent, new Date(now - 2_000), new Date(now - 2_000)); await utimes(newest, new Date(now), new Date(now))
      const result = await cleanupOwnedBackupFiles(directory, [old, recent, newest, outside, link, join(directory, 'missing.sql')], 30, 1)
      expect(result.paths).toEqual([outside, newest]); expect(result.deleted).toContain(recent); expect(result.deleted).not.toContain(outside); expect(await readFile(outside, 'utf8')).toBe('outside')
      await expect(readFile(old)).rejects.toThrow(); await expect(readFile(recent)).rejects.toThrow()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
