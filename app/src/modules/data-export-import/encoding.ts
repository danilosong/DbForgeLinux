export function encodeText(text: string, encoding: 'utf8' | 'utf16le' | 'latin1' = 'utf8'): Buffer {
  if (encoding === 'latin1') return Buffer.from(text, 'latin1')
  return Buffer.from(text, encoding)
}

export function quoteIdentifier(identifier: string): string {
  if (!identifier || identifier.includes('\0')) throw new Error('Identificador inválido.')
  return `\`${identifier.replace(/`/g, '``')}\``
}

export function quoteQualifiedIdentifier(identifier: string): string {
  return identifier.split('.').map(quoteIdentifier).join('.')
}

export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replace(/\\/g, '\\\\').replace(/\0/g, '\\0').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replaceAll(String.fromCharCode(26), '\\Z').replace(/'/g, "\\'")}'`
}

export function csvField(value: unknown, delimiter: string, quote: string, forceQuotes = false): string {
  const text = value === null || value === undefined ? '' : Buffer.isBuffer(value) ? value.toString('base64') : value instanceof Date ? value.toISOString() : String(value)
  if (!forceQuotes && !text.includes(delimiter) && !text.includes(quote) && !/[\r\n]/.test(text)) return text
  return `${quote}${text.split(quote).join(quote + quote)}${quote}`
}

export function xmlEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = Buffer.isBuffer(value) ? value.toString('base64') : value instanceof Date ? value.toISOString() : String(value)
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function htmlEscape(value: unknown): string {
  return xmlEscape(value).replace(/"/g, '&quot;')
}

export function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}
