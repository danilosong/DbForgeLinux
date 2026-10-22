import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { findCatalogGeneratorByReference } from '../../src/modules/data-generation/generators/registry.js'
import { businessGenerators, cusipCheckDigit, isValidCusip, isValidImo, isValidIsin, isValidSedol } from '../../src/modules/data-generation/generators/business.js'
import { codenCheckCharacter, isValidCoden, isValidIsbn10, isValidIssn, isValidS10, isValidVin, PNG_SIGNATURE, productGenerators } from '../../src/modules/data-generation/generators/product.js'
import { generateSeries, isNumericColumn, seededRandom, type CatalogGenerator } from '../../src/modules/data-generation/generators/types.js'

interface ManifestEntry { name: string; category: string; languages?: string[]; columnTypes: string[] }
const manifest = JSON.parse(readFileSync(new URL('../../../document/paridade/data-generators-manifest.json', import.meta.url), 'utf8')) as { generators: ManifestEntry[] }
const mine: readonly CatalogGenerator[] = [...businessGenerators, ...productGenerators]
const sqlTypes = (entry: ManifestEntry): string[] => entry.columnTypes.filter((type) => /^u?[a-z]+$/.test(type))

describe('Business and Product generators cover the manifest', () => {
  it.each(['Business', 'Product'])('every %s manifest entry has an equivalent with the same metadata', (category) => {
    const entries = manifest.generators.filter((entry) => entry.category === category)
    expect(entries.length).toBe(category === 'Business' ? 29 : 35)
    for (const entry of entries) {
      const generator = findCatalogGeneratorByReference(entry.name)
      expect(generator, entry.name).toBeDefined()
      expect(generator!.category).toBe(category)
      expect([...(generator!.languages ?? [])]).toEqual(entry.languages ?? [])
      expect([...generator!.columnTypes].sort(), entry.name).toEqual(sqlTypes(entry).sort())
      expect(generator!.id).toMatch(new RegExp(`^${category.toLowerCase()}\\.[a-z0-9-]+$`))
      expect(generator!.name.length).toBeGreaterThan(0)
    }
    expect(new Set(mine.map((generator) => generator.id)).size).toBe(mine.length)
  })
})

describe.each(mine.map((generator) => [generator.reference, generator] as const))('%s', (_reference, generator) => {
  it('is deterministic per seed and its validator accepts 200 of its own values (both locales)', () => {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      const values = generateSeries(generator, `bp:${generator.id}`, 200, { locale })
      expect(generateSeries(generator, `bp:${generator.id}`, 200, { locale })).toEqual(values)
      for (const value of values) {
        expect(typeof value === 'string' || typeof value === 'number' || value instanceof Uint8Array).toBe(true)
        if (typeof value === 'string') expect(value.length).toBeGreaterThan(0)
        if (generator.validate) expect(generator.validate(String(value)), `${generator.id}: ${String(value)}`).toBe(true)
      }
    }
  })

  it.runIf(Boolean(generator.unique))('honours UNIQUE with 200 distinct values', () => {
    expect(new Set(generateSeries(generator, 99, 200, { unique: true }).map(String)).size).toBe(200)
  })

  it('fits every numeric column type it declares', () => {
    const limits: Record<string, number> = { tinyint: 127, utinyint: 255, smallint: 32_767, usmallint: 65_535, mediumint: 8_388_607, umediumint: 16_777_215, int: 2_147_483_647, uint: 4_294_967_295 }
    for (const columnType of generator.columnTypes.filter(isNumericColumn)) {
      const random = seededRandom(`num:${generator.id}:${columnType}`)
      // A sequential key can only hold as many rows as its type allows.
      const rows = generator.id === 'business.id-sequential' ? Math.min(200, limits[columnType] ?? 200) : 200
      for (let index = 0; index < rows; index++) {
        const value = String(generator.generate(random, { index, locale: 'en-US', columnType }))
        expect(value, `${generator.id} as ${columnType}`).toMatch(/^\d+(?:\.\d+)?$/)
        if (limits[columnType] !== undefined) expect(Number(value), `${generator.id} as ${columnType}`).toBeLessThanOrEqual(limits[columnType]!)
      }
    }
  })
})

describe('check-digit algorithms', () => {
  it('match published reference values', () => {
    expect(isValidIsin('US0378331005')).toBe(true)
    expect(isValidCusip('037833100')).toBe(true)
    expect(cusipCheckDigit('03783310')).toBe(0)
    expect(isValidSedol('0263494')).toBe(true)
    expect(isValidImo('IMO 9074729')).toBe(true)
    expect(isValidVin('1M8GDM9AXKP042788')).toBe(true)
    expect(isValidIsbn10('0306406152')).toBe(true)
    expect(isValidIssn('0378-5955')).toBe(true)
    expect(isValidS10('RR473124829GB')).toBe(true)
    expect(isValidS10('RR473124828GB')).toBe(false)
    // NBS Technical Note 738 worked examples.
    expect(codenCheckCharacter('JACSA')).toBe('T')
    expect(codenCheckCharacter('NBTNA')).toBe('E')
    expect(isValidCoden('NBTNAE')).toBe(true)
  })

  it('reject any single-character change of a generated value', () => {
    const checked = mine.filter((generator) => ['business.isin', 'business.cusip', 'business.sedol', 'business.imo-number', 'product.coden', 'product.ean13', 'product.imei', 'product.isbn10', 'product.isbn13', 'product.ismn13', 'product.issn', 'product.issn13', 'product.upc-a', 'product.upu-s10', 'product.vin'].includes(generator.id))
    expect(checked).toHaveLength(15)
    for (const generator of checked) {
      for (const value of generateSeries(generator, `mutate:${generator.id}`, 40).map(String)) {
        const position = value.search(/\d/)
        const mutated = `${value.slice(0, position)}${(Number(value[position]) + 1) % 10}${value.slice(position + 1)}`
        expect(generator.validate!(mutated), `${generator.id}: ${value} -> ${mutated}`).toBe(false)
      }
    }
  })
})

describe('synthetic ranges', () => {
  const values = (id: string): string[] => generateSeries(mine.find((generator) => generator.id === id)!, 'synthetic', 200).map(String)
  it('uses GS1 restricted circulation, in-store UPC, ITU test network and test TAC ranges', () => {
    expect(values('product.ean13').every((value) => /^2/.test(value))).toBe(true)
    expect(values('product.upc-a').every((value) => /^4/.test(value))).toBe(true)
    expect(values('product.imsi').every((value) => value.startsWith('00101'))).toBe(true)
    expect(values('product.imei').every((value) => value.startsWith('00'))).toBe(true)
    for (const generator of mine.filter((item) => item.validate && /isin|cusip|sedol|imo|duns|fein|crn|ncage|nsn|vin|isbn|issn|ismn|coden|asin|imei|imsi|upu|ticker|plate/.test(item.id))) {
      expect(generator.synthetic ?? (generator.id.includes('ismn13') || generator.id.includes('issn13') ? 'derived' : undefined), generator.id).toBeTruthy()
    }
  })
})

describe('Product Images', () => {
  it('produces a valid 32x32 RGB PNG per row, deterministic per seed', () => {
    const generator = findCatalogGeneratorByReference('Product Images')!
    const [image] = generateSeries(generator, 'png', 1) as Buffer[]
    expect(image!.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
    expect(image!.readUInt32BE(16)).toBe(32)
    expect(image!.readUInt32BE(20)).toBe(32)
    const idatLength = image!.readUInt32BE(33)
    expect(inflateSync(image!.subarray(41, 41 + idatLength)).length).toBe(32 * (1 + 32 * 3))
    expect(image!.length).toBeLessThan(2048)
    expect(Buffer.compare(image!, generateSeries(generator, 'png', 1)[0] as Buffer)).toBe(0)
  })
})

describe('ReDoS', () => {
  it('every validator answers adversarial 50 000-character inputs quickly', () => {
    const inputs = ['A'.repeat(50_000), '0'.repeat(50_000), `${'9'.repeat(49_999)}!`, `IMO ${'1'.repeat(49_996)}`, `${'AB12 '.repeat(10_000)}`, `${'-'.repeat(25_000)}${'1'.repeat(25_000)}`]
    for (const generator of mine.filter((item) => item.validate)) {
      const started = performance.now()
      for (const input of inputs) generator.validate!(input)
      expect(performance.now() - started, generator.id).toBeLessThan(100)
    }
  })
})

describe('PT-BR names', () => {
  it('every Business/Product generator name is in the PT-BR catalog', async () => {
    const { ptBrCatalog } = await import('../../src/renderer/src/i18n/specMessages.js')
    const { ptBrModulesBusiness } = await import('../../src/renderer/src/i18n/ptBrModulesBusiness.js')
    const { ptBrModulesProduct } = await import('../../src/renderer/src/i18n/ptBrModulesProduct.js')
    for (const generator of mine) {
      const own = generator.category === 'Business' ? ptBrModulesBusiness : ptBrModulesProduct
      expect(own[generator.name], generator.name).toBeTruthy()
      expect(ptBrCatalog[generator.name], generator.name).toBe(own[generator.name])
    }
    expect(Object.keys(ptBrModulesBusiness)).toHaveLength(29)
    expect(Object.keys(ptBrModulesProduct)).toHaveLength(35)
  })
})
