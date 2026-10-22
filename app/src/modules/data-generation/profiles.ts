import type { ColumnModel } from '../schema/model.js'
import { inferKind } from './generators.js'
import type { GeneratorKind, GeneratorSpec } from './types.js'

const industryGroups = {
  people: `people human-resources recruiting payroll education university school childcare government public-sector nonprofit charity community social-services legal law-firm consulting professional-services staffing hospitality hotel restaurant catering travel tourism airline airport railway logistics shipping trucking automotive dealership manufacturing construction real-estate property-management agriculture farming forestry mining energy utilities renewable-energy oil-gas telecommunications internet-media publishing advertising marketing entertainment music film gaming sports fitness beauty salon pet-care veterinary` ,
  addresses: `addresses postal-services courier delivery warehousing supply-chain import-export maritime aviation accommodation facilities property-management construction utilities energy telecommunications` ,
  companies: `companies banking retail wholesale ecommerce marketplace subscription saas software it-services cybersecurity cloud-computing telecommunications media publishing advertising marketing consulting legal accounting insurance healthcare hospital clinic dental pharmacy biotech laboratory education university school government nonprofit charity manufacturing automotive aerospace construction real-estate agriculture food-beverage hospitality hotel restaurant travel tourism logistics shipping energy utilities` ,
  ecommerce: `ecommerce retail wholesale marketplace grocery fashion apparel footwear electronics furniture home-garden beauty cosmetics pharmacy books publishing ticketing food-delivery restaurant travel-booking subscriptions digital-goods automotive-parts` ,
  finance: `finance banking credit-union lending mortgage payments fintech accounting audit tax insurance brokerage wealth-management investment trading cryptocurrency treasury invoicing billing payroll fundraising` ,
  datetime: `datetime healthcare hospital clinic pharmacy laboratory education university school government public-sector transportation airline railway logistics manufacturing energy utilities hospitality hotel restaurant sports media telecommunications` ,
  text: `text journalism publishing social-media advertising marketing customer-support helpdesk legal research education documentation reviews forums messaging entertainment gaming`
} as const

// Concrete business domains and operating contexts, authored for TuxSQL. Each
// remains a semantic preset over the column generators available in the app.
const domainSeeds = `accounting billing logistics ticketing insurance admissions banking payments claims underwriting brokerage lending mortgage leasing compliance identity access-control cybersecurity cloud software developer-tools observability datacenter retail grocery inventory point-of-sale fulfillment returns marketplace subscriptions customer-success helpdesk reservations hospitality food-service catering events tourism airlines railways fleet dispatch warehousing procurement manufacturing quality-control maintenance construction permitting property-management agriculture crop-management livestock fisheries energy-grid renewables utilities water-treatment mining extraction laboratories diagnostics clinical-trials public-health pharmacy telemedicine dental vision-care education admissions learning-management research libraries municipal-services courts case-management charities fundraising campaign-management newsroom broadcasting streaming publishing advertising audience-analytics sports-clubs athletics fitness wellness salons cosmetics veterinary animal-shelter automotive repair parts-dealer rental mobility parking telecommunications broadband messaging social-networks creator-economy games esports music production film production archives museums galleries auctions donations payroll recruiting benefits timekeeping workforce government taxation customs trade-port shipping insurance-brokerage wealth-advisory treasury remittance currency-exchange fraud-detection risk-management audit consulting legal-services translation travel-agency lodging restaurant-delivery grocery-delivery fashion apparel electronics furniture home-improvement books ticket-sales software-licensing api-platforms data-platforms backup-recovery incident-response endpoint-security network-operations construction-materials architecture engineering environmental-monitoring recycling waste-management emergency-response public-transit postal-services parcel-delivery cold-chain food-production beverage production hospitality housekeeping childcare eldercare social-care university research student-services examination assessment open-source foundation marketplace-sellers vehicle-manufacturing aircraft-maintenance marine-services hotel-operations restaurant-operations warehouse-operations clinic-operations school-operations city-operations`.split(/\s+/)
const domainContexts = ['operations', 'customer-service', 'inventory', 'compliance'] as const
const expandedDomainIds = domainSeeds.flatMap((domain) => domainContexts.map((context) => `${domain}-${context}`))

type ProfileFamily = keyof typeof industryGroups
const profileFamilies: Array<readonly [string, ProfileFamily]> = [
  ...(Object.entries(industryGroups) as Array<[ProfileFamily, string]>).flatMap(([family, values]) => values.split(/\s+/).map((id) => [id, family] as const)),
  ...expandedDomainIds.map((id) => {
    const domain = id.slice(0, id.lastIndexOf('-'))
    const family: ProfileFamily = /bank|payment|finance|credit|insurance|lending|mortgage|broker|wealth|treasury|tax|audit|currency|remittance|fraud|risk|accounting|billing|payroll/.test(domain) ? 'finance'
      : /retail|grocery|inventory|marketplace|fulfillment|returns|delivery|fashion|apparel|electronics|books|ticket|cosmetic|auction/.test(domain) ? 'ecommerce'
        : /address|postal|travel|airline|railway|fleet|dispatch|warehouse|shipping|port|transit|parcel|cold-chain|lodging|hotel|restaurant/.test(domain) ? 'addresses'
          : /text|news|media|social|publishing|advertising|messag|film|music|game|stream|documentation|support|helpdesk|community|campaign|translation/.test(domain) ? 'text'
            : /date|time|event|schedule|maintenance|monitoring|operations|incident|response/.test(domain) ? 'datetime' : 'people'
    return [id, family] as const
  })
]
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

/** Adds values that identify the selected domain when the schema has a domain/status field. */
export function generatorSpecForDomainProfile(profile: DataDomainProfile, column: ColumnModel): GeneratorSpec {
  const family = familyByProfile.get(profile)
  if (!family) throw new Error(`Unknown data domain profile: ${profile}`)
  const name = semanticName(column)
  const label = dataDomainProfileLabel(profile)
  const context = profile.slice(profile.lastIndexOf('-') + 1)
  if (/\b(industry|sector|domain|business area)\b/.test(name)) return { kind: 'list', values: [label] }
  if (/\b(category|segment|program)\b/.test(name)) return { kind: 'list', values: [`${label} Core`, `${label} Growth`, `${label} Archive`] }
  if (/\b(status|state|lifecycle)\b/.test(name)) {
    const values: Record<ProfileFamily, string[]> = {
      people: ['active', 'pending', 'on leave', 'review', 'archived'],
      addresses: ['unverified', 'validated', 'in transit', 'delivered', 'returned'],
      companies: ['prospect', 'qualified', 'active', 'suspended', 'closed'],
      ecommerce: ['draft', 'listed', 'reserved', 'fulfilled', 'returned'],
      finance: ['pending review', 'approved', 'held', 'reconciled', 'settled'],
      datetime: ['scheduled', 'active', 'delayed', 'completed', 'canceled'],
      text: ['draft', 'in review', 'published', 'scheduled', 'archived']
    }
    const contextual = context === 'compliance' ? ['pending review', 'verified', 'flagged', 'approved', 'expired']
      : context === 'inventory' ? ['available', 'reserved', 'replenishing', 'backordered', 'discontinued']
        : context === 'customer-service' ? ['new', 'assigned', 'waiting', 'resolved', 'closed'] : values[family]
    return { kind: 'list', values: contextual }
  }
  return { kind: generatorForDomainProfile(profile, column) }
}
