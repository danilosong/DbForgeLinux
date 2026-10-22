import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { encodeDbf, parseDbf } from '../../src/modules/data-export-import/dbf.js'
import { exportData } from '../../src/modules/data-export-import/export.js'
import { previewImport } from '../../src/modules/data-export-import/import.js'

describe('DBF import/export', () => {
  it('round-trips dBase III Latin-1 character fields and rejects unsafe values', async () => {
    const file = encodeDbf(['id', 'label'], [{ id: 7, label: 'café' }, { id: 8, label: null }])
    expect(file[0]).toBe(0x03)
    expect(parseDbf(file)).toEqual({ columns: ['id', 'label'], rows: [{ id: '7', label: 'café' }, { id: '8', label: null }] })
    const preview = await previewImport({ driver: {} as never, connectionId: '', source: (async function* () { yield file })(), format: 'dbf', table: '' })
    expect(preview).toEqual({ columns: ['id', 'label'], rows: [{ id: '7', label: 'café' }, { id: '8', label: null }] })
    expect(() => encodeDbf(['label'], [{ label: '雪' }])).toThrow(/Latin-1/)
    expect(() => encodeDbf(['label'], [{ label: 'x'.repeat(255) }])).toThrow(/254-byte/)
  })

  it('writes an export stream as a DBF file', async () => {
    const chunks: Buffer[] = []
    const destination = new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
    const driver = { streamRows: async function* () { yield { id: 1, label: 'one' }; yield { id: 2, label: 'two' } } }
    const report = await exportData({ driver: driver as never, connectionId: 'test', query: 'SELECT id, label', format: 'dbf', destination })
    expect(report.rows).toBe(2)
    expect(parseDbf(Buffer.concat(chunks)).rows).toEqual([{ id: '1', label: 'one' }, { id: '2', label: 'two' }])
  })
})
