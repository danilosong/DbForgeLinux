import type { ColumnModel } from '../schema/model.js'
import { inferKind } from './generators.js'
import type { GeneratorKind } from './types.js'

const industryGroups = {
  people: `people human-resources recruiting payroll education university school childcare government public-sector nonprofit charity community social-services legal law-firm consulting professional-services staffing hospitality hotel restaurant catering travel tourism airline airport railway logistics shipping trucking automotive dealership manufacturing construction real-estate property-management agriculture farming forestry mining energy utilities renewable-energy oil-gas telecommunications internet-media publishing advertising marketing entertainment music film gaming sports fitness beauty salon pet-care veterinary` ,
  addresses: `addresses postal-services courier delivery warehousing supply-chain import-export maritime aviation accommodation facilities property-management construction utilities energy telecommunications` ,
  companies: `companies banking retail wholesale ecommerce marketplace subscription saas software it-services cybersecurity cloud-computing telecommunications media publishing advertising marketing consulting legal accounting insurance healthcare hospital clinic dental pharmacy biotech laboratory education university school government nonprofit charity manufacturing automotive aerospace construction real-estate agriculture food-beverage hospitality hotel restaurant travel tourism logistics shipping energy utilities` ,
  ecommerce: `ecommerce retail wholesale marketplace grocery fashion apparel footwear electronics furniture home-garden beauty cosmetics pharmacy books publishing ticketing food-delivery restaurant travel-booking subscriptions digital-goods automotive-parts` ,
  finance: `finance banking credit-union lending mortgage payments fintech accounting audit tax insurance brokerage wealth-management investment trading cryptocurrency treasury invoicing billing payroll fundraising` ,
  datetime: `datetime healthcare hospital clinic pharmacy laboratory education university school government public-sector transportation airline railway logistics manufacturing energy utilities hospitality hotel restaurant sports media telecommunications` ,
  text: `text journalism publishing social-media advertising marketing customer-support helpdesk legal research education documentation reviews forums messaging entertainment gaming`
} as const

type ProfileFamily = keyof typeof industryGroups
const profileFamilies: Array<readonly [string, ProfileFamily]> = (Object.entries(industryGroups) as Array<[ProfileFamily, string]>).flatMap(([family, values]) => values.split(/\s+/).map((id) => [id, family] as const))
const familyByProfile = profileFamilies.reduce((families, [id, family]) => {
  if (!families.has(id) || id === family) families.set(id, family)
  return families
}, new Map<string, ProfileFamily>())
export const dataDomainProfiles = [...new Set(profileFamilies.map(([id]) => id))] as readonly string[]
const groupedProfiles = new Set<string>()
export const dataDomainProfileGroups = Object.entries(industryGroups).map(([family, values]) => ({ family, profiles: values.split(/\s+/).filter((id) => { if (groupedProfiles.has(id)) return false; groupedProfiles.add(id); return true }) }))
export type DataDomainProfile = string

const semanticName = (column: ColumnModel): string => `${column.name} ${column.comment ?? ''}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()

export function dataDomainProfileLabel(profile: DataDomainProfile): string {
  return profile.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function generatorForDomainProfile(profile: DataDomainProfile, column: ColumnModel): GeneratorKind {
  const family = familyByProfile.get(profile)
  if (!family) throw new Error(`Unknown data domain profile: ${profile}`)
  const name = semanticName(column)
  const inferred = inferKind(column)
  if (!/\b(postal|zip|postcode)\b/.test(name) && /\b(id|uuid|guid|sku|code|number|no)\b/.test(name) && /int|char|text|varchar/i.test(column.type)) return 'unique'
  if (['email', 'phone', 'url', 'ip', 'uuid', 'address', 'city', 'country', 'firstName', 'lastName', 'status', 'date', 'time', 'money'].includes(inferred ?? '')) return inferred!
  switch (family) {
    case 'people':
      if (['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'name'].includes(inferred ?? '')) return inferred!
      return /\b(age|years old|salary|wage|compensation)\b/.test(name) ? 'number' : 'name'
    case 'addresses':
      if (['address', 'city', 'country'].includes(inferred ?? '')) return inferred!
      if (/\b(postal|zip|postcode)\b/.test(name)) return 'sequence'
      return 'address'
    case 'companies':
      if (['company', 'email', 'phone', 'url', 'address', 'city', 'country'].includes(inferred ?? '')) return inferred!
      return /\b(status|type|category|department|industry)\b/.test(name) ? 'status' : 'company'
    case 'ecommerce':
      if (/\b(price|amount|cost|subtotal|total|balance|discount|tax)\b/.test(name)) return 'money'
      if (/\b(qty|quantity|stock|inventory|rating|score)\b/.test(name)) return 'number'
      if (/\b(status|state|category|payment|fulfillment|method|type)\b/.test(name)) return 'status'
      if (/\b(email|buyer|customer|user)\b/.test(name)) return inferred === 'email' ? inferred : 'name'
      if (/\b(date|ordered|created|updated|shipped|delivered)\b/.test(name)) return 'date'
      if (/\b(product|item|title|description|notes)\b/.test(name)) return /description|notes/i.test(name) ? 'lorem' : 'company'
      return 'lorem'
    case 'finance':
      if (/\b(date|posted|settled|created|updated|due|paid|expired)\b/.test(name)) return 'date'
      if (/\b(time|hour)\b/.test(name)) return 'time'
      if (/\b(rate|percent|ratio|quantity|count|term|days)\b/.test(name)) return 'number'
      if (/\b(status|type|currency|method|direction|country|symbol)\b/.test(name)) return 'status'
      return 'money'
    case 'datetime':
      if (/\b(time|hour|minute|second)\b/.test(name) || /\btime\b/i.test(column.type)) return 'time'
      return 'date'
    case 'text':
      if (inferred === 'email' || inferred === 'url') return inferred
      if (/\b(first name|given name)\b/.test(name)) return 'firstName'
      if (/\b(last name|surname)\b/.test(name)) return 'lastName'
      if (/\b(name|title)\b/.test(name)) return 'name'
      return 'lorem'
  }
}
