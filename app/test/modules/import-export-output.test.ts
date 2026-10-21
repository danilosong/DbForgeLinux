import { mkdtemp, mkdir, symlink, utimes, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { decodeZipEntry, encodeZipArchive } from '../../src/modules/archive/index.js'
import { deleteExportFilesAfterConfirmation, deletePlannedExportFiles, planExportRetention } from '../../src/modules/data-export-import/exportRetention.js'

const temporaryDirectories: string[] = []
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'tuxsql-export-output-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('import/export output protections', () => {
  it('creates a password protected ZIP archive and rejects a wrong password', async () => {
    const archive = await encodeZipArchive(Buffer.from('private export'), 'customers.csv', { compressionLevel: 6, password: 'one-time-passphrase' })
    await expect(decodeZipEntry(archive, 'customers.csv', 'one-time-passphrase')).resolves.toBe('private export')
    await expect(decodeZipEntry(archive, 'customers.csv', 'wrong-passphrase')).rejects.toThrow()
  })

  it('plans retention only for matching regular files in the chosen output folder', async () => {
    const root = await temporaryDirectory()
    const output = join(root, 'current.csv')
    const old = join(root, 'orders_2020.csv')
    const unrelated = join(root, 'other_2020.csv')
    const outside = await temporaryDirectory()
    const outsideFile = join(outside, 'orders_2019.csv')
    await Promise.all([writeFile(output, 'current'), writeFile(old, 'old'), writeFile(unrelated, 'keep'), writeFile(outsideFile, 'outside')])
    await utimes(old, new Date(1), new Date(1))
    await symlink(outsideFile, join(root, 'orders_2018.csv'))

    const plan = await planExportRetention(output, { baseName: 'orders', extension: 'csv', maxAgeDays: 1 }, Date.now())
    expect(plan.files).toEqual([old])
    await expect(deleteExportFilesAfterConfirmation(plan, async () => false)).resolves.toBe(0)
    await expect(readFile(old, 'utf8')).resolves.toBe('old')
    await expect(deleteExportFilesAfterConfirmation(plan, async (pending) => pending.files.length === 1)).resolves.toBe(1)
    await expect(readFile(old)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(unrelated, 'utf8')).resolves.toBe('keep')
    await expect(readFile(outsideFile, 'utf8')).resolves.toBe('outside')
  })

  it('counts the newly exported file toward the quantity limit', async () => {
    const root = await temporaryDirectory()
    const current = join(root, 'orders_current.csv')
    const older = join(root, 'orders_older.csv')
    await writeFile(current, 'new')
    await writeFile(older, 'old')
    await utimes(older, new Date(1), new Date(1))
    const plan = await planExportRetention(current, { baseName: 'orders', extension: 'csv', keepCount: 1 })
    expect(plan.files).toEqual([older])
  })

  it('refuses a retention path outside the selected output folder', async () => {
    const root = await temporaryDirectory()
    const outside = await temporaryDirectory()
    const current = join(root, 'current.csv')
    const victim = join(outside, 'keep.csv')
    await mkdir(root, { recursive: true })
    await writeFile(current, 'current')
    await writeFile(victim, 'keep')
    await expect(deletePlannedExportFiles({ directory: root, files: [victim] })).rejects.toThrow('inside the selected export folder')
    await expect(readFile(victim, 'utf8')).resolves.toBe('keep')
  })
})
