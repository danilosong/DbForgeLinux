import { createHash } from 'node:crypto'
import { registerCatalogGenerators, type CatalogContext, type CatalogGenerator } from './types.js'

const choose = <T>(values: readonly T[], random: () => number): T => values[Math.floor(random() * values.length)]!
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function bitcoin(random: () => number): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const payload = Buffer.alloc(21)
  payload[0] = 0x6f
  for (let i = 1; i < payload.length; i++) payload[i] = Math.floor(random() * 256)
  const checksum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4)
  const bytes = Buffer.concat([payload, checksum])
  let value = BigInt(`0x${bytes.toString('hex')}`)
  let encoded = ''
  while (value > 0n) { encoded = alphabet[Number(value % 58n)] + encoded; value /= 58n }
  for (const byte of bytes) { if (byte !== 0) break; encoded = `1${encoded}` }
  return encoded
}

export function isBitcoinAddress(value: string): boolean {
  if (typeof value !== 'string' || !/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{26,35}$/.test(value)) return false
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let number = 0n
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character))
  const hex = number.toString(16).padStart(50, '0')
  let bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex')
  let zeroes = 0
  while (value[zeroes] === '1') zeroes++
  if (zeroes) bytes = Buffer.concat([Buffer.alloc(zeroes), bytes])
  if (bytes.length !== 25) return false
  const payload = bytes.subarray(0, 21)
  const expected = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4)
  return expected.equals(bytes.subarray(21))
}

const version = (random: () => number): string => `${1 + Math.floor(random() * 8)}.${Math.floor(random() * 20)}.${Math.floor(random() * 100)}.${Math.floor(random() * 1000)}`
const roman = (number: number): string => {
  const pairs: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let rest = number; let result = ''
  for (const [value, glyph] of pairs) while (rest >= value) { result += glyph; rest -= value }
  return result
}

const samples: Record<string, readonly string[]> = {
  'Document Title': ['Quarterly Signal Review', 'Blue Harbor Archive', 'Cedar Index Notes', 'Northwind Field Manual'],
  'Error Message': ['The requested record is unavailable.', 'A temporary service check failed.', 'The input did not match the expected format.', 'The operation could not be completed.'],
  'File Extension': ['.txt', '.json', '.log', '.csv', '.sql', '.dat'],
  'File Name (DOS)': ['REPORT.TXT', 'INDEX.DAT', 'NOTES.LOG', 'EXPORT.CSV'],
  'File Name (Windows)': ['Field Notes.txt', 'Archive Index.json', 'System Report.log', 'Data Export.csv'],
  'File Name (images)': ['harbor-view.png', 'map-detail.jpg', 'sample-grid.webp', 'site-mark.svg'],
  'File Path (DOS)': ['C:\\DATA\\REPORT.TXT', 'D:\\ARCHIVE\\INDEX.DAT', 'C:\\TEMP\\NOTES.LOG'],
  'File Path (Windows)': ['C:\\Data\\Field Notes.txt', 'D:\\Archive\\Index.json', 'C:\\Temp\\Report.log'],
  'File Path (web files)': ['/srv/www/site/assets/data.json', '/var/www/app/public/index.html', '/opt/site/downloads/archive.zip'],
  'File Path (web images)': ['/srv/www/site/images/harbor.png', '/var/www/app/public/media/map.jpg', '/opt/site/assets/mark.svg'],
  'MIME Type': ['application/json', 'text/plain', 'application/octet-stream', 'image/svg+xml', 'application/sql'],
  'Security Password Answer': ['Blue notebook', 'Quiet meadow', 'Paper lantern', 'River crossing'],
  'Security Password Question': ['What was the name of your first project?', 'Which place did you visit last?', 'What color was your school bag?'],
  'Time Zone': ['Europe/Lisbon', 'America/Chicago', 'Asia/Tokyo', 'Australia/Perth', 'Etc/UTC'],
  'Time Zone Code': ['UTC', 'WET', 'CST', 'JST', 'AWST'],
  'User Agent': ['TuxSQL-TestClient/1.0 (Linux; x86_64)', 'ExampleBrowser/4.2 (X11; Linux)', 'DataProbe/2.1 (Linux; arm64)']
}

function produce(name: string, random: () => number, row: number): string | number | Buffer {
  switch (name) {
    case 'Binary Bits (base 2 mod 3)': { const length = 8 + (row % 17); const bits = Array.from({ length }, () => random() < 0.5 ? '0' : '1'); const remainder = bits.reduce((value, bit) => (value * 2 + Number(bit)) % 3, 0); if (remainder === 1) bits.push('1'); else if (remainder === 2) bits.push('0', '1'); return bits.join('') }
    case 'Bitcoin Address': return bitcoin(random)
    case 'Connection Timeout': return 5 + Math.floor(random() * 116)
    case 'Document File': return choose(['plain text sample\n', '{"kind":"sample","enabled":true}\n', 'id,value\n1,example\n'], random)
    case 'File Name (DOS)': return `${String(row + 1).padStart(6, '0')}_${choose(samples[name]!, random)}`
    case 'File Name (Windows)': return `${choose(['Field Notes', 'Archive Index', 'System Report', 'Data Export'], random)} ${row + 1}.${choose(['txt', 'json', 'log', 'csv'], random)}`
    case 'File Name (images)': return `${String(row + 1).padStart(6, '0')}-${choose(samples[name]!, random)}`
    case 'File Path (DOS)': return `C:\\DATA\\${String(row + 1).padStart(6, '0')}\\${choose(['REPORT.TXT', 'INDEX.DAT', 'NOTES.LOG', 'EXPORT.CSV'], random)}`
    case 'File Path (Windows)': return `C:\\Data\\${row + 1}\\${choose(['Field Notes.txt', 'Archive Index.json', 'System Report.log', 'Data Export.csv'], random)}`
    case 'First Day of Week': return choose([0, 1, 6], random)
    case 'Host Name': return `${choose(['api', 'node', 'cache', 'worker', 'db'], random)}-${String(row + 1).padStart(4, '0')}.example.test`
    case 'IPv4 Address': return `192.0.2.${1 + (row % 253)}`
    case 'IPv6 Address': return `2001:db8:${(row % 65535).toString(16)}::${(1 + Math.floor(random() * 65534)).toString(16)}`
    case 'Image':
    case 'Lorem Pixel': return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}"/></svg>`)
    case 'MAC Address (IEEE 802)': return `02:${Array.from({ length: 5 }, () => Math.floor(random() * 256).toString(16).padStart(2, '0')).join(':')}`
    case 'MD5 Hash': return createHash('md5').update(`tuxsql-generated-sample-${row}-${random()}`).digest('hex')
    case 'Meta Keywords': return choose(['archive, index, sample', 'harbor, map, overview', 'system, status, report', 'catalog, record, query'], random)
    case 'Ordinal Numbers': { const value = row + 1; const mod100 = value % 100; const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'; return `${value}${suffix}` }
    case 'Password Hash': return `sha256:${createHash('sha256').update(`tuxsql-demo-password-${row}`).digest('hex')}`
    case 'Product Key': return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(random() * 32)]).join('')).join('-')
    case 'Roman Numerals': return roman(1 + (row % 3999))
    case 'Server Port': return 1024 + Math.floor(random() * (65535 - 1024 + 1))
    case 'Time Zone Offset': return choose(['+00:00', '+01:00', '-05:00', '+05:30', '+09:00', '-08:00'], random)
    case 'URL (web)': return `https://sample-${row + 1}.example.test/${choose(['docs', 'status', 'catalog', 'assets'], random)}`
    case 'Version': return version(random)
    default: return choose(samples[name] ?? ['Sample entry', 'Test record', 'Example value'], random)
  }
}

const metadata = {
  "Binary Bits (base 2 mod 3)": { languages: [], columnTypes: ["binary", "blob", "char", "longblob", "longtext", "mediumtext", "text", "tinyblob", "tinytext", "varbinary", "varchar"] },
"Bitcoin Address": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Connection Timeout": { languages: [], columnTypes: ["bigint", "int", "mediumint", "smallint", "ubigint", "uint", "umediumint", "usmallint"] },
"Document File": { languages: [], columnTypes: ["longtext", "mediumtext", "text"] },
"Document Title": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Error Message": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Extension": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Name (DOS)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Name (Windows)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Name (images)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Path (DOS)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Path (Windows)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Path (web files)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"File Path (web images)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"First Day of Week": { languages: [], columnTypes: ["bigint", "char", "decimal", "int", "longtext", "mediumint", "mediumtext", "smallint", "text", "tinyint", "tinytext", "varchar"] },
"Host Name": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"IPv4 Address": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"IPv6 Address": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Image": { languages: [], columnTypes: ["blob", "longblob", "mediumblob", "tinyblob"] },
"Lorem Pixel": { languages: [], columnTypes: ["blob", "longblob"] },
"MAC Address (IEEE 802)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"MD5 Hash": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"MIME Type": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Meta Keywords": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Ordinal Numbers": { languages: [], columnTypes: ["char", "nchar", "ntext", "nvarchar", "nvarchar(max)", "text", "varchar", "varchar(max)"] },
"Password Hash": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "varchar"] },
"Product Key": { languages: [], columnTypes: ["MySQLRegularExpressionGenerator", "char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Roman Numerals": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Security Password Answer": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "varchar"] },
"Security Password Question": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "varchar"] },
"Server Port": { languages: [], columnTypes: ["bigint", "int", "mediumint", "smallint", "ubigint", "uint", "umediumint", "usmallint"] },
"Time Zone": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Time Zone Code": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Time Zone Offset": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"URL (web)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"User Agent": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
"Version": { languages: [], columnTypes: ["char", "nchar", "ntext", "nvarchar", "nvarchar(max)", "text", "varchar", "varchar(max)"] },
} as const

const patternValidators: Record<string, (value: string) => boolean> = {
  'Binary Bits (base 2 mod 3)': (value) => /^[01]+$/.test(value) && [...value].reduce((mod, bit) => (mod * 2 + Number(bit)) % 3, 0) === 0,
  'Bitcoin Address': isBitcoinAddress,
  'IPv4 Address': (value) => typeof value === 'string' && /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value),
  'IPv6 Address': (value) => typeof value === 'string' && /^[0-9a-f:]+$/i.test(value) && value.includes(':'),
  'MAC Address (IEEE 802)': (value) => typeof value === 'string' && /^02(?::[0-9a-f]{2}){5}$/i.test(value),
  'MD5 Hash': (value) => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value),
  'Product Key': (value) => typeof value === 'string' && /^(?:[A-HJ-NP-Z2-9]{5}-){4}[A-HJ-NP-Z2-9]{5}$/.test(value),
  'Version': (value) => typeof value === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(value),
}

const uniqueReferences = new Set(['Binary Bits (base 2 mod 3)', 'Bitcoin Address', 'File Name (DOS)', 'File Name (Windows)', 'File Name (images)', 'File Path (DOS)', 'File Path (Windows)', 'Host Name', 'IPv4 Address', 'IPv6 Address', 'Image', 'Lorem Pixel', 'MAC Address (IEEE 802)', 'MD5 Hash', 'Ordinal Numbers', 'Password Hash', 'Product Key', 'Roman Numerals', 'Server Port', 'URL (web)', 'Version'])

export const itGenerators: readonly CatalogGenerator[] = Object.entries(metadata).map(([reference, details]) => ({
  id: `it.${slug(reference)}`, name: reference, category: 'IT', ...(details.languages.length ? { languages: details.languages } : {}), columnTypes: details.columnTypes, reference, ...(uniqueReferences.has(reference) ? { unique: true } : {}),
  ...(reference === 'Bitcoin Address' ? { synthetic: 'Base58Check test-network address prefix.' } : {}),
  generate: (random, context: CatalogContext) => produce(reference, random, context.index),
  ...(patternValidators[reference] ? { validate: (value: string) => patternValidators[reference]!(value) } : {})
}))

registerCatalogGenerators(itGenerators)
