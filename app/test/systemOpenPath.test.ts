import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateSystemOpenPath } from '../src/main/security/systemOpenPath.js'

describe('validated system open paths', () => {
  it('accepts regular output files and resolves their parent for Open folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dbforge-open-path-'))
    try {
      const output = join(root, 'report.csv')
      await writeFile(output, 'id\n1\n')
      expect(await validateSystemOpenPath(output, 'file')).toBe(output)
      expect(await validateSystemOpenPath(output, 'folder')).toBe(root)
      expect(await validateSystemOpenPath(root, 'folder')).toBe(root)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('rejects missing paths, wrong target types, and symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dbforge-open-path-'))
    try {
      const file = join(root, 'report.csv')
      const executable = join(root, 'launcher.desktop')
      const dir = join(root, 'output')
      await writeFile(file, 'data')
      await writeFile(executable, '[Desktop Entry]\nExec=sh -c true\n')
      await mkdir(dir)
      await symlink(file, join(root, 'linked.csv'))
      await expect(validateSystemOpenPath(join(root, 'missing'), 'file')).rejects.toThrow()
      await expect(validateSystemOpenPath(dir, 'file')).rejects.toThrow(/regular file/)
      await expect(validateSystemOpenPath(file, 'folder')).resolves.toBe(root)
      await expect(validateSystemOpenPath(join(root, 'linked.csv'), 'file')).rejects.toThrow(/symbolic link/)
      await expect(validateSystemOpenPath(executable, 'file')).rejects.toThrow(/supported output/)
      await expect(validateSystemOpenPath('', 'folder')).rejects.toThrow(/existing/)
      await expect(validateSystemOpenPath('relative.csv', 'file')).rejects.toThrow(/absolute/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
