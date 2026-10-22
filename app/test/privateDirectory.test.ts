import { describe, expect, it } from 'vitest'
import { chmod, mkdir, mkdtemp, rm, stat, symlink, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensurePrivateDirectory } from '../src/main/security/privateDirectory.js'

describe('private profile directory', () => {
  it('creates a missing profile directory as 0700 even under umask 002', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-private-dir-'))
    const previous = process.umask(0o002)
    try {
      const profile = join(root, 'config', 'tuxsql')
      ensurePrivateDirectory(profile)
      expect((await stat(profile)).mode & 0o777).toBe(0o700)
    } finally { process.umask(previous); await rm(root, { recursive: true, force: true }) }
  })

  it('tightens an existing group-writable profile without touching its files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-private-dir-'))
    try {
      const profile = join(root, 'tuxsql')
      await mkdir(profile); await chmod(profile, 0o775)
      await writeFile(join(profile, 'connections.json'), '[]', { mode: 0o600 })
      ensurePrivateDirectory(profile)
      expect((await stat(profile)).mode & 0o777).toBe(0o700)
      expect(await readFile(join(profile, 'connections.json'), 'utf8')).toBe('[]')
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('follows a symlinked profile (moved to another disk) and tightens its target', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-private-dir-'))
    try {
      await mkdir(join(root, 'elsewhere')); await chmod(join(root, 'elsewhere'), 0o775)
      await symlink(join(root, 'elsewhere'), join(root, 'tuxsql'))
      ensurePrivateDirectory(join(root, 'tuxsql'))
      expect((await stat(join(root, 'elsewhere'))).mode & 0o777).toBe(0o700)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
