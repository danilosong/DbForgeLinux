import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readBoundedRegularFile } from '../../src/modules/security/boundedFile.js'

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('bounded file reader', () => {
  it('enforces byte limits and refuses symlink inputs', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'dbforge-bounded-file-')); folders.push(folder)
    const file = join(folder, 'input.json'); const link = join(folder, 'link.json')
    await writeFile(file, '12345'); await symlink(file, link)
    await expect(readBoundedRegularFile(file, 4)).rejects.toThrow(/limit/i)
    await expect(readBoundedRegularFile(link, 10)).rejects.toThrow()
    expect((await readBoundedRegularFile(file, 5)).toString()).toBe('12345')
  })
})
