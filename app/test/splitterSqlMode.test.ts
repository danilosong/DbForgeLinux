import { describe, expect, it } from 'vitest'
import { withSplitterCompatibleSqlMode, withoutNoBackslashEscapes } from '../src/main/db/splitterSqlMode.js'
import { splitBackupSql } from '../src/modules/database-tools/splitSql.js'

describe('splitter-compatible SQL mode', () => {
  it('removes only NO_BACKSLASH_ESCAPES and restores the original mode after parsing-compatible execution', async () => {
    const original = 'STRICT_TRANS_TABLES, NO_BACKSLASH_ESCAPES,ANSI_QUOTES'
    let mode = original
    const calls: string[] = []
    const script = "INSERT INTO `shop`.`names` VALUES ('O\\'Brien');"
    await withSplitterCompatibleSqlMode(async () => mode, async (next) => { calls.push(next); mode = next }, async () => {
      expect(mode).toBe('STRICT_TRANS_TABLES,ANSI_QUOTES')
      expect(splitBackupSql(script)).toHaveLength(1)
      expect(script).toContain("\\'")
    })
    expect(calls).toEqual(['STRICT_TRANS_TABLES,ANSI_QUOTES', original])
    expect(mode).toBe(original)
    expect(withoutNoBackslashEscapes('NO_BACKSLASH_ESCAPES')).toBe('')
  })

  it('refuses execution if the server keeps NO_BACKSLASH_ESCAPES enabled', async () => {
    const mode = 'STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES'
    await expect(withSplitterCompatibleSqlMode(async () => mode, async () => undefined, async () => 'executed')).rejects.toThrow(/Could not disable NO_BACKSLASH_ESCAPES/)
    expect(mode).toContain('NO_BACKSLASH_ESCAPES')
  })
})
