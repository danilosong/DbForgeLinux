import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResultSpool } from '../src/main/db/ResultSpool.js'

describe('ResultSpool', () => {
  let directory = ''
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })

  it('writes rows on disk and reads bounded pages across sparse-index blocks', async () => {
    directory = await mkdtemp(join(tmpdir(), 'tuxsql-results-'))
    const spool = await ResultSpool.create(directory)
    for (let index = 0; index < 700; index++) await spool.append({ id: index, text: `row-${index}` })
    expect(spool.rowCount).toBe(700)
    expect(await spool.read(251, 4)).toEqual([{ id: 251, text: 'row-251' }, { id: 252, text: 'row-252' }, { id: 253, text: 'row-253' }, { id: 254, text: 'row-254' }])
    expect(await spool.read(698, 10)).toEqual([{ id: 698, text: 'row-698' }, { id: 699, text: 'row-699' }])
    await expect(spool.read(0, 501)).rejects.toThrow(/Invalid result page/)
    const path = spool.path
    await spool.dispose()
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps an encrypted safe value out of serialized row text', async () => {
    directory = await mkdtemp(join(tmpdir(), 'tuxsql-results-'))
    const spool = await ResultSpool.create(directory)
    await spool.append({ value: Buffer.from('binary payload') })
    expect((await readFile(spool.path, 'utf8'))).not.toContain('binary payload')
    await spool.dispose()
  })
})
