import { describe, expect, it } from 'vitest'
import { catalogGenerators, findCatalogGeneratorByReference } from '../../src/modules/data-generation/generators/registry.js'
import { generateSeries } from '../../src/modules/data-generation/generators/types.js'

// Security review of every catalog generator (all categories): validators must not backtrack
// catastrophically, and values that could pass for real records stay in reserved/test ranges.
const values = (reference: string, count = 200): string[] => generateSeries(findCatalogGeneratorByReference(reference)!, `security:${reference}`, count).map(String)

describe('catalog generators: ReDoS', () => {
  const adversarial = [
    'a'.repeat(50_000), 'A'.repeat(50_000), '0'.repeat(50_000), `${'9'.repeat(49_999)}!`, `${'1-'.repeat(25_000)}x`,
    `${'a.'.repeat(25_000)}@`, `${'ab12 '.repeat(10_000)}`, `${':'.repeat(25_000)}g`, `${'x@'.repeat(25_000)}`, `${'/'.repeat(50_000)}`, ` ${' '.repeat(49_998)}!`
  ]
  it('every validator answers 50 000-character adversarial inputs in under 100 ms each', () => {
    const validated = catalogGenerators().filter((generator) => generator.validate)
    expect(validated.length).toBeGreaterThan(50)
    for (const generator of validated) {
      for (const input of adversarial) {
        const started = performance.now()
        try { generator.validate!(input) } catch { /* a throwing validator is a functional bug, not a ReDoS */ }
        expect(performance.now() - started, `${generator.id} on ${input.slice(0, 12)}…(${input.length})`).toBeLessThan(100)
      }
    }
  })
})

describe('catalog generators: synthetic ranges that must not regress', () => {
  it('marks format-only personal and payment identifiers as synthetic', () => {
    const references = [
      'Permanent Account Number(PAN)', 'Integrated Circuit Card ID (ICCID)',
      'Value Added Tax Identification Number (VATIN)', 'Canadian Transit Number',
      'International Bank Account Number (IBAN, ISO 13616-1)', 'Twitter ID'
    ]
    for (const reference of references) {
      expect(findCatalogGeneratorByReference(reference)?.synthetic, reference).toBeTruthy()
    }
  })

  it('network identifiers use documentation/reserved ranges', () => {
    expect(values('IPv4 Address').every((value) => /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/.test(value))).toBe(true)
    expect(values('IPv6 Address').every((value) => value.toLowerCase().startsWith('2001:db8:'))).toBe(true)
    // Locally administered, unicast: second hex digit of the first octet is 2, 6, A or E.
    expect(values('MAC Address (IEEE 802)').every((value) => /^[0-9a-f][26ae][:-]/i.test(value))).toBe(true)
    expect(values('Email').every((value) => /@(?:[a-z0-9-]+\.)*(?:example|test|invalid|localhost)$|@example\.(?:com|net|org)$|\.test$/i.test(value))).toBe(true)
    expect(values('Host Name').every((value) => /\.(?:test|example|invalid)$|\.example\.(?:com|net|org)$/.test(value))).toBe(true)
    expect(values('Bitcoin Address').every((value) => /^[mn2]/.test(value))).toBe(true)
  })

  it('personal and payment identifiers stay out of issued ranges where the standard has a reserved one', () => {
    expect(values('US Social Security Number (SSN)').every((value) => value.startsWith('9'))).toBe(true)
    expect(values('ABA Routing Transit Number (ABA RTN)').every((value) => value.startsWith('00'))).toBe(true)
    expect(values('Bank Identifier Code (SWIFT-BIC, ISO 9362)').every((value) => value.slice(4, 6) === 'ZZ')).toBe(true)
    expect(values('Credit Card Number (ISO IEC 7812)').every((value) => !/^[3-6]/.test(value))).toBe(true)
    expect(values('Phone Number (domestic)').every((value) => /555-01\d\d$/.test(value))).toBe(true)
    expect(values('UK Phone Number (mobile)').every((value) => value.startsWith('07700 900'))).toBe(true)
    expect(values('UK Phone Number (wide)').every((value) => value.startsWith('01632 960'))).toBe(true)
  })

  it('keeps national identifiers and call-capable phone numbers in declared test ranges', () => {
    const sin = findCatalogGeneratorByReference('CA Social Insurance Number (SIN)')!
    const nino = findCatalogGeneratorByReference('UK National Insurance Number (NINO)')!
    const nhs = findCatalogGeneratorByReference('UK National Health Service Number (NHS Number, ISB 0149)')!
    const sins = values(sin.reference, 1000)
    const ninos = values(nino.reference, 1000)
    const nhsNumbers = values(nhs.reference, 1000)
    expect(sins.every((value) => value.startsWith('0') && sin.validate?.(value))).toBe(true)
    expect(ninos.every((value) => value.startsWith('QQ') && nino.validate?.(value))).toBe(true)
    expect(nhsNumbers.every((value) => value.startsWith('999') && nhs.validate?.(value))).toBe(true)
    expect(values('Phone Number (toll-free)', 1000).every((value) => /^800-555-01\d{2}$/.test(value))).toBe(true)
    expect(values('UK Phone Number (free)', 1000).every((value) => /^0808 157 0\d{3}$/.test(value))).toBe(true)
    expect(values('UK Phone Number (premium rate service)', 1000).every((value) => /^0909 879 0\d{3}$/.test(value))).toBe(true)
  })

  it('product identifiers use GS1 restricted circulation, in-store UPC and the ITU test network', () => {
    expect(values('International Article Number (EAN-13)').every((value) => value.startsWith('2'))).toBe(true)
    expect(values('Universal Product Code (UPC-A)').every((value) => value.startsWith('4'))).toBe(true)
    expect(values('International Mobile Station Identity (IMSI)').every((value) => value.startsWith('00101'))).toBe(true)
  })
})
