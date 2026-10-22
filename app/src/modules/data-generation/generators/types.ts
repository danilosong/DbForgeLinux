import { seededRandom, type Random } from '../generators.js'

export { seededRandom }
export type { Random }

/** Categories of document/paridade/data-generators-manifest.json. */
export type CatalogCategory = 'Business' | 'Product' | 'Personal' | 'Location' | 'IT' | 'Payment' | 'Health'
export type CatalogValue = string | number | Uint8Array

export interface CatalogContext {
  /** 0-based row ordinal, for sequential generators. */
  index: number
  locale: 'en-US' | 'pt-BR'
  /** Target column type (manifest spelling, e.g. 'int', 'varchar'); numeric types get digit-only or range-limited values. */
  columnType?: string
}

/** Largest value that fits every numeric column type the generator may target. */
export function numericCeiling(columnType: string | undefined, preferred: number): number {
  const limits: Record<string, number> = { tinyint: 127, utinyint: 255, smallint: 32_767, usmallint: 65_535, mediumint: 8_388_607, umediumint: 16_777_215, int: 2_147_483_647, uint: 4_294_967_295 }
  return Math.min(preferred, limits[columnType ?? ''] ?? preferred)
}
export function isNumericColumn(columnType: string | undefined): boolean { return /^u?(?:tinyint|smallint|mediumint|int|bigint|decimal|double|float)$/.test(columnType ?? '') }

/**
 * A named generator equivalent to one manifest entry. Data lists are original and synthetic;
 * identifiers with a check digit are well-formed but drawn from test/reserved ranges when the
 * standard offers one (`synthetic` says how), so they are not mistaken for real records.
 */
export interface CatalogGenerator {
  /** Stable id, `<category>.<slug>`; never renamed once shipped. */
  id: string
  /** English source name (also the i18n key; PT-BR lives in ptBrModules<Area>.ts). */
  name: string
  /** Exact manifest name this generator covers. */
  reference: string
  category: CatalogCategory
  languages?: readonly string[]
  columnTypes: readonly string[]
  /** True when the value space is large enough to honour a UNIQUE column. */
  unique?: boolean
  /** How the output is kept from colliding with real-world records, when relevant. */
  synthetic?: string
  generate(random: Random, context: CatalogContext): CatalogValue
  /** Format/check-digit validator for generators whose standard defines one. */
  validate?(value: string): boolean
}

const registered: CatalogGenerator[] = []

/** Called once by each category file; rejects duplicate ids or references across categories. */
export function registerCatalogGenerators(generators: readonly CatalogGenerator[]): void {
  for (const generator of generators) {
    if (!/^[a-z]+\.[a-z0-9-]+$/.test(generator.id)) throw new Error(`Invalid catalog generator id: ${generator.id}`)
    if (registered.some((item) => item.id === generator.id)) throw new Error(`Duplicate catalog generator id: ${generator.id}`)
    if (registered.some((item) => item.reference === generator.reference)) throw new Error(`Duplicate catalog generator reference: ${generator.reference}`)
    registered.push(generator)
  }
}

export function registeredCatalogGenerators(): readonly CatalogGenerator[] { return registered }

// Small deterministic helpers shared by the category files.
export function pick<T>(values: readonly T[], random: Random): T { return values[Math.floor(random() * values.length)]! }
export function integer(random: Random, min: number, max: number): number { return min + Math.floor(random() * (max - min + 1)) }
export function digits(random: Random, length: number): string { let out = ''; for (let index = 0; index < length; index++) out += String(Math.floor(random() * 10)); return out }
export function fromAlphabet(random: Random, alphabet: string, length: number): string { let out = ''; for (let index = 0; index < length; index++) out += alphabet[Math.floor(random() * alphabet.length)]; return out }
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const HEX = '0123456789ABCDEF'

/** Luhn (mod 10) check digit for a digit string (ISO/IEC 7812-1). */
export function luhnCheckDigit(payload: string): number {
  let sum = 0
  for (let index = 0; index < payload.length; index++) {
    let value = Number(payload[payload.length - 1 - index])
    if (index % 2 === 0) { value *= 2; if (value > 9) value -= 9 }
    sum += value
  }
  return (10 - (sum % 10)) % 10
}
export function luhnValid(value: string): boolean { return /^\d{2,}$/.test(value) && luhnCheckDigit(value.slice(0, -1)) === Number(value.at(-1)) }

/** GS1 mod 10 check digit (EAN/UPC/ISBN-13/ISMN-13/ISSN-13): weights 3,1 from the right. */
export function gs1CheckDigit(payload: string): number {
  let sum = 0
  for (let index = 0; index < payload.length; index++) sum += Number(payload[payload.length - 1 - index]) * (index % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10
}
export function gs1Valid(value: string): boolean { return /^\d{8,18}$/.test(value) && gs1CheckDigit(value.slice(0, -1)) === Number(value.at(-1)) }

/** Draws `count` values, unique when asked; gives up instead of looping forever on a small value space. */
export function generateSeries(generator: CatalogGenerator, seed: number | string, count: number, options: { unique?: boolean; locale?: CatalogContext['locale'] } = {}): CatalogValue[] {
  const random = seededRandom(seed)
  const values: CatalogValue[] = []
  const seen = new Set<string>()
  for (let index = 0, attempts = 0; values.length < count; attempts++) {
    if (attempts > count * 50 + 1000) throw new Error(`${generator.name}: not enough distinct values for ${count} unique rows.`)
    const value = generator.generate(random, { index, locale: options.locale ?? 'en-US' })
    const key = value instanceof Uint8Array ? Buffer.from(value).toString('base64') : String(value)
    if (options.unique && seen.has(key)) continue
    seen.add(key); values.push(value); index++
  }
  return values
}
