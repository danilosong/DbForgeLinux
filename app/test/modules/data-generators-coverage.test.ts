import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { itGenerators } from '../../src/modules/data-generation/generators/it.js'
import { locationGenerators } from '../../src/modules/data-generation/generators/location.js'
import { personalGenerators } from '../../src/modules/data-generation/generators/personal.js'
import { healthGenerators } from '../../src/modules/data-generation/generators/health.js'
import { paymentGenerators } from '../../src/modules/data-generation/generators/payment.js'
import { generateSeries, seededRandom } from '../../src/modules/data-generation/generators/types.js'
import type { CatalogGenerator } from '../../src/modules/data-generation/generators/types.js'
import { ptBrModulesPersonal } from '../../src/renderer/src/i18n/ptBrModulesPersonal.js'
import { ptBrModulesHealth } from '../../src/renderer/src/i18n/ptBrModulesHealth.js'
import { ptBrModulesPayment } from '../../src/renderer/src/i18n/ptBrModulesPayment.js'
import { ptBrModulesIT } from '../../src/renderer/src/i18n/ptBrModulesIT.js'
import { ptBrModulesLocation } from '../../src/renderer/src/i18n/ptBrModulesLocation.js'

interface ManifestGenerator { name: string; category: string; languages?: string[]; columnTypes: string[] }
const manifest = JSON.parse(readFileSync(new URL('../../../document/paridade/data-generators-manifest.json', import.meta.url), 'utf8')) as { generators: ManifestGenerator[] }
const mine = [...itGenerators, ...locationGenerators]
const personalHealthPayment = [...personalGenerators, ...healthGenerators, ...paymentGenerators]

describe('reference data generator coverage: IT and Location', () => {
  it('implements every manifest name in the owned categories with exact metadata', () => {
    const expected = manifest.generators.filter((item) => item.category === 'IT' || item.category === 'Location')
    expect(itGenerators).toHaveLength(37)
    expect(locationGenerators).toHaveLength(41)
    expect(mine.map((item) => item.id).length).toBe(new Set(mine.map((item) => item.id)).size)
    expect(mine.map((item) => item.reference).sort()).toEqual(expected.map((item) => item.name).sort())
    const labels = { ...ptBrModulesIT, ...ptBrModulesLocation }
    for (const item of expected) {
      const actual = mine.find((candidate) => candidate.reference === item.name)
      expect(actual, item.name).toBeDefined()
      expect(actual).toMatchObject({ name: item.name, category: item.category, columnTypes: item.columnTypes, reference: item.name })
      expect(actual?.languages ?? []).toEqual(item.languages ?? [])
      expect(actual?.id).toMatch(/^(?:it|location)\.[a-z0-9-]+$/)
      expect(labels[item.name], `Missing PT-BR label for ${item.name}`).toBeTruthy()
    }
  })

  it('emits a digit-only calling code for numeric target columns', () => {
    const callingCode = locationGenerators.find((item) => item.reference === 'Country Phone Calling Code (IDD)')!
    const numeric = callingCode.generate(seededRandom('numeric-idd'), { index: 0, locale: 'en-US', columnType: 'int' })
    const textual = callingCode.generate(seededRandom('text-idd'), { index: 0, locale: 'en-US', columnType: 'varchar' })
    expect(String(numeric)).toMatch(/^\d+$/)
    expect(String(textual)).toMatch(/^\+\d+$/)
  })

  it.each(mine.map((item) => [item.reference, item] as const))('%s generates 200 deterministic values matching its format', (_name, generator) => {
    const values = generate(generator, 'coverage')
    const repeated = generate(generator, 'coverage')
    expect(values).toEqual(repeated)
    expect(values).toHaveLength(200)
    for (const value of values) {
      expect(['string', 'number'].includes(typeof value) || Buffer.isBuffer(value)).toBe(true)
      if (generator.validate) expect(generator.validate(String(value)), `${generator.reference}: ${String(value)}`).toBe(true)
    }
  })

  it.each(mine.filter((item) => item.unique).map((item) => [item.reference, item] as const))('%s can honour a unique-value request', (_name, generator) => {
    const values = generateSeries(generator, `unique:${generator.id}`, 200, { unique: true })
    expect(new Set(values.map(String)).size).toBe(200)
  })
})

function generate(generator: CatalogGenerator, seed: string): unknown[] {
  const random = seededRandom(`${seed}:${generator.id}`)
  return Array.from({ length: 200 }, (_, index) => generator.generate(random, { index, locale: 'en-US' }))
}

describe('reference data generator coverage: Personal, Health, and Payment', () => {
  it('implements all 78 manifest names in the owned categories with exact metadata and PT-BR labels', () => {
    const expected = manifest.generators.filter((item) => ['Personal', 'Health', 'Payment'].includes(item.category))
    expect(personalGenerators).toHaveLength(46)
    expect(healthGenerators).toHaveLength(15)
    expect(paymentGenerators).toHaveLength(17)
    expect(personalHealthPayment.map((item) => item.id).length).toBe(new Set(personalHealthPayment.map((item) => item.id)).size)
    expect(personalHealthPayment.map((item) => item.reference).sort()).toEqual(expected.map((item) => item.name).sort())
    const labels = { ...ptBrModulesPersonal, ...ptBrModulesHealth, ...ptBrModulesPayment }
    for (const item of expected) {
      const actual = personalHealthPayment.find((candidate) => candidate.reference === item.name)
      expect(actual, item.name).toBeDefined()
      expect(actual).toMatchObject({ name: item.name, category: item.category, columnTypes: item.columnTypes, reference: item.name })
      expect(actual?.languages ?? []).toEqual(item.languages ?? [])
      expect(actual?.id).toMatch(/^(?:personal|health|payment)\.[a-z0-9-]+$/)
      expect(labels[item.name], `Missing PT-BR label for ${item.name}`).toBeTruthy()
      expect(labels[item.name], `Untranslated PT-BR label for ${item.name}`).not.toBe(item.name)
    }
  })

  it.each(personalHealthPayment.map((item) => [item.reference, item] as const))('%s generates 200 deterministic values matching its format', (_name, generator) => {
    const values = generate(generator, `coverage:${generator.id}`)
    expect(values).toEqual(generate(generator, `coverage:${generator.id}`))
    expect(values).toHaveLength(200)
    for (const value of values) {
      expect(['string', 'number'].includes(typeof value) || Buffer.isBuffer(value)).toBe(true)
      if (generator.validate) expect(generator.validate(String(value)), `${generator.reference}: ${String(value)}`).toBe(true)
    }
  })

  it.each(personalHealthPayment.filter((item) => item.unique).map((item) => [item.reference, item] as const))('%s can produce unique values when requested', (_name, generator) => {
    const values = generateSeries(generator, `unique:${generator.id}`, 200, { unique: true })
    expect(new Set(values.map(String)).size).toBe(200)
  })
})
