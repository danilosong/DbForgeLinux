import { isNumericColumn, registerCatalogGenerators, type CatalogContext, type CatalogGenerator } from './types.js'

const pick = <T>(values: readonly T[], random: () => number): T => values[Math.floor(random() * values.length)]!
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const places = {
  auCities: ['Perth', 'Adelaide', 'Hobart', 'Darwin', 'Canberra', 'Newcastle'],
  auStates: ['New South Wales', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
  caCities: ['Calgary', 'Halifax', 'Ottawa', 'Québec City', 'Regina', 'Victoria'],
  caProvinces: ['Alberta', 'Manitoba', 'New Brunswick', 'Nova Scotia', 'Ontario', 'Québec', 'Saskatchewan'],
  deCities: ['Bremen', 'Dresden', 'Freiburg', 'Kiel', 'Leipzig', 'Mainz'],
  deStates: ['Baden-Württemberg', 'Bavaria', 'Brandenburg', 'Hesse', 'Lower Saxony', 'Saxony'],
  ukCities: ['Bath', 'Bristol', 'Cardiff', 'Leeds', 'York', 'Exeter'],
  ukCounties: ['Cornwall', 'Derbyshire', 'Devon', 'Kent', 'Norfolk', 'Somerset'],
  usCities: ['Boise', 'Madison', 'Omaha', 'Raleigh', 'Salem', 'Tucson'],
  usStates: ['Arizona', 'Colorado', 'Georgia', 'Maine', 'Oregon', 'Wisconsin'],
  usCodes: ['AZ', 'CO', 'GA', 'ME', 'OR', 'WI'],
  usCapitals: ['Phoenix', 'Denver', 'Atlanta', 'Augusta', 'Salem', 'Madison'],
  countries: ['Brazil', 'Canada', 'Germany', 'Japan', 'New Zealand', 'Portugal', 'South Africa', 'United States'],
  countryCodes: [['BR', 'BRA', '076'], ['CA', 'CAN', '124'], ['DE', 'DEU', '276'], ['JP', 'JPN', '392'], ['NZ', 'NZL', '554'], ['PT', 'PRT', '620'], ['ZA', 'ZAF', '710'], ['US', 'USA', '840']],
  calls: ['+1', '+27', '+351', '+49', '+55', '+64', '+81', '+1'],
  airports: [['BSP', 'Blue Summit Airfield'], ['CRV', 'Cedar Ridge Airport'], ['ELM', 'Elm Harbor Airport'], ['FST', 'Forest Gate Airport'], ['HBR', 'Harbor Point Airport'], ['MPL', 'Maple Plain Airport']],
  streets: ['Birch Crescent', 'Copper Lane', 'Elm Terrace', 'Juniper Walk', 'Willow Close']
}

function valueFor(name: string, random: () => number, row: number, columnType?: string): string | number {
  const index = row % 6
  switch (name) {
    case 'AU City': return pick(places.auCities, random)
    case 'AU Post Code': return String(2000 + ((row * 37 + Math.floor(random() * 900)) % 8000))
    case 'AU State': return pick(places.auStates, random)
    case 'Address Type': return pick(['Apartment', 'House', 'Office', 'Studio', 'Unit'], random)
    case 'Airport Codes': return pick(places.airports, random)[0]
    case 'Airports': return pick(places.airports, random)[1]
    case 'Building Unit': return `${pick(['Apt', 'Floor', 'Suite', 'Unit'], random)} ${1 + (row % 800)}`
    case 'CA City': return pick(places.caCities, random)
    case 'CA Post Code': return `${'ABCEGHJKLMNPRSTVXY'[Math.floor(random() * 18)]}${1 + (row % 9)}${'ABCEGHJKLMNPRSTVXY'[Math.floor(random() * 18)]} ${1 + (row % 9)}${'ABCEGHJKLMNPRSTVXY'[Math.floor(random() * 18)]}${1 + Math.floor(random() * 9)}`
    case 'CA Province': return pick(places.caProvinces, random)
    case 'CA Province Code': return pick(['AB', 'MB', 'NB', 'NS', 'ON', 'QC', 'SK'], random)
    case 'Country': return pick(places.countries, random)
    case 'Country Code (ISO 3166-1 alpha-2)': return pick(places.countryCodes, random)[0]
    case 'Country Code (ISO 3166-1 alpha-3)': return pick(places.countryCodes, random)[1]
    case 'Country Code (ISO 3166-1 numeric)': return Number(pick(places.countryCodes, random)[2])
    case 'Country Phone Calling Code (IDD)': { const code = pick(places.calls, random); return isNumericColumn(columnType) ? code.slice(1) : code }
    case 'DE Address Full': return `${1 + row} ${pick(places.streets, random)}, ${pick(places.deCities, random)}, ${pick(places.deStates, random)}`
    case 'DE Address Line 1': return `${1 + row} ${pick(places.streets, random)}`
    case 'DE Bundesland': return pick(places.deStates, random)
    case 'DE City': return pick(places.deCities, random)
    case 'DE Post Code': return `${10000 + ((row * 79 + Math.floor(random() * 900)) % 89999)}`
    case 'Latitude': return Math.round((-60 + random() * 120) * 1e6) / 1e6
    case 'Longitude': return Math.round((-170 + random() * 340) * 1e6) / 1e6
    case 'P.O. Box': return `P.O. Box ${100 + ((row * 31) % 8900)}`
    case 'UK Address Full': return `${1 + row} ${pick(places.streets, random)}, ${pick(places.ukCities, random)}, ${pick(['AB1 2CD', 'BS3 4EF', 'LS5 6GH', 'YO7 8JK'], random)}`
    case 'UK Address Line 1': return `${1 + row} ${pick(places.streets, random)}`
    case 'UK Address Line 2': return pick(['Central District', 'East Quarter', 'Harbor Ward', 'North Park', 'West End'], random)
    case 'UK City': return pick(places.ukCities, random)
    case 'UK County': return pick(places.ukCounties, random)
    case 'UK Post Code': { const pair = (value: number): string => String.fromCharCode(65 + Math.floor(value / 26) % 26, 65 + value % 26); return `${pair(row)}${1 + (row % 9)} ${1 + (Math.floor(row / 9) % 9)}${pair(row + 311)}` }
    case 'UK Town': return pick(['Ashford', 'Bridport', 'Keswick', 'Marlow', 'Whitby', 'Wells'], random)
    case 'US Address Full': return `${1 + row} ${pick(places.streets, random)}, ${pick(places.usCities, random)}, ${pick(places.usCodes, random)} ${String(10000 + (row * 137) % 89999).padStart(5, '0')}`
    case 'US Address Line 1': return `${1 + row} ${pick(places.streets, random)}`
    case 'US Address Line 2': return pick(['Apt 2', 'Floor 3', 'Suite 14', 'Unit B'], random)
    case 'US City': return pick(places.usCities, random)
    case 'US Post Code (ZIP Plus 4)': return `${String(10000 + (row * 137) % 89999).padStart(5, '0')}-${String((row * 541 + Math.floor(random() * 10000)) % 10000).padStart(4, '0')}`
    case 'US Post Code (ZIP)': return String(10000 + (row * 137) % 89999).padStart(5, '0')
    case 'US Region': return pick(['Midwest', 'Mountain', 'Northeast', 'Pacific', 'Southeast'], random)
    case 'US State': return pick(places.usStates, random)
    case 'US State Capital': return pick(places.usCapitals, random)
    case 'US State Code': return pick(places.usCodes, random)
    default: return `Example ${index + 1}`
  }
}

const metadata = {
  "AU City": { languages: ["AU"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "AU Post Code": { languages: ["AU"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "AU State": { languages: ["AU"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Address Type": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Airport Codes": { languages: [], columnTypes: ["char", "nchar", "ntext", "nvarchar", "nvarchar(max)", "text", "varchar", "varchar(max)"] },
  "Airports": { languages: [], columnTypes: ["char", "nchar", "ntext", "nvarchar", "nvarchar(max)", "text", "varchar", "varchar(max)"] },
  "Building Unit": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "CA City": { languages: ["CA"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "CA Post Code": { languages: ["CA"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "CA Province": { languages: ["CA"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "CA Province Code": { languages: ["CA"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Country": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Country Code (ISO 3166-1 alpha-2)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Country Code (ISO 3166-1 alpha-3)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Country Code (ISO 3166-1 numeric)": { languages: [], columnTypes: ["bigint", "char", "decimal", "int", "longtext", "mediumint", "mediumtext", "smallint", "text", "tinyint", "tinytext", "varchar"] },
  "Country Phone Calling Code (IDD)": { languages: [], columnTypes: ["bigint", "char", "decimal", "int", "longtext", "mediumint", "mediumtext", "smallint", "text", "tinytext", "varchar"] },
  "DE Address Full": { languages: ["DE"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "DE Address Line 1": { languages: ["DE"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "DE Bundesland": { languages: ["DE"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "DE City": { languages: ["DE"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "DE Post Code": { languages: ["DE"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "Latitude": { languages: [], columnTypes: ["double", "float"] },
  "Longitude": { languages: [], columnTypes: ["double", "float"] },
  "P.O. Box": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK Address Full": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK Address Line 1": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK Address Line 2": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK City": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK County": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK Post Code": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "UK Town": { languages: ["GB"], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US Address Full": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US Address Line 1": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "nchar", "ntext", "nvarchar", "nvarchar(max)", "text", "tinytext", "varchar", "varchar(max)"] },
  "US Address Line 2": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US City": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US Post Code (ZIP Plus 4)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US Post Code (ZIP)": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US Region": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US State": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US State Capital": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
  "US State Code": { languages: [], columnTypes: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"] },
} as const

const validators: Record<string, (value: string) => boolean> = {
  'AU Post Code': (value) => /^\d{4}$/.test(String(value)),
  'CA Post Code': (value) => /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVXY] \d[ABCEGHJKLMNPRSTVXY]\d$/.test(String(value)),
  'Country Code (ISO 3166-1 alpha-2)': (value) => /^[A-Z]{2}$/.test(String(value)),
  'Country Code (ISO 3166-1 alpha-3)': (value) => /^[A-Z]{3}$/.test(String(value)),
  'Country Code (ISO 3166-1 numeric)': (value) => /^\d{3}$/.test(String(value).padStart(3, '0')),
  'Latitude': (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90,
  'Longitude': (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180,
  'UK Post Code': (value) => /^[A-Z]{1,2}\d[A-Z0-9]? \d[A-Z]{2}$/.test(String(value)),
  'US Post Code (ZIP)': (value) => /^\d{5}$/.test(String(value)),
  'US Post Code (ZIP Plus 4)': (value) => /^\d{5}-\d{4}$/.test(String(value)),
  'US State Code': (value) => /^[A-Z]{2}$/.test(String(value)),
}

const uniqueReferences = new Set(['AU Post Code', 'CA Post Code', 'DE Address Full', 'DE Address Line 1', 'DE Post Code', 'Latitude', 'Longitude', 'P.O. Box', 'UK Address Full', 'UK Address Line 1', 'UK Post Code', 'US Address Full', 'US Address Line 1', 'US Post Code (ZIP)', 'US Post Code (ZIP Plus 4)'])

export const locationGenerators: readonly CatalogGenerator[] = Object.entries(metadata).map(([reference, details]) => ({
  id: `location.${slug(reference)}`, name: reference, category: 'Location', ...(details.languages.length ? { languages: details.languages } : {}), columnTypes: details.columnTypes, reference, ...(uniqueReferences.has(reference) ? { unique: true } : {}),
  synthetic: 'Uses short original fixture lists and example data; not a verified delivery address.',
  generate: (random, context: CatalogContext) => valueFor(reference, random, context.index, context.columnType),
  ...(validators[reference] ? { validate: (value: string) => validators[reference]!(value) } : {})
}))

registerCatalogGenerators(locationGenerators)
