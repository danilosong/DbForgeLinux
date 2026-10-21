import type { ColumnModel } from '../schema/model.js'
import { inferKind } from './generators.js'
import type { GeneratorKind } from './types.js'

export const dataDomainProfiles = ['people', 'addresses', 'companies', 'ecommerce', 'finance', 'datetime', 'text'] as const
export type DataDomainProfile = typeof dataDomainProfiles[number]

const semanticName = (column: ColumnModel): string => `${column.name} ${column.comment ?? ''}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()

export function generatorForDomainProfile(profile: DataDomainProfile, column: ColumnModel): GeneratorKind {
  const name = semanticName(column)
  const inferred = inferKind(column)
  if (!/\b(postal|zip|postcode)\b/.test(name) && /\b(id|uuid|guid|sku|code|number|no)\b/.test(name) && /int|char|text|varchar/i.test(column.type)) return 'unique'
  switch (profile) {
    case 'people':
      if (['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'name'].includes(inferred ?? '')) return inferred!
      return /\b(age|years old)\b/.test(name) ? 'number' : 'name'
    case 'addresses':
      if (['address', 'city', 'country'].includes(inferred ?? '')) return inferred!
      if (/\b(postal|zip|postcode)\b/.test(name)) return 'sequence'
      return 'address'
    case 'companies':
      if (['company', 'email', 'phone', 'url', 'address', 'city', 'country'].includes(inferred ?? '')) return inferred!
      return 'company'
    case 'ecommerce':
      if (/\b(price|amount|cost|subtotal|total)\b/.test(name)) return 'money'
      if (/\b(qty|quantity|stock|inventory)\b/.test(name)) return 'number'
      if (/\b(status|state|category|payment|fulfillment)\b/.test(name)) return 'status'
      if (/\b(email|buyer|customer)\b/.test(name)) return inferred === 'email' ? inferred : 'name'
      if (/\b(date|ordered|created|updated)\b/.test(name)) return 'date'
      if (/\b(product|item|title|description)\b/.test(name)) return /description|title/i.test(name) ? 'lorem' : 'company'
      return 'lorem'
    case 'finance':
      if (/\b(date|posted|settled|created|updated)\b/.test(name)) return 'date'
      if (/\b(time|hour)\b/.test(name)) return 'time'
      if (/\b(rate|percent|ratio|quantity|count)\b/.test(name)) return 'number'
      if (/\b(status|type|currency|method|direction)\b/.test(name)) return 'status'
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
