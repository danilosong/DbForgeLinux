import type { Row } from './types.js'

const headerLength = 32
const maxRecords = 10_000_000

function fieldName(name: string): string {
  const clean = name.replace(/[^\x20-\x7e]/g, '_').slice(0, 10)
  if (!clean) throw new Error('DBF column names must contain printable ASCII characters.')
  return clean
}

export function parseDbf(data: Buffer): { columns: string[]; rows: Row[] } {
  if (data.length < headerLength + 1 || ![0x03, 0x83, 0x8b, 0xcb].includes(data[0]!)) throw new Error('The DBF file header is unsupported or incomplete.')
  const count = data.readUInt32LE(4)
  const headerBytes = data.readUInt16LE(8)
  const recordBytes = data.readUInt16LE(10)
  if (count > maxRecords || headerBytes < headerLength + 1 || recordBytes < 1 || headerBytes > data.length || headerBytes + count * recordBytes > data.length) throw new Error('The DBF file contains invalid record bounds.')
  const fields: Array<{ name: string; type: string; length: number; decimals: number }> = []
  for (let offset = headerLength; offset < headerBytes && data[offset] !== 0x0d; offset += 32) {
    if (offset + 32 > headerBytes) throw new Error('The DBF field descriptor is truncated.')
    const descriptor = data.subarray(offset, offset + 32)
    const name = descriptor.subarray(0, 11).toString('ascii').replace(/\0.*$/, '').trim()
    const type = String.fromCharCode(descriptor[11]!)
    const length = descriptor[16]!
    const decimals = descriptor[17]!
    if (!name || !length || !['C', 'N', 'F', 'L', 'D'].includes(type)) throw new Error(`The DBF field ${name || '(unnamed)'} has an unsupported type or size.`)
    fields.push({ name, type, length, decimals })
  }
  if (!fields.length || fields.reduce((sum, field) => sum + field.length, 1) > recordBytes) throw new Error('The DBF record layout is invalid.')
  const rows: Row[] = []
  let offset = headerBytes
  for (let rowIndex = 0; rowIndex < count; rowIndex++, offset += recordBytes) {
    if (data[offset] === 0x2a) continue
    let fieldOffset = offset + 1
    const row: Row = {}
    for (const field of fields) {
      const raw = data.subarray(fieldOffset, fieldOffset + field.length).toString('latin1').trim()
      fieldOffset += field.length
      let value: unknown = raw
      if (!raw) value = null
      else if (field.type === 'N' || field.type === 'F') { const number = Number(raw); if (Number.isFinite(number)) value = Number.isSafeInteger(number) ? number : number }
      else if (field.type === 'L') value = /^[YT]$/i.test(raw) ? true : /^[NF]$/i.test(raw) ? false : null
      else if (field.type === 'D' && /^\d{8}$/.test(raw)) value = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`
      row[field.name] = value
    }
    rows.push(row)
  }
  return { columns: fields.map((field) => field.name), rows }
}

export function encodeDbf(columns: string[], rows: Row[]): Buffer {
  if (!columns.length || columns.length > 255 || rows.length > maxRecords) throw new Error('DBF export supports 1 to 255 columns and up to 10 million rows.')
  const names = columns.map(fieldName)
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) throw new Error('DBF column names must be unique after the 10-character DBF limit.')
  const values = rows.map((row) => columns.map((column) => {
    const value = row[column]
    const text = value === null || value === undefined ? '' : Buffer.isBuffer(value) ? value.toString('hex') : value instanceof Date ? value.toISOString() : String(value)
    if (/[\r\n\0]/.test(text)) throw new Error(`DBF value in ${column} contains a line break or NUL byte.`)
    if ([...text].some((character) => character.codePointAt(0)! > 0xff)) throw new Error(`DBF export supports Latin-1 text only; column ${column} contains another character.`)
    if (Buffer.byteLength(text, 'latin1') > 254) throw new Error(`DBF value in ${column} exceeds the 254-byte character-field limit.`)
    return text
  }))
  const widths = columns.map((_column, index) => Math.max(1, ...values.map((row) => Buffer.byteLength(row[index]!, 'latin1'))))
  const recordLength = 1 + widths.reduce((sum, width) => sum + width, 0)
  const headerLengthBytes = headerLength + columns.length * 32 + 1
  const output = Buffer.alloc(headerLengthBytes + rows.length * recordLength + 1, 0x20)
  output[0] = 0x03
  const now = new Date(); output[1] = now.getFullYear() - 1900; output[2] = now.getMonth() + 1; output[3] = now.getDate()
  output.writeUInt32LE(rows.length, 4); output.writeUInt16LE(headerLengthBytes, 8); output.writeUInt16LE(recordLength, 10)
  let descriptorOffset = headerLength
  for (let index = 0; index < columns.length; index++, descriptorOffset += 32) {
    output.write(names[index]!, descriptorOffset, 11, 'ascii'); output[descriptorOffset + 11] = 'C'.charCodeAt(0); output[descriptorOffset + 16] = widths[index]!
  }
  output[descriptorOffset] = 0x0d
  let dataOffset = headerLengthBytes
  for (const row of values) {
    output[dataOffset++] = 0x20
    for (let index = 0; index < row.length; index++) { const value = Buffer.from(row[index]!, 'latin1'); value.copy(output, dataOffset + widths[index]! - value.length); dataOffset += widths[index]! }
  }
  output[dataOffset] = 0x1a
  return output
}
