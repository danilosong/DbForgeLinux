import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import type { Writable } from 'node:stream'
import type { Row } from './types.js'
import { xmlEscape } from './encoding.js'

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
function crc32Update(crc: number, data: Buffer): number {
  let value = crc
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return value >>> 0
}
function crc32(data: Buffer): number { return (crc32Update(0xffffffff, data) ^ 0xffffffff) >>> 0 }
function xmlValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
function columnName(index: number): string {
  let value = index + 1
  let name = ''
  while (value) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26) }
  return name
}
function cell(value: unknown, ref: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  if (value === null || value === undefined) return `<c r="${ref}" t="inlineStr"><is><t>__DBFORGE_NULL__</t></is></c>`
  const text = Buffer.isBuffer(value) ? `__DBFORGE_BINARY__${value.toString('base64')}` : value instanceof Date ? `__DBFORGE_DATE__${value.toISOString()}` : xmlValue(value)
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`
}

async function write(out: Writable, data: Buffer): Promise<void> {
  if (!out.write(data)) await once(out, 'drain')
}

interface ZipEntry { name: string; data?: Buffer; file?: string; size: number; crc: number }
function localHeader(entry: ZipEntry): Buffer {
  const name = Buffer.from(entry.name)
  const header = Buffer.alloc(30 + name.length)
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6)
  header.writeUInt32LE(entry.crc, 14); header.writeUInt32LE(entry.size, 18); header.writeUInt32LE(entry.size, 22)
  header.writeUInt16LE(name.length, 26); name.copy(header, 30)
  return header
}
function centralHeader(entry: ZipEntry, offset: number): Buffer {
  const name = Buffer.from(entry.name)
  const header = Buffer.alloc(46 + name.length)
  header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8)
  header.writeUInt32LE(entry.crc, 16); header.writeUInt32LE(entry.size, 20); header.writeUInt32LE(entry.size, 24)
  header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42); name.copy(header, 46)
  return header
}

/** Writes an OOXML workbook while keeping worksheet rows on disk instead of in memory. */
export async function writeXlsx(rows: AsyncIterable<Row>, out: Writable, signal?: AbortSignal): Promise<{ rows: number; bytes: number }> {
  const directory = await mkdtemp(join(tmpdir(), 'dbforge-xlsx-'))
  const sheetPath = join(directory, 'sheet1.xml')
  let count = 0
  let columns: string[] = []
  let headerWritten = false
  let bytes = 0
  const sheet = createWriteStream(sheetPath)
  const sheetWrite = async (value: string): Promise<void> => {
    if (!sheet.write(value)) await once(sheet, 'drain')
  }
  try {
    await sheetWrite('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>')
    for await (const row of rows) {
      if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
      if (!columns.length) columns = Object.keys(row)
      if (!headerWritten) {
        const headerRow = 1
        await sheetWrite(`<row r="${headerRow}">${columns.map((value, index) => cell(value, `${columnName(index)}${headerRow}`)).join('')}</row>`)
        headerWritten = true
      }
      const rowNumber = count + 2
      await sheetWrite(`<row r="${rowNumber}">${columns.map((key, index) => cell(row[key], `${columnName(index)}${rowNumber}`)).join('')}</row>`)
      count++
    }
    await sheetWrite('</sheetData></worksheet>')
    sheet.end()
    await once(sheet, 'close')

    const fixed: Array<[string, Buffer]> = [
      ['[Content_Types].xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')],
      ['_rels/.rels', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')],
      ['xl/workbook.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>')],
      ['xl/_rels/workbook.xml.rels', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')]
    ]
    const size = (await stat(sheetPath)).size
    let sheetCrc = 0xffffffff
    for await (const chunk of createReadStream(sheetPath)) sheetCrc = crc32Update(sheetCrc, chunk as Buffer)
    const entries: ZipEntry[] = fixed.map(([name, data]) => ({ name, data, size: data.length, crc: crc32(data) }))
    entries.push({ name: 'xl/worksheets/sheet1.xml', file: sheetPath, size, crc: (sheetCrc ^ 0xffffffff) >>> 0 })

    const central: Buffer[] = []
    let offset = 0
    for (const entry of entries) {
      const header = localHeader(entry)
      await write(out, header); bytes += header.length
      if (entry.data) { await write(out, entry.data); bytes += entry.data.length }
      else if (entry.file) {
        for await (const chunk of createReadStream(entry.file)) { const data = chunk as Buffer; await write(out, data); bytes += data.length }
      }
      central.push(centralHeader(entry, offset))
      offset += header.length + entry.size
    }
    const centralOffset = offset
    let centralSize = 0
    for (const header of central) { await write(out, header); bytes += header.length; centralSize += header.length }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16)
    await write(out, end); bytes += end.length
    return { rows: count, bytes }
  } finally {
    if (!sheet.closed) sheet.destroy()
    await rm(directory, { recursive: true, force: true })
  }
}

export async function readXlsx(buffer: Buffer): Promise<{ columns: string[]; rows: Row[] }> {
  const maxEntrySize = 50 * 1024 * 1024
  const maxXmlSize = 100 * 1024 * 1024
  const entries = new Map<string, Buffer>()
  let expandedXmlBytes = 0
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('Arquivo XLSX inválido.')
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Estrutura ZIP inválida.')
    const method = buffer.readUInt16LE(offset + 10)
    const compressed = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const localName = buffer.readUInt16LE(local + 26)
    const localExtra = buffer.readUInt16LE(local + 28)
    const dataStart = local + 30 + localName + localExtra
    const raw = buffer.subarray(dataStart, dataStart + compressed)
    if (name.endsWith('.xml')) {
      const zlib = await import('node:zlib')
      let expanded: Buffer
      try {
        expanded = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: maxEntrySize }) : Buffer.alloc(0)
      } catch (error) { throw new Error('XLSX XML entry is invalid or exceeds the 50 MB safety limit.', { cause: error }) }
      if (expanded.length > maxEntrySize || expandedXmlBytes + expanded.length > maxXmlSize) throw new Error('XLSX XML data exceeds the safety limit.')
      expandedXmlBytes += expanded.length
      entries.set(name, expanded)
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  const sheet = entries.get('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('Planilha XLSX não encontrada.')
  const xml = sheet.toString('utf8')
  const rows: Row[] = []
  for (const match of xml.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)) {
    const values = new Map<number, unknown>()
    for (const c of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? ''
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? 'A'
      let column = 0
      for (const char of ref) column = column * 26 + char.charCodeAt(0) - 64
      const inner = c[2] ?? ''
      const text = /<t(?:\s[^>]*)?>(.*?)<\/t>/s.exec(inner)?.[1] ?? /<v>(.*?)<\/v>/s.exec(inner)?.[1] ?? ''
      const decoded = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const value = decoded === '__DBFORGE_NULL__' ? null
        : decoded.startsWith('__DBFORGE_BINARY__') ? Buffer.from(decoded.slice('__DBFORGE_BINARY__'.length), 'base64')
          : decoded.startsWith('__DBFORGE_DATE__') ? new Date(decoded.slice('__DBFORGE_DATE__'.length))
            : type === 'b' ? decoded === '1'
              : type === undefined && decoded !== '' && Number.isFinite(Number(decoded)) ? Number(decoded) : decoded
      values.set(column - 1, value)
    }
    const max = Math.max(-1, ...values.keys())
    rows.push(Object.fromEntries(Array.from({ length: max + 1 }, (_, i) => [String(i), values.has(i) ? values.get(i) : ''])))
  }
  const columns = rows.shift()
  if (!columns) return { columns: [], rows: [] }
  const names = Object.keys(columns).sort((a, b) => Number(a) - Number(b)).map((key) => String(columns[key] ?? ''))
  return { columns: names, rows: rows.map((row) => Object.fromEntries(names.map((name, index) => [name, Object.hasOwn(row, String(index)) ? row[String(index)] : '']))) }
}
