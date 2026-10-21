import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatSqlFiles } from '../../src/modules/editor/batchFormatter.js'

describe('batch SQL formatter', () => {
  it('writes a backup and atomically formats only SQL files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-format-'))
    try {
      const sql = join(dir, 'query.sql'); const other = join(dir, 'notes.txt')
      await writeFile(sql, 'select a,b from t where id=1;', 'utf8'); await writeFile(other, 'keep', 'utf8')
      const result = await formatSqlFiles({ paths: [dir], backup: true })
      expect(result).toHaveLength(1); expect(result[0]?.changed).toBe(true)
      expect(await readFile(`${sql}.bak`, 'utf8')).toBe('select a,b from t where id=1;')
      expect(await readFile(sql, 'utf8')).toContain('SELECT')
      expect(await readFile(other, 'utf8')).toBe('keep')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('rejects a selected symlink root before formatting its target', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dbforge-format-link-'))
    try {
      const target = join(dir, 'target'); const link = join(dir, 'selected')
      await mkdir(target); await writeFile(join(target, 'query.sql'), 'select 1;'); await symlink(target, link)
      await expect(formatSqlFiles({ paths: [link], backup: false, recursive: true })).rejects.toThrow(/symbolic link/i)
      expect(await readFile(join(target, 'query.sql'), 'utf8')).toBe('select 1;')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
