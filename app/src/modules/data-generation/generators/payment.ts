import { digits, fromAlphabet, integer, luhnCheckDigit, luhnValid, pick, registerCatalogGenerators, type CatalogGenerator } from './types.js'

const metadata = [
  {
    "id": "payment.aba-routing-transit-number-aba-rtn",
    "reference": "ABA Routing Transit Number (ABA RTN)",
    "name": "ABA Routing Transit Number (ABA RTN)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.bank-identifier-code-swift-bic-iso-9362",
    "reference": "Bank Identifier Code (SWIFT-BIC, ISO 9362)",
    "name": "Bank Identifier Code (SWIFT-BIC, ISO 9362)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.canadian-transit-number",
    "reference": "Canadian Transit Number",
    "name": "Canadian Transit Number",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "int",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-expire-date-mm-yy",
    "reference": "Credit Card Expire Date (mm/yy)",
    "name": "Credit Card Expire Date (mm/yy)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-expire-month",
    "reference": "Credit Card Expire Month",
    "name": "Credit Card Expire Month",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "int",
      "longtext",
      "mediumint",
      "mediumtext",
      "smallint",
      "text",
      "tinyint",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-expire-year",
    "reference": "Credit Card Expire Year",
    "name": "Credit Card Expire Year",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "int",
      "longtext",
      "mediumint",
      "mediumtext",
      "smallint",
      "text",
      "tinyint",
      "tinytext",
      "varchar",
      "year"
    ]
  },
  {
    "id": "payment.credit-card-issue-number",
    "reference": "Credit Card Issue Number",
    "name": "Credit Card Issue Number",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "int",
      "longtext",
      "mediumint",
      "mediumtext",
      "smallint",
      "text",
      "tinyint",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-number-iso-iec-7812",
    "reference": "Credit Card Number (ISO IEC 7812)",
    "name": "Credit Card Number (ISO IEC 7812)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-security-code-cvv2",
    "reference": "Credit Card Security Code (CVV2)",
    "name": "Credit Card Security Code (CVV2)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.credit-card-type",
    "reference": "Credit Card Type",
    "name": "Credit Card Type",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.currency",
    "reference": "Currency",
    "name": "Currency",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.currency-code-iso-4217-alpha-3",
    "reference": "Currency Code (ISO 4217 alpha-3)",
    "name": "Currency Code (ISO 4217 alpha-3)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.currency-code-iso-4217-numeric",
    "reference": "Currency Code (ISO 4217 numeric)",
    "name": "Currency Code (ISO 4217 numeric)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "bigint",
      "char",
      "decimal",
      "int",
      "longtext",
      "mediumint",
      "mediumtext",
      "smallint",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.currency-rate",
    "reference": "Currency Rate",
    "name": "Currency Rate",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "decimal"
    ]
  },
  {
    "id": "payment.international-bank-account-number-iban-iso-13616-1",
    "reference": "International Bank Account Number (IBAN, ISO 13616-1)",
    "name": "International Bank Account Number (IBAN, ISO 13616-1)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.payment-method",
    "reference": "Payment Method",
    "name": "Payment Method",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "payment.value-added-tax-identification-number-vatin",
    "reference": "Value Added Tax Identification Number (VATIN)",
    "name": "Value Added Tax Identification Number (VATIN)",
    "category": "Payment",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "tinytext",
      "varchar"
    ]
  }
] as const

const currencies = [
  { name: 'United States Dollar', alpha: 'USD', numeric: 840 },
  { name: 'Euro', alpha: 'EUR', numeric: 978 },
  { name: 'Japanese Yen', alpha: 'JPY', numeric: 392 },
  { name: 'Canadian Dollar', alpha: 'CAD', numeric: 124 },
  { name: 'Pound Sterling', alpha: 'GBP', numeric: 826 }
] as const
const cardTypes = ['Visa', 'Mastercard', 'American Express', 'Discover'] as const
const paymentMethods = ['Bank transfer', 'Card present', 'Digital wallet', 'Direct debit', 'Prepaid account', 'Paper check'] as const
const ibanCountries = [
  { code: 'DE', length: 22 }, { code: 'GB', length: 22 }, { code: 'FR', length: 27 },
  { code: 'NL', length: 18 }, { code: 'ES', length: 24 }, { code: 'IT', length: 27 }
] as const
const alphas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const randomLetters = (random: () => number, count: number): string => fromAlphabet(random, alphas, count)

function abaNumber(random: () => number): string {
  const body = `000${digits(random, 5)}`
  const sum = [...body].reduce((total, digit, index) => total + Number(digit) * [3, 7, 1][index % 3]!, 0)
  return body + ((10 - sum % 10) % 10)
}
function abaValid(value: string): boolean {
  return /^\d{9}$/.test(value) && [...value].reduce((sum, digit, index) => sum + Number(digit) * [3, 7, 1][index % 3]!, 0) % 10 === 0
}
function bban(country: string, random: () => number): string {
  if (country === 'DE') return digits(random, 18)
  if (country === 'GB') return `${randomLetters(random, 4)}${digits(random, 14)}`
  if (country === 'FR') return `${digits(random, 10)}${fromAlphabet(random, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 11)}${digits(random, 2)}`
  if (country === 'NL') return `${randomLetters(random, 4)}${digits(random, 10)}`
  if (country === 'ES') return digits(random, 20)
  return `${randomLetters(random, 1)}${digits(random, 10)}${randomLetters(random, 1)}${digits(random, 11)}`
}
function ibanRemainder(value: string): number {
  let remainder = 0
  for (const char of value) {
    const digitsText = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digitsText) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder
}
function makeIban(random: () => number): string {
  const country = pick(ibanCountries, random)
  const account = `${country.code}00${bban(country.code, random)}`
  const check = String(98 - ibanRemainder(`${account.slice(4)}${account.slice(0, 2)}00`)).padStart(2, '0')
  return `${country.code}${check}${account.slice(4)}`
}
function ibanValid(value: string): boolean {
  const normalized = value.replaceAll(' ', '').toUpperCase()
  const country = ibanCountries.find((item) => item.code === normalized.slice(0, 2))
  return Boolean(country && normalized.length === country.length && /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized) && ibanRemainder(`${normalized.slice(4)}${normalized.slice(0, 4)}`) === 1)
}
function cardNumber(random: () => number): string { const body = `9${digits(random, 14)}`; return body + luhnCheckDigit(body) }
function paymentValue(reference: string, random: () => number, index: number): string | number {
  switch (reference) {
    case 'ABA Routing Transit Number (ABA RTN)': return abaNumber(random)
    case 'Bank Identifier Code (SWIFT-BIC, ISO 9362)': return `TSTXZZ${fromAlphabet(random, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2)}${random() < 0.5 ? '' : randomLetters(random, 3)}`
    case 'Canadian Transit Number': return Number(`${String(integer(random, 10000, 99999))}${String(integer(random, 0, 999)).padStart(3, '0')}`)
    case 'Credit Card Expire Date (mm/yy)': return `${String(1 + Math.floor(random() * 12)).padStart(2, '0')}/${String(27 + Math.floor(random() * 8))}`
    case 'Credit Card Expire Month': return integer(random, 1, 12)
    case 'Credit Card Expire Year': return 2027 + Math.floor(random() * 8)
    case 'Credit Card Issue Number': return integer(random, 1, 9)
    case 'Credit Card Number (ISO IEC 7812)': return cardNumber(random)
    case 'Credit Card Security Code (CVV2)': return digits(random, 3)
    case 'Credit Card Type': return pick(cardTypes, random)
    case 'Currency': return pick(currencies, random).name
    case 'Currency Code (ISO 4217 alpha-3)': return pick(currencies, random).alpha
    case 'Currency Code (ISO 4217 numeric)': return pick(currencies, random).numeric
    case 'Currency Rate': return Math.round((0.25 + random() * 4.75) * 100000) / 100000
    case 'International Bank Account Number (IBAN, ISO 13616-1)': return makeIban(random)
    case 'Payment Method': return pick(paymentMethods, random)
    case 'Value Added Tax Identification Number (VATIN)': {
      const country = pick(['DE', 'GB', 'FR', 'IT'], random)
      if (country === 'FR') return `FR${randomLetters(random, 2)}${digits(random, 9)}`
      if (country === 'IT') return `IT${digits(random, 11)}`
      return `${country}${digits(random, 9)}`
    }
    default: throw new Error(`Unknown Payment generator at row ${index}: ${reference}`)
  }
}

const validators: Record<string, (value: string) => boolean> = {
  'ABA Routing Transit Number (ABA RTN)': abaValid,
  'Bank Identifier Code (SWIFT-BIC, ISO 9362)': (value) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(value),
  'Credit Card Expire Date (mm/yy)': (value) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(value),
  'Credit Card Number (ISO IEC 7812)': (value) => /^9\d{14}\d$/.test(value) && luhnValid(value),
  'Credit Card Security Code (CVV2)': (value) => /^\d{3}$/.test(value),
  'Currency Code (ISO 4217 alpha-3)': (value) => currencies.some((item) => item.alpha === value),
  'International Bank Account Number (IBAN, ISO 13616-1)': ibanValid,
  'Value Added Tax Identification Number (VATIN)': (value) => /^(DE\d{9}|GB\d{9}|FR[A-Z]{2}\d{9}|IT\d{11})$/.test(value)
}

const uniqueRefs = new Set(['ABA Routing Transit Number (ABA RTN)', 'Credit Card Number (ISO IEC 7812)', 'International Bank Account Number (IBAN, ISO 13616-1)'])

export const paymentGenerators: readonly CatalogGenerator[] = metadata.map((entry) => ({
  ...entry,
  unique: uniqueRefs.has(entry.name),
  synthetic: 'Fabricated, test-only values; never use for payment, account access, or real identity verification.',
  generate: (random, context) => paymentValue(entry.name, random, context.index),
  ...(validators[entry.name] ? { validate: validators[entry.name] } : {})
}))

registerCatalogGenerators(paymentGenerators)
