import { deflateSync } from 'node:zlib'
import { digits, fromAlphabet, gs1CheckDigit, gs1Valid, integer, isNumericColumn, luhnCheckDigit, luhnValid, numericCeiling, pick, registerCatalogGenerators, UPPER, type CatalogContext, type CatalogGenerator, type Random } from './types.js'
import { ptBrProductPools } from './ptBrSamplePools.js'

// Product-category generators. Lists are original; identifiers follow public standards and use
// reserved/test ranges where the standard has one (GS1 restricted circulation, ITU test network).
const TEXT = ['char', 'longtext', 'mediumtext', 'text', 'tinytext', 'varchar'] as const
const NUMERIC_TEXT = ['bigint', 'char', 'decimal', 'longtext', 'mediumtext', 'text', 'tinytext', 'varchar'] as const
const UNSIGNED_NUMBERS = ['bigint', 'decimal', 'int', 'mediumint', 'smallint', 'tinyint', 'ubigint', 'udecimal', 'uint', 'umediumint', 'usmallint', 'utinyint'] as const
const byLocale = <T>(context: CatalogContext, en: readonly T[], pt: readonly T[]): readonly T[] => context.locale === 'pt-BR' ? pt : en

// --- Check-digit algorithms -------------------------------------------------------------

/** ISBN-10 / ISSN style mod 11 with descending weights; 10 is written X. */
function mod11Check(payload: string, firstWeight: number): string {
  const sum = [...payload].reduce((total, char, index) => total + Number(char) * (firstWeight - index), 0)
  const check = (11 - (sum % 11)) % 11
  return check === 10 ? 'X' : String(check)
}
export function isValidIsbn10(value: string): boolean { return /^\d{9}[\dX]$/.test(value) && mod11Check(value.slice(0, 9), 10) === value[9] }
export function isValidIssn(value: string): boolean { const compact = value.replace('-', ''); return /^\d{4}-?\d{3}[\dX]$/.test(value) && mod11Check(compact.slice(0, 7), 8) === compact[7] }

/** ASTM CODEN check character (NBS TN 738): A-Z=1..26, 1-9=27..35, 0=36; weights 11,7,5,3,1; mod 34. */
export function codenCheckCharacter(payload: string): string {
  const value = (char: string): number => /[A-Z]/.test(char) ? char.charCodeAt(0) - 64 : char === '0' ? 36 : 26 + Number(char)
  const remainder = [11, 7, 5, 3, 1].reduce((total, weight, index) => total + weight * value(payload[index]!), 0) % 34
  return remainder === 0 ? '9' : remainder <= 26 ? String.fromCharCode(64 + remainder) : String(remainder - 25)
}
export function isValidCoden(value: string): boolean { return /^[A-Z]{4}[A-Z0-9][A-Z2-9]$/.test(value) && codenCheckCharacter(value) === value[5] }

/** UPU S10: weights 8,6,4,2,3,5,9,7; 11 - (sum mod 11), with 10 -> 0 and 11 -> 5. */
export function s10CheckDigit(serial: string): number {
  const sum = [8, 6, 4, 2, 3, 5, 9, 7].reduce((total, weight, index) => total + weight * Number(serial[index]), 0)
  const check = 11 - (sum % 11)
  return check === 10 ? 0 : check === 11 ? 5 : check
}
export function isValidS10(value: string): boolean { const match = /^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/.exec(value); return Boolean(match && s10CheckDigit(match[1]!) === Number(match[2])) }

/** ISO 3779 VIN check digit (position 9) with the North American transliteration. */
const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
const vinValues: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 }
export function vinCheckCharacter(vin: string): string {
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum = [...vin].reduce((total, char, index) => total + (/\d/.test(char) ? Number(char) : vinValues[char]!) * weights[index]!, 0)
  const check = sum % 11
  return check === 10 ? 'X' : String(check)
}
export function isValidVin(value: string): boolean { return /^[A-HJ-NPR-Z0-9]{8}[0-9X][A-HJ-NPR-Z0-9]{8}$/.test(value) && vinCheckCharacter(value) === value[8] }

// --- Tiny deterministic PNG (product image placeholder) ---------------------------------

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
function crc32(bytes: Uint8Array): number { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }
function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** 32x32 RGB image: two random colours split diagonally, a few hundred bytes. */
function productImage(random: Random): Buffer {
  const size = 32
  const colours = [0, 1].map(() => [integer(random, 0, 255), integer(random, 0, 255), integer(random, 0, 255)])
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0
    for (let x = 0; x < size; x++) { const colour = colours[x + y < size ? 0 : 1]!; raw.set(colour, y * (1 + size * 3) + 1 + x * 3) }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}

// --- Original lists -------------------------------------------------------------------

const languages: ReadonlyArray<readonly [string, string, string]> = [
  ['en', 'eng', 'English'], ['pt', 'por', 'Portuguese'], ['es', 'spa', 'Spanish'], ['fr', 'fra', 'French'], ['de', 'deu', 'German'], ['it', 'ita', 'Italian'], ['nl', 'nld', 'Dutch'], ['sv', 'swe', 'Swedish'], ['da', 'dan', 'Danish'], ['fi', 'fin', 'Finnish'], ['pl', 'pol', 'Polish'], ['cs', 'ces', 'Czech'], ['el', 'ell', 'Greek'], ['tr', 'tur', 'Turkish'], ['ru', 'rus', 'Russian'], ['uk', 'ukr', 'Ukrainian'], ['ar', 'ara', 'Arabic'], ['he', 'heb', 'Hebrew'], ['hi', 'hin', 'Hindi'], ['bn', 'ben', 'Bengali'], ['zh', 'zho', 'Chinese'], ['ja', 'jpn', 'Japanese'], ['ko', 'kor', 'Korean'], ['vi', 'vie', 'Vietnamese'], ['th', 'tha', 'Thai'], ['id', 'ind', 'Indonesian'], ['sw', 'swa', 'Swahili'], ['hu', 'hun', 'Hungarian'], ['ro', 'ron', 'Romanian'], ['ca', 'cat', 'Catalan'], ['eu', 'eus', 'Basque'], ['ga', 'gle', 'Irish'], ['cy', 'cym', 'Welsh'], ['is', 'isl', 'Icelandic']
]
const colors = { en: ['Black', 'White', 'Charcoal', 'Ivory', 'Navy', 'Sky Blue', 'Teal', 'Forest Green', 'Olive', 'Mustard', 'Burnt Orange', 'Crimson', 'Burgundy', 'Lavender', 'Plum', 'Sand', 'Taupe', 'Silver'] }
const categories = { en: ['Books', 'Electronics', 'Garden', 'Groceries', 'Health and Beauty', 'Home and Kitchen', 'Music', 'Office Supplies', 'Pet Supplies', 'Sports and Outdoors', 'Tools', 'Toys and Games', 'Apparel', 'Footwear', 'Automotive'] }
const productWords = {
  en: { adjective: ['Compact', 'Ergonomic', 'Foldable', 'Insulated', 'Lightweight', 'Modular', 'Rechargeable', 'Rugged', 'Smart', 'Stackable', 'Waterproof', 'Wireless'], material: ['Bamboo', 'Ceramic', 'Cotton', 'Glass', 'Leather', 'Oak', 'Steel', 'Wool'], noun: ['Backpack', 'Bottle', 'Desk Lamp', 'Headphones', 'Kettle', 'Mug', 'Notebook', 'Planter', 'Speaker', 'Stool', 'Tote Bag', 'Watch'] },
}
const descriptionParts = {
  en: { open: ['Designed for everyday use,', 'Built to last,', 'Made with care,', 'Small enough for any shelf,', 'A practical upgrade,'], body: ['it keeps its shape after years of use', 'it cleans up with a damp cloth', 'it fits neatly in a backpack', 'it pairs well with the rest of the range', 'it ships flat and assembles in minutes', 'it runs quietly on low power'], close: ['Available in several colours.', 'Covered by a two-year warranty.', 'Packaging is fully recyclable.', 'Spare parts are sold separately.'] },
}
const comments = {
  en: ['Arrived a day early and well packed.', 'Does what it says, nothing more.', 'The colour is slightly darker than in the photos.', 'Second one I bought; still happy.', 'Instructions could be clearer.', 'Great value for the price.', 'Stopped working after a month; support replaced it quickly.', 'Lighter than I expected.', 'Would buy again.', 'Smaller than I thought, check the dimensions.'],
}
const shippingMethods = { en: ['Standard', 'Express', 'Next day', 'Same day', 'Economy', 'Store pickup', 'Freight', 'International priority'] }
const sizeUnits = ['mm', 'cm', 'm', 'in', 'ft', 'yd']
const weightUnits = ['mg', 'g', 'kg', 't', 'oz', 'lb']
const apparelSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
// DVLA local memory tags exclude I, Q and Z; the three random letters exclude I and Q.
const PLATE_AREA = 'ABCDEFGHJKLMNOPRSTUVWXY'
const PLATE_RANDOM = 'ABCDEFGHJKLMNOPRSTUVWXYZ'

const gs1 = (payload: string): string => `${payload}${gs1CheckDigit(payload)}`
function isbn10(random: Random, numeric: boolean): string {
  for (;;) {
    const body = `${pick(['0', '1'], random)}${digits(random, 8)}`
    const check = mod11Check(body, 10)
    if (!numeric || check !== 'X') return `${body}${check}`
  }
}
function issnBody(random: Random): string { return digits(random, 7) }

const definitions: CatalogGenerator[] = [
  { id: 'product.asin', name: 'ASIN', reference: 'Amazon Standard Identification Number (ASIN)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'B0 + random characters; not looked up in any catalogue.', generate: (random) => `B0${fromAlphabet(random, `${UPPER}0123456789`, 8)}`, validate: (value) => /^B0[A-Z0-9]{8}$/.test(value) },
  { id: 'product.coden', name: 'CODEN', reference: 'Bibliographic Code (CODEN)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'Random title letters with a valid ASTM check character; not looked up in CASSI.',
    generate: (random) => { const body = `${fromAlphabet(random, UPPER, 4)}${fromAlphabet(random, 'ABCDEF', 1)}`; return `${body}${codenCheckCharacter(body)}` }, validate: isValidCoden },
  { id: 'product.clothing-size', name: 'Clothing Size', reference: 'Clothing Size', category: 'Product', columnTypes: ['bigint', 'char', 'int', 'longtext', 'mediumint', 'mediumtext', 'smallint', 'text', 'tinyint', 'tinytext', 'varchar'],
    generate: (random, context) => isNumericColumn(context.columnType) ? 34 + 2 * integer(random, 0, 11) : pick(apparelSizes, random),
    validate: (value) => apparelSizes.includes(value) || (/^\d{2}$/.test(value) && Number(value) >= 34 && Number(value) <= 56 && Number(value) % 2 === 0) },
  { id: 'product.color', name: 'Color', reference: 'Color', category: 'Product', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, colors.en, ptBrProductPools.colors), random) },
  { id: 'product.ean13', name: 'EAN-13', reference: 'International Article Number (EAN-13)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'GS1 restricted-circulation prefixes 200-299 (in-store numbers), never a real trade item.',
    generate: (random) => gs1(`2${digits(random, 11)}`), validate: (value) => /^2\d{12}$/.test(value) && gs1Valid(value) },
  { id: 'product.imei', name: 'IMEI', reference: 'International Mobile Station Equipment Identity (IMEI)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'Type allocation code starting with 00 (test/reporting-body range) and a valid Luhn digit.',
    generate: (random) => { const body = `00${digits(random, 12)}`; return `${body}${luhnCheckDigit(body)}` }, validate: (value) => /^00\d{13}$/.test(value) && luhnValid(value) },
  { id: 'product.imeisv', name: 'IMEISV', reference: 'International Mobile Station Equipment Identity Software Version (IMEISV)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'Type allocation code starting with 00; IMEISV has no check digit, the last two digits are the software version (00-98).',
    generate: (random) => `00${digits(random, 12)}${String(integer(random, 0, 98)).padStart(2, '0')}`, validate: (value) => /^00\d{14}$/.test(value) && value.slice(14) !== '99' },
  { id: 'product.imsi', name: 'IMSI', reference: 'International Mobile Station Identity (IMSI)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'ITU-T E.212 test network (MCC 001, MNC 01); never a live subscriber.',
    generate: (random) => `00101${digits(random, 10)}`, validate: (value) => /^00101\d{10}$/.test(value) },
  { id: 'product.isbn10', name: 'ISBN-10', reference: 'International Standard Book Number (ISBN)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'English-language group with a random publisher/title and a valid check digit; may coincide with a real book.',
    generate: (random, context) => isbn10(random, isNumericColumn(context.columnType)), validate: isValidIsbn10 },
  { id: 'product.isbn13', name: 'ISBN-13', reference: 'International Standard Book Number (ISBN-13)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'Bookland 978 with a random body and valid check digit; may coincide with a real book.',
    generate: (random) => gs1(`978${digits(random, 9)}`), validate: (value) => /^97[89]\d{10}$/.test(value) && gs1Valid(value) },
  { id: 'product.ismn10', name: 'ISMN', reference: 'International Standard Music Number (ISMN)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'Random publisher/item with the check digit of its 979-0 form.',
    generate: (random) => { const body = digits(random, 8); return `M${body}${gs1CheckDigit(`9790${body}`)}` }, validate: (value) => /^M\d{9}$/.test(value) && gs1Valid(`9790${value.slice(1)}`) },
  { id: 'product.ismn13', name: 'ISMN-13', reference: 'International Standard Music Number (ISMN-13)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    generate: (random) => gs1(`9790${digits(random, 8)}`), validate: (value) => /^9790\d{9}$/.test(value) && gs1Valid(value) },
  { id: 'product.issn', name: 'ISSN', reference: 'International Standard Serial Number (ISSN)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'Random serial number with a valid check digit; may coincide with a real serial.',
    generate: (random) => { const body = issnBody(random); return `${body.slice(0, 4)}-${body.slice(4)}${mod11Check(body, 8)}` }, validate: isValidIssn },
  { id: 'product.issn13', name: 'ISSN-13', reference: 'International Standard Serial Number (ISSN-13)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    generate: (random) => gs1(`977${issnBody(random)}00`), validate: (value) => /^977\d{10}$/.test(value) && gs1Valid(value) },
  { id: 'product.language', name: 'Language', reference: 'Language', category: 'Product', columnTypes: TEXT,
    generate: (random, context) => { const language = pick(languages, random); return context.locale === 'pt-BR' ? ptBrProductPools.languages[language[0]]! : language[2] } },
  { id: 'product.language-alpha2-lower', name: 'Language Code (alpha-2, lowercase)', reference: 'Language Code (ISO 639-1 alpha-2, LowerCase)', category: 'Product', columnTypes: TEXT,
    generate: (random) => pick(languages, random)[0], validate: (value) => languages.some(([code]) => code === value) },
  { id: 'product.language-alpha2-upper', name: 'Language Code (alpha-2, uppercase)', reference: 'Language Code (ISO 639-1 alpha-2, UpperCase)', category: 'Product', columnTypes: TEXT,
    generate: (random) => pick(languages, random)[0].toUpperCase(), validate: (value) => languages.some(([code]) => code.toUpperCase() === value) },
  { id: 'product.language-alpha3-lower', name: 'Language Code (alpha-3, lowercase)', reference: 'Language Code (ISO 639-1 alpha-3, LowerCase)', category: 'Product', columnTypes: TEXT,
    generate: (random) => pick(languages, random)[1], validate: (value) => languages.some(([, code]) => code === value) },
  { id: 'product.language-alpha3-upper', name: 'Language Code (alpha-3, uppercase)', reference: 'Language Code (ISO 639-1 alpha-3, UpperCase)', category: 'Product', columnTypes: TEXT,
    generate: (random) => pick(languages, random)[1].toUpperCase(), validate: (value) => languages.some(([, code]) => code.toUpperCase() === value) },
  { id: 'product.upu-s10', name: 'Postal Tracking Number (S10)', reference: 'Post Tracking Number (UPU S10)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'Valid S10 structure and check digit with a random serial; not a live parcel.',
    generate: (random) => { const serial = digits(random, 8); return `${pick(['RR', 'EE', 'CP', 'LX', 'UA'], random)}${serial}${s10CheckDigit(serial)}${pick(['GB', 'BR', 'US', 'DE', 'FR', 'JP'], random)}` }, validate: isValidS10 },
  { id: 'product.plu', name: 'PLU Code', reference: 'Price Look-Up Code (PLU)', category: 'Product', columnTypes: TEXT,
    generate: (random) => { const code = String(integer(random, 3000, 4999)); return random() < 0.2 ? `9${code}` : code }, validate: (value) => /^9?[34]\d{3}$/.test(value) },
  { id: 'product.category', name: 'Product Category', reference: 'Product Category', category: 'Product', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, categories.en, ptBrProductPools.categories), random) },
  { id: 'product.cost', name: 'Product Cost', reference: 'Product Cost', category: 'Product', columnTypes: UNSIGNED_NUMBERS,
    generate: (random, context) => /decimal/.test(context.columnType ?? '') ? Math.round((0.99 + random() * 9999) * 100) / 100 : integer(random, 1, numericCeiling(context.columnType, 9999)),
    validate: (value) => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 },
  { id: 'product.description', name: 'Product Description', reference: 'Product Description', category: 'Product', columnTypes: TEXT,
    generate: (random, context) => { const parts = context.locale === 'pt-BR' ? ptBrProductPools.description : descriptionParts.en; return `${pick(parts.open, random)} ${pick(parts.body, random)}. ${pick(parts.close, random)}` } },
  { id: 'product.images', name: 'Product Image', reference: 'Product Images', category: 'Product', columnTypes: ['blob', 'longblob'],
    generate: (random) => productImage(random) },
  { id: 'product.name', name: 'Product Name', reference: 'Product Name', category: 'Product', columnTypes: TEXT,
    generate: (random, context) => { const words = context.locale === 'pt-BR' ? ptBrProductPools.productWords : productWords.en; return context.locale === 'pt-BR' ? `${pick(words.noun, random)} ${pick(words.material, random)} ${pick(words.adjective, random)}` : `${pick(words.adjective, random)} ${pick(words.material, random)} ${pick(words.noun, random)}` } },
  { id: 'product.quantity', name: 'Product Quantity', reference: 'Product Quantity', category: 'Product', columnTypes: UNSIGNED_NUMBERS,
    generate: (random, context) => integer(random, 0, numericCeiling(context.columnType, 1000)), validate: (value) => /^\d+$/.test(value) },
  { id: 'product.weight', name: 'Product Weight (g)', reference: 'Product Weight', category: 'Product', columnTypes: UNSIGNED_NUMBERS,
    generate: (random, context) => integer(random, 1, numericCeiling(context.columnType, 50_000)), validate: (value) => /^[1-9]\d*$/.test(value) },
  { id: 'product.shipping-method', name: 'Shipping Method', reference: 'Shipping Method', category: 'Product', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, shippingMethods.en, ptBrProductPools.shippingMethods), random) },
  { id: 'product.size-unit', name: 'Size Unit', reference: 'Size Unit', category: 'Product', columnTypes: TEXT, generate: (random) => pick(sizeUnits, random), validate: (value) => sizeUnits.includes(value) },
  { id: 'product.uk-plate', name: 'UK Vehicle Registration Plate', reference: 'UK Vehicle Registration Plate', category: 'Product', languages: ['GB'], columnTypes: TEXT, unique: true,
    synthetic: 'Current DVLA layout with random letters; may coincide with a real vehicle.',
    generate: (random) => { const year = integer(random, 2, 25); const age = String(random() < 0.5 ? year : year + 50).padStart(2, '0'); return `${fromAlphabet(random, PLATE_AREA, 2)}${age} ${fromAlphabet(random, PLATE_RANDOM, 3)}` },
    validate: (value) => /^[A-HJ-PR-Y]{2}(?:0[2-9]|[1-6]\d|7[0-5]) [A-HJ-PR-Z]{3}$/.test(value) },
  { id: 'product.upc-a', name: 'UPC-A', reference: 'Universal Product Code (UPC-A)', category: 'Product', columnTypes: NUMERIC_TEXT, unique: true,
    synthetic: 'Number system 4 (in-store use), never a real trade item.', generate: (random) => gs1(`4${digits(random, 10)}`), validate: (value) => /^4\d{11}$/.test(value) && gs1Valid(value) },
  { id: 'product.user-comments', name: 'User Comments', reference: 'User Comments', category: 'Product', columnTypes: ['longtext', 'mediumtext', 'text'],
    generate: (random, context) => { const list = byLocale(context, comments.en, ptBrProductPools.comments); return `${pick(list, random)} ${pick(list, random)}` } },
  { id: 'product.vin', name: 'Vehicle Identification Number', reference: 'Vehicle Identification Number (VIN)', category: 'Product', columnTypes: TEXT, unique: true,
    synthetic: 'Random characters with a valid ISO 3779 check digit; the manufacturer code is not looked up.',
    generate: (random) => { const first = fromAlphabet(random, VIN_ALPHABET, 8); const rest = fromAlphabet(random, VIN_ALPHABET, 8); return `${first}${vinCheckCharacter(`${first}0${rest}`)}${rest}` }, validate: isValidVin },
  { id: 'product.weight-unit', name: 'Weight Unit', reference: 'Weight Unit', category: 'Product', columnTypes: TEXT, generate: (random) => pick(weightUnits, random), validate: (value) => weightUnits.includes(value) }
]

registerCatalogGenerators(definitions)
export const productGenerators: readonly CatalogGenerator[] = definitions
