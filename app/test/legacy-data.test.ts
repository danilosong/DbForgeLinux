import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyUserData } from '../src/main/legacyData.js'

describe('legacy user data migration', () => {
  it('copies portable files once, skips the vault and never overwrites new data', () => {
    const home = mkdtempSync(join(tmpdir(), 'tuxsql-legacy-'))
    const legacy = join(home, 'dbforge-linux')
    mkdirSync(join(legacy, 'vault'), { recursive: true })
    writeFileSync(join(legacy, 'connections.json'), '[1]')
    writeFileSync(join(legacy, 'settings.json'), 'old')
    writeFileSync(join(legacy, 'vault', 'secret'), 'x')
    const target = join(home, 'tuxsql')
    mkdirSync(target)
    writeFileSync(join(target, 'settings.json'), 'new')

    expect(migrateLegacyUserData(home, target).sort()).toEqual(['connections.json'])
    expect(readFileSync(join(target, 'connections.json'), 'utf8')).toBe('[1]')
    expect(readFileSync(join(target, 'settings.json'), 'utf8')).toBe('new')
    expect(existsSync(join(target, 'vault'))).toBe(false)
    expect(migrateLegacyUserData(home, target)).toEqual([])
  })
})
