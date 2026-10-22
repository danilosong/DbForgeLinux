import { digits, fromAlphabet, integer, isNumericColumn, luhnCheckDigit, numericCeiling, pick, registerCatalogGenerators, UPPER, type CatalogContext, type CatalogGenerator, type Random } from './types.js'
import { ptBrBusinessPools } from './ptBrSamplePools.js'

// Business-category generators. Word lists are original; codes and check digits follow public
// standards (ISO 6166, CUSIP, SEDOL, IMO, ISIC/SIC/NAICS classification codes).
const TEXT = ['char', 'longtext', 'mediumtext', 'text', 'tinytext', 'varchar'] as const
const TEXT_AND_INT = ['bigint', 'char', 'decimal', 'int', 'longtext', 'mediumtext', 'text', 'tinytext', 'varchar'] as const
const CLASSIFICATION = ['bigint', 'char', 'decimal', 'int', 'longtext', 'mediumint', 'mediumtext', 'smallint', 'text', 'tinytext', 'varchar'] as const

const byLocale = <T>(context: CatalogContext, en: readonly T[], pt: readonly T[]): readonly T[] => context.locale === 'pt-BR' ? pt : en
const alnumValue = (char: string): number => /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 55

// --- Check-digit algorithms -------------------------------------------------------------

/** ISO 6166: letters become 10..35, then Luhn over the digit string. */
export function isinCheckDigit(payload: string): number { return luhnCheckDigit([...payload].map((char) => String(alnumValue(char))).join('')) }
export function isValidIsin(value: string): boolean { return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value) && isinCheckDigit(value.slice(0, 11)) === Number(value[11]) }

/** CUSIP: doubles every second character's value and sums the digits of each product. */
export function cusipCheckDigit(payload: string): number {
  let sum = 0
  for (let index = 0; index < 8; index++) {
    let value = alnumValue(payload[index]!)
    if (index % 2 === 1) value *= 2
    sum += Math.floor(value / 10) + (value % 10)
  }
  return (10 - (sum % 10)) % 10
}
export function isValidCusip(value: string): boolean { return /^[0-9A-Z]{8}\d$/.test(value) && cusipCheckDigit(value) === Number(value[8]) }

/** SEDOL: weights 1,3,1,7,3,9 over a six-character body without vowels. */
export function sedolCheckDigit(payload: string): number {
  const weights = [1, 3, 1, 7, 3, 9]
  const sum = [...payload].reduce((total, char, index) => total + alnumValue(char) * weights[index]!, 0)
  return (10 - (sum % 10)) % 10
}
export function isValidSedol(value: string): boolean { return /^[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}\d$/.test(value) && sedolCheckDigit(value.slice(0, 6)) === Number(value[6]) }

/** IMO ship number: digits 1-6 weighted 7..2, sum mod 10. */
export function imoCheckDigit(payload: string): number { return [...payload].reduce((total, char, index) => total + Number(char) * (7 - index), 0) % 10 }
export function isValidImo(value: string): boolean {
  const body = value.replace(/^IMO ?/, '')
  return /^\d{7}$/.test(body) && imoCheckDigit(body.slice(0, 6)) === Number(body[6])
}

// --- Original lists -------------------------------------------------------------------

const companyWords = {
  en: { first: ['Amber', 'Cobalt', 'Cedar', 'Harbor', 'Juniper', 'Lumen', 'Maple', 'Orchid', 'Quartz', 'Riverbend', 'Summit', 'Tidal', 'Willow', 'Zephyr', 'Kestrel', 'Basalt'], second: ['Analytics', 'Bakery', 'Freight', 'Foods', 'Holdings', 'Labs', 'Logistics', 'Media', 'Outfitters', 'Robotics', 'Systems', 'Textiles', 'Ventures', 'Works'], suffix: ['Inc.', 'LLC', 'Ltd.', 'Co.', 'Group', 'Corp.'] },
}
const departments = { en: ['Accounting', 'Customer Support', 'Engineering', 'Finance', 'Human Resources', 'Legal', 'Logistics', 'Marketing', 'Operations', 'Procurement', 'Product', 'Quality Assurance', 'Research and Development', 'Sales', 'Security'] }
const sectors = { en: ['Agriculture', 'Construction', 'Education', 'Energy', 'Financial Services', 'Healthcare', 'Hospitality', 'Information Technology', 'Manufacturing', 'Media and Entertainment', 'Mining', 'Real Estate', 'Retail', 'Telecommunications', 'Transportation', 'Utilities'] }
const leadSources = { en: ['Website form', 'Referral', 'Trade show', 'Cold call', 'Email campaign', 'Social media', 'Webinar', 'Partner', 'Paid search', 'Organic search', 'Event', 'Chat'] }
const leadStatuses = { en: ['New', 'Contacted', 'Working', 'Nurturing', 'Qualified', 'Unqualified', 'Converted', 'Lost'] }

// Public classification codes (titles as published by the respective standard bodies).
const isic: ReadonlyArray<readonly [string, string]> = [
  ['0111', 'Growing of cereals (except rice), leguminous crops and oil seeds'], ['0141', 'Raising of cattle and buffaloes'], ['1010', 'Processing and preserving of meat'], ['1071', 'Manufacture of bakery products'],
  ['2011', 'Manufacture of basic chemicals'], ['2620', 'Manufacture of computers and peripheral equipment'], ['2910', 'Manufacture of motor vehicles'], ['3510', 'Electric power generation, transmission and distribution'],
  ['4100', 'Construction of buildings'], ['4921', 'Urban and suburban passenger land transport'], ['5510', 'Short term accommodation activities'], ['5610', 'Restaurants and mobile food service activities'],
  ['6201', 'Computer programming activities'], ['6419', 'Other monetary intermediation'], ['6810', 'Real estate activities with own or leased property'], ['7110', 'Architectural and engineering activities and related technical consultancy'],
  ['8510', 'Pre-primary and primary education'], ['8610', 'Hospital activities']
]
const sic: ReadonlyArray<readonly [string, string]> = [
  ['0111', 'Wheat'], ['1311', 'Crude Petroleum and Natural Gas'], ['1521', 'General Contractors-Single-Family Houses'], ['2011', 'Meat Packing Plants'], ['2834', 'Pharmaceutical Preparations'],
  ['3571', 'Electronic Computers'], ['3711', 'Motor Vehicles and Passenger Car Bodies'], ['4512', 'Air Transportation, Scheduled'], ['4911', 'Electric Services'], ['5411', 'Grocery Stores'],
  ['5812', 'Eating Places'], ['6021', 'National Commercial Banks'], ['6512', 'Operators of Nonresidential Buildings'], ['7372', 'Prepackaged Software'], ['8011', 'Offices and Clinics of Doctors of Medicine'],
  ['8062', 'General Medical and Surgical Hospitals'], ['8221', 'Colleges, Universities, and Professional Schools']
]
const ukSic: ReadonlyArray<readonly [string, string]> = [
  ['01110', 'Growing of cereals (except rice), leguminous crops and oil seeds'], ['10710', 'Manufacture of bread; manufacture of fresh pastry goods and cakes'], ['41201', 'Construction of commercial buildings'], ['41202', 'Construction of domestic buildings'],
  ['47110', 'Retail sale in non-specialised stores with food, beverages or tobacco predominating'], ['56101', 'Licensed restaurants'], ['56102', 'Unlicensed restaurants and cafes'], ['62012', 'Business and domestic software development'],
  ['62020', 'Information technology consultancy activities'], ['64191', 'Banks'], ['68209', 'Other letting and operating of own or leased real estate'], ['69201', 'Accounting and auditing activities'],
  ['70229', 'Management consultancy activities other than financial management'], ['85310', 'General secondary education'], ['86101', 'Hospital activities'], ['96020', 'Hairdressing and other beauty treatment']
]
const naics = ['111110', '236115', '311811', '334111', '445110', '481111', '513210', '522110', '541330', '541511', '611310', '622110', '722511', '812111']
// US federal supply classes (first four NSN digits) and NATO codification bureau codes.
const nsnClasses = ['5305', '5310', '5340', '5895', '5965', '6505', '6515', '6685', '7025', '7510', '8415', '8465']
const ncbCodes = ['00', '01', '12', '14', '17', '21', '66']
const isinCountries = ['US', 'GB', 'DE', 'FR', 'BR', 'JP', 'CA', 'AU', 'NL', 'CH']
// IRS campus prefixes that are assigned for EINs.
const feinPrefixes = ['01', '02', '03', '04', '05', '06', '10', '11', '12', '13', '14', '15', '16', '20', '21', '22', '23', '24', '25', '26', '27', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '71', '72', '73', '74', '75', '76', '77', '80', '81', '82', '83', '84', '85', '86', '87', '88', '90', '91', '92', '93', '94', '95', '98', '99']
const crnPrefixes = ['', '', '', 'SC', 'NI', 'OC', 'SO', 'NC', 'LP', 'SL']
const SEDOL_ALPHABET = '0123456789BCDFGHJKLMNPQRSTVWXYZ'
const NCAGE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

/** Classification codes that fit a numeric target column (UK SIC 47110 does not fit a SMALLINT). */
const codeFor = (codes: ReadonlyArray<readonly [string, string]>, random: Random, context: CatalogContext): string => {
  const ceiling = numericCeiling(context.columnType, Number.MAX_SAFE_INTEGER)
  const fitting = isNumericColumn(context.columnType) ? codes.filter(([code]) => Number(code) <= ceiling) : codes
  return pick(fitting.length ? fitting : codes, random)[0]
}
const sequentialText = (index: number): string => String(index + 1).padStart(8, '0')
const twoLetters = (value: number): string => UPPER[Math.floor(value / 26) % 26]! + UPPER[value % 26]!
function uuidV4(random: Random): string {
  const hex = fromAlphabet(random, '0123456789abcdef', 32).split('')
  hex[12] = '4'
  hex[16] = '89ab'[Math.floor(random() * 4)]!
  const text = hex.join('')
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}
const digitsOnly = (context: CatalogContext, formatted: string): string => isNumericColumn(context.columnType) ? formatted.replace(/\D/g, '') : formatted

const definitions: CatalogGenerator[] = [
  { id: 'business.annual-revenue', name: 'Annual Revenue', reference: 'Annual Revenue', category: 'Business', columnTypes: ['bigint', 'decimal', 'double', 'float', 'int', 'mediumint'],
    generate: (random, context) => { const ceiling = numericCeiling(context.columnType, 5_000_000_000); return Math.round(Math.exp(Math.log(10_000) + random() * (Math.log(ceiling) - Math.log(10_000))) / 1000) * 1000 },
    validate: (value) => /^\d+$/.test(value) && Number(value) >= 10_000 },
  { id: 'business.ncage-code', name: 'NCAGE Code', reference: 'Commercial and Government Entity Code (NCAGE Code)', category: 'Business', columnTypes: TEXT, unique: true,
    synthetic: 'Random letters/digits in the NCAGE shape; not looked up in the NATO registry.',
    generate: (random) => `${fromAlphabet(random, NCAGE_LETTERS, 1)}${digits(random, 3)}${fromAlphabet(random, NCAGE_LETTERS, 1)}`,
    validate: (value) => /^[A-HJ-NP-Z0-9]{5}$/.test(value) },
  { id: 'business.company', name: 'Company', reference: 'Company', category: 'Business', columnTypes: TEXT,
    generate: (random, context) => { const words = context.locale === 'pt-BR' ? ptBrBusinessPools.company : companyWords.en; return `${pick(words.first, random)} ${pick(words.second, random)} ${pick(words.suffix, random)}` } },
  { id: 'business.duns-number', name: 'DUNS Number', reference: 'Data Universal Numbering System Number (DUNS Number)', category: 'Business', columnTypes: ['bigint', 'char', 'int', 'longtext', 'mediumtext', 'text', 'varchar'], unique: true,
    synthetic: 'Nine random digits; DUNS has no check digit and the value is not looked up.',
    generate: (random) => `${integer(random, 1, 9)}${digits(random, 8)}`, validate: (value) => /^\d{9}$/.test(value) },
  { id: 'business.department', name: 'Department', reference: 'Department', category: 'Business', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, departments.en, ptBrBusinessPools.departments), random) },
  { id: 'business.id-composite-sequential', name: 'Composite Sequential ID', reference: 'ID (composite sequential)', category: 'Business', columnTypes: TEXT, unique: true,
    generate: (_random, context) => `${twoLetters(Math.floor(context.index / 9999))}-${String((context.index % 9999) + 1).padStart(4, '0')}`, validate: (value) => /^[A-Z]{2}-\d{4}$/.test(value) },
  { id: 'business.id-guid', name: 'Globally Unique Identifier', reference: 'ID (globally unique identifier)', category: 'Business', columnTypes: TEXT, unique: true,
    generate: (random) => uuidV4(random), validate: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) },
  { id: 'business.id-hex-sequential', name: 'Hexadecimal Sequential ID', reference: 'ID (hexadecimal sequential)', category: 'Business', columnTypes: TEXT, unique: true,
    generate: (_random, context) => (context.index + 1).toString(16).toUpperCase().padStart(8, '0'), validate: (value) => /^[0-9A-F]{8,}$/.test(value) },
  { id: 'business.id-numeric-sequential', name: 'Numeric Sequential ID', reference: 'ID (numeric sequential)', category: 'Business', columnTypes: TEXT, unique: true,
    generate: (_random, context) => sequentialText(context.index), validate: (value) => /^\d{8,}$/.test(value) },
  { id: 'business.id-random', name: 'Random ID', reference: 'ID (random)', category: 'Business', columnTypes: TEXT, unique: true,
    generate: (random) => fromAlphabet(random, `${UPPER}0123456789`, 12), validate: (value) => /^[A-Z0-9]{12}$/.test(value) },
  { id: 'business.id-sequential', name: 'Sequential ID', reference: 'ID (sequential)', category: 'Business', unique: true,
    columnTypes: ['bigint', 'double', 'int', 'mediumint', 'smallint', 'tinyint', 'ubigint', 'udouble', 'uint', 'umediumint', 'usmallint', 'utinyint'],
    generate: (_random, context) => context.index + 1, validate: (value) => /^[1-9]\d*$/.test(value) },
  { id: 'business.industry-sector', name: 'Industry Sector', reference: 'Industry Sector', category: 'Business', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, sectors.en, ptBrBusinessPools.sectors), random) },
  { id: 'business.imo-number', name: 'IMO Ship Number', reference: 'International Maritime Organization Number (IMO)', category: 'Business', columnTypes: ['char', 'decimal', 'int', 'longtext', 'mediumtext', 'text', 'tinytext', 'varchar'], unique: true,
    synthetic: 'Random body with a valid IMO check digit; not looked up in the IHS/IMO register.',
    generate: (random, context) => { const body = `${integer(random, 1, 9)}${digits(random, 5)}`; const value = `${body}${imoCheckDigit(body)}`; return isNumericColumn(context.columnType) ? value : `IMO ${value}` },
    validate: isValidImo },
  { id: 'business.isin', name: 'ISIN', reference: 'International Securities Identification Number (ISIN, ISO 6166)', category: 'Business', columnTypes: TEXT, unique: true,
    synthetic: 'Real country prefix with a random national number and a valid check digit; not looked up.',
    generate: (random) => { const body = `${pick(isinCountries, random)}${fromAlphabet(random, `0123456789${UPPER}`, 2)}${digits(random, 7)}`; return `${body}${isinCheckDigit(body)}` },
    validate: isValidIsin },
  { id: 'business.isic-code', name: 'ISIC Rev.4 Code', reference: 'International Standard Industrial Classification Code (ISIC Rev.4)', category: 'Business', columnTypes: CLASSIFICATION,
    generate: (random, context) => codeFor(isic, random, context), validate: (value) => isic.some(([code]) => code === value || Number(code) === Number(value)) },
  { id: 'business.isic-title', name: 'ISIC Rev.4 Title', reference: 'International Standard Industrial Classification Code Title (ISIC Rev.4)', category: 'Business', columnTypes: TEXT,
    generate: (random) => pick(isic, random)[1], validate: (value) => isic.some(([, title]) => title === value) },
  { id: 'business.lead-source', name: 'Lead Source', reference: 'Lead Source', category: 'Business', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, leadSources.en, ptBrBusinessPools.leadSources), random) },
  { id: 'business.lead-status', name: 'Lead Status', reference: 'Lead Status', category: 'Business', columnTypes: TEXT, generate: (random, context) => pick(byLocale(context, leadStatuses.en, ptBrBusinessPools.leadStatuses), random) },
  { id: 'business.nsn', name: 'National Stock Number', reference: 'National Stock Number (NSN)', category: 'Business', columnTypes: TEXT, unique: true,
    synthetic: 'Real supply class and bureau code with a random item number; not looked up.',
    generate: (random) => `${pick(nsnClasses, random)}-${pick(ncbCodes, random)}-${digits(random, 3)}-${digits(random, 4)}`, validate: (value) => /^\d{4}-\d{2}-\d{3}-\d{4}$/.test(value) },
  { id: 'business.sic-code', name: 'SIC Code', reference: 'Standard Industrial Classification Code (SIC)', category: 'Business', columnTypes: CLASSIFICATION,
    generate: (random, context) => codeFor(sic, random, context), validate: (value) => sic.some(([code]) => code === value || Number(code) === Number(value)) },
  { id: 'business.sic-title', name: 'SIC Title', reference: 'Standard Industrial Classification Code Title (SIC)', category: 'Business', columnTypes: TEXT,
    generate: (random) => pick(sic, random)[1], validate: (value) => sic.some(([, title]) => title === value) },
  { id: 'business.stock-ticker', name: 'Stock Ticker', reference: 'Stock Ticker Code', category: 'Business', columnTypes: TEXT, unique: true,
    synthetic: 'Random 1-5 letter symbol; may coincide with a listed ticker by chance.',
    generate: (random) => fromAlphabet(random, UPPER, integer(random, 1, 5)), validate: (value) => /^[A-Z]{1,5}$/.test(value) },
  { id: 'business.uk-crn', name: 'UK Company Registration Number', reference: 'UK Company Registration Number (CRN)', category: 'Business', languages: ['GB'], columnTypes: TEXT, unique: true,
    synthetic: 'Real register prefixes with random numbers; not looked up at Companies House.',
    generate: (random) => { const prefix = pick(crnPrefixes, random); return `${prefix}${digits(random, 8 - prefix.length)}` },
    validate: (value) => /^(?:\d{8}|(?:SC|NI|OC|SO|NC|LP|SL)\d{6})$/.test(value) },
  { id: 'business.uk-sic-code', name: 'UK SIC Code', reference: 'UK Standard Industrial Classification Code (UK SIC)', category: 'Business', languages: ['GB'], columnTypes: CLASSIFICATION,
    generate: (random, context) => codeFor(ukSic, random, context), validate: (value) => ukSic.some(([code]) => code === value || Number(code) === Number(value)) },
  { id: 'business.uk-sic-title', name: 'UK SIC Title', reference: 'UK Standard Industrial Classification Code Title (UK SIC)', category: 'Business', languages: ['GB'], columnTypes: TEXT,
    generate: (random) => pick(ukSic, random)[1], validate: (value) => ukSic.some(([, title]) => title === value) },
  { id: 'business.sedol', name: 'SEDOL', reference: 'UK Stock Exchange Daily Official List Number (SEDOL)', category: 'Business', languages: ['GB'], columnTypes: TEXT, unique: true,
    synthetic: 'Starts with B like modern allocations, random body, valid check digit; not looked up.',
    generate: (random) => { const body = `B${fromAlphabet(random, SEDOL_ALPHABET, 5)}`; return `${body}${sedolCheckDigit(body)}` }, validate: isValidSedol },
  { id: 'business.cusip', name: 'CUSIP', reference: 'US Committee on Uniform Security Identification Procedures Code (CUSIP)', category: 'Business', columnTypes: TEXT, unique: true,
    synthetic: 'Random issuer and issue with a valid check digit; not looked up.',
    generate: (random) => { const body = `${digits(random, 3)}${fromAlphabet(random, `0123456789${UPPER}`, 3)}${fromAlphabet(random, `0123456789${UPPER}`, 2)}`; return `${body}${cusipCheckDigit(body)}` }, validate: isValidCusip },
  { id: 'business.fein', name: 'US Employer Identification Number', reference: 'US Federal Employer Identification Number (FEIN/FEID)', category: 'Business', columnTypes: TEXT_AND_INT, unique: true,
    synthetic: 'Assigned IRS campus prefix with random digits; EINs have no check digit and the value is not looked up.',
    generate: (random, context) => digitsOnly(context, `${pick(feinPrefixes, random)}-${digits(random, 7)}`),
    validate: (value) => { const match = /^(\d{2})-?(\d{7})$/.exec(value); return Boolean(match && feinPrefixes.includes(match[1]!)) } },
  { id: 'business.naics-code', name: 'NAICS Code', reference: 'US North American Industry Classification System Code (NAICS)', category: 'Business', columnTypes: TEXT_AND_INT,
    generate: (random) => pick(naics, random), validate: (value) => naics.includes(value) }
]

registerCatalogGenerators(definitions)
export const businessGenerators: readonly CatalogGenerator[] = definitions
