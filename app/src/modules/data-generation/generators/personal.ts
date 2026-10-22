import { digits as seedDigits, luhnCheckDigit, luhnValid, pick, registerCatalogGenerators, type CatalogContext, type CatalogGenerator, type Random } from './types.js'

interface ReferenceGeneratorContext { random: Random; locale: CatalogContext['locale']; rowIndex: number }
function digits(length: number, random: Random): string { return seedDigits(random, length) }
function dateValue(random: Random, minYear = 1960, maxYear = 2025): string {
  const year = minYear + Math.floor(random() * (maxYear - minYear + 1)); const month = 1 + Math.floor(random() * 12)
  const day = 1 + Math.floor(random() * new Date(Date.UTC(year, month, 0)).getUTCDate())
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function luhnDigit(body: string): string { return String(luhnCheckDigit(body)) }
function commonValidator(regex: RegExp): (value: string) => boolean { return (value) => regex.test(value) }

const metadata = [
  {
    "id": "personal.age",
    "reference": "Age",
    "name": "Age",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "int",
      "smallint",
      "tinyint"
    ]
  },
  {
    "id": "personal.avatar-images",
    "reference": "Avatar Images",
    "name": "Avatar Images",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "blob",
      "longblob"
    ]
  },
  {
    "id": "personal.birth-date",
    "reference": "Birth Date",
    "name": "Birth Date",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "date",
      "datetime",
      "timestamp"
    ]
  },
  {
    "id": "personal.ca-social-insurance-number-sin",
    "reference": "CA Social Insurance Number (SIN)",
    "name": "CA Social Insurance Number (SIN)",
    "category": "Personal",
    "languages": [
      "CA"
    ],
    "columnTypes": [
      "MySqlCASINGenerator",
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
    "id": "personal.courtesy-title",
    "reference": "Courtesy Title",
    "name": "Courtesy Title",
    "category": "Personal",
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
    "id": "personal.de-first-name-any-gender",
    "reference": "DE First Name (any gender)",
    "name": "DE First Name (any gender)",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.de-first-name-female",
    "reference": "DE First Name (female)",
    "name": "DE First Name (female)",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.de-first-name-male",
    "reference": "DE First Name (male)",
    "name": "DE First Name (male)",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.de-full-name",
    "reference": "DE Full Name",
    "name": "DE Full Name",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.de-honorific-prefix-title",
    "reference": "DE Honorific Prefix (Title)",
    "name": "DE Honorific Prefix (Title)",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.de-last-name",
    "reference": "DE Last Name",
    "name": "DE Last Name",
    "category": "Personal",
    "languages": [
      "DE"
    ],
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
    "id": "personal.death-date",
    "reference": "Death Date",
    "name": "Death Date",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "date",
      "datetime",
      "timestamp"
    ]
  },
  {
    "id": "personal.email",
    "reference": "Email",
    "name": "Email",
    "category": "Personal",
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
    "id": "personal.employment-term",
    "reference": "Employment Term",
    "name": "Employment Term",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "date",
      "datetime",
      "timestamp"
    ]
  },
  {
    "id": "personal.ethnic-group",
    "reference": "Ethnic Group",
    "name": "Ethnic Group",
    "category": "Personal",
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
    "id": "personal.first-name-any-gender",
    "reference": "First Name (any gender)",
    "name": "First Name (any gender)",
    "category": "Personal",
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
    "id": "personal.first-name-female",
    "reference": "First Name (female)",
    "name": "First Name (female)",
    "category": "Personal",
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
    "id": "personal.first-name-male",
    "reference": "First Name (male)",
    "name": "First Name (male)",
    "category": "Personal",
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
    "id": "personal.full-name",
    "reference": "Full Name",
    "name": "Full Name",
    "category": "Personal",
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
    "id": "personal.gender",
    "reference": "Gender",
    "name": "Gender",
    "category": "Personal",
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
    "id": "personal.honorific-prefix-title",
    "reference": "Honorific Prefix (Title)",
    "name": "Honorific Prefix (Title)",
    "category": "Personal",
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
    "id": "personal.honorific-suffix",
    "reference": "Honorific Suffix",
    "name": "Honorific Suffix",
    "category": "Personal",
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
    "id": "personal.initials",
    "reference": "Initials",
    "name": "Initials",
    "category": "Personal",
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
    "id": "personal.integrated-circuit-card-id-iccid",
    "reference": "Integrated Circuit Card ID (ICCID)",
    "name": "Integrated Circuit Card ID (ICCID)",
    "category": "Personal",
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
    "id": "personal.job-title",
    "reference": "Job Title",
    "name": "Job Title",
    "category": "Personal",
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
    "id": "personal.last-name",
    "reference": "Last Name",
    "name": "Last Name",
    "category": "Personal",
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
    "id": "personal.marital-status",
    "reference": "Marital Status",
    "name": "Marital Status",
    "category": "Personal",
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
    "id": "personal.middle-name",
    "reference": "Middle Name",
    "name": "Middle Name",
    "category": "Personal",
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
    "id": "personal.nickname",
    "reference": "NickName",
    "name": "NickName",
    "category": "Personal",
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
    "id": "personal.permanent-account-number-pan",
    "reference": "Permanent Account Number(PAN)",
    "name": "Permanent Account Number(PAN)",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "nchar",
      "nvarchar",
      "text",
      "tinytext",
      "varchar"
    ]
  },
  {
    "id": "personal.phone-extension",
    "reference": "Phone Extension",
    "name": "Phone Extension",
    "category": "Personal",
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
    "id": "personal.phone-number-domestic",
    "reference": "Phone Number (domestic)",
    "name": "Phone Number (domestic)",
    "category": "Personal",
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
    "id": "personal.phone-number-international",
    "reference": "Phone Number (international)",
    "name": "Phone Number (international)",
    "category": "Personal",
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
    "id": "personal.phone-number-local",
    "reference": "Phone Number (local)",
    "name": "Phone Number (local)",
    "category": "Personal",
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
    "id": "personal.phone-number-toll-free",
    "reference": "Phone Number (toll-free)",
    "name": "Phone Number (toll-free)",
    "category": "Personal",
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
    "id": "personal.phone-number-type",
    "reference": "Phone Number Type",
    "name": "Phone Number Type",
    "category": "Personal",
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
    "id": "personal.twitter-id",
    "reference": "Twitter ID",
    "name": "Twitter ID",
    "category": "Personal",
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
    "id": "personal.uk-national-insurance-number-nino",
    "reference": "UK National Insurance Number (NINO)",
    "name": "UK National Insurance Number (NINO)",
    "category": "Personal",
    "languages": [
      "GB"
    ],
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
    "id": "personal.uk-phone-number-free",
    "reference": "UK Phone Number (free)",
    "name": "UK Phone Number (free)",
    "category": "Personal",
    "languages": [
      "GB"
    ],
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
    "id": "personal.uk-phone-number-mobile",
    "reference": "UK Phone Number (mobile)",
    "name": "UK Phone Number (mobile)",
    "category": "Personal",
    "languages": [
      "GB"
    ],
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
    "id": "personal.uk-phone-number-premium-rate-service",
    "reference": "UK Phone Number (premium rate service)",
    "name": "UK Phone Number (premium rate service)",
    "category": "Personal",
    "languages": [
      "GB"
    ],
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
    "id": "personal.uk-phone-number-wide",
    "reference": "UK Phone Number (wide)",
    "name": "UK Phone Number (wide)",
    "category": "Personal",
    "languages": [
      "GB"
    ],
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
    "id": "personal.url-gravatar-image",
    "reference": "URL (Gravatar image)",
    "name": "URL (Gravatar image)",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "char",
      "longtext",
      "mediumtext",
      "text",
      "varchar"
    ]
  },
  {
    "id": "personal.us-annual-salary",
    "reference": "US Annual Salary",
    "name": "US Annual Salary",
    "category": "Personal",
    "languages": [],
    "columnTypes": [
      "bigint",
      "decimal",
      "double",
      "float",
      "int",
      "mediumint"
    ]
  },
  {
    "id": "personal.us-social-security-number-ssn",
    "reference": "US Social Security Number (SSN)",
    "name": "US Social Security Number (SSN)",
    "category": "Personal",
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
    "id": "personal.working-age",
    "reference": "Working Age",
    "name": "Working Age",
    "category": "Personal",
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
  }
] as const

const femaleNames = ['Alina', 'Beatriz', 'Celia', 'Dara', 'Elisa', 'Freya', 'Helena', 'Iris', 'Lena', 'Marta', 'Nora', 'Vera'] as const
const maleNames = ['Adrian', 'Breno', 'Caio', 'Dario', 'Emil', 'Felix', 'Gustavo', 'Hugo', 'Ivan', 'Jonas', 'Otto', 'Rui'] as const
const surnames = ['Avelar', 'Bastos', 'Cordeiro', 'Duarte', 'Esteves', 'Faria', 'Goulart', 'Leal', 'Moura', 'Nogueira', 'Prado', 'Tavares'] as const
const GermanFirst = ['Ansel', 'Berta', 'Clara', 'Dieter', 'Emil', 'Frida', 'Greta', 'Hanno', 'Ilse', 'Jannik', 'Lotte', 'Marlene'] as const
const GermanLast = ['Auer', 'Bergmann', 'Dorn', 'Eckert', 'Falk', 'Gerber', 'Heller', 'Kappel', 'Lenz', 'Reuter', 'Seifert', 'Vogel'] as const
const jobTitles = ['Data Steward', 'Field Technician', 'Lab Coordinator', 'Systems Analyst', 'Workshop Planner', 'Quality Reviewer', 'Library Assistant', 'Transit Scheduler'] as const
const ethnicLabels = ['Sample community A', 'Sample community B', 'Sample community C', 'Unspecified synthetic group'] as const
const reservedPhones = ['202-555-0100', '202-555-0101', '202-555-0102', '202-555-0103', '202-555-0104', '202-555-0105', '202-555-0106', '202-555-0107'] as const
const ukPhone = (kind: 'free' | 'mobile' | 'premium' | 'wide', random: () => number): string => {
  const suffix = String(Math.floor(random() * 1000)).padStart(3, '0')
  if (kind === 'free') return `0808 157 0${suffix}`
  if (kind === 'mobile') return `07700 900${suffix}`
  if (kind === 'premium') return `0909 879 0${suffix}`
  return `01632 960${suffix}`
}

function sin(random: () => number): string { const body = `0${digits(7, random)}`; return body + luhnDigit(body) }
function iccid(random: () => number): string { const body = `89${digits(17, random)}`; return body + luhnDigit(body) }
function pseudoHash(text: string): string {
  let state = 2166136261
  for (const char of text) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619) }
  return Array.from({ length: 8 }, (_, index) => ((state >>> (index * 4)) & 15).toString(16)).join('').repeat(4)
}

function personalValue(reference: string, context: ReferenceGeneratorContext): unknown {
  const { random, rowIndex, locale } = context
  const first = locale === 'pt-BR' ? ['Aline', 'Breno', 'Cecilia', 'Davi', 'Estela', 'Fabio', 'Graça', 'Ivo', 'Lara', 'Nuno', 'Rita', 'Tales'] : femaleNames
  const last = locale === 'pt-BR' ? ['Amaral', 'Braga', 'Cardoso', 'Freitas', 'Lacerda', 'Macedo', 'Pacheco', 'Ramos', 'Siqueira', 'Viana'] : surnames
  const given = pick(first, random)
  const family = pick(last, random)
  const birthday = dateValue(random, 1965, 2005)
  switch (reference) {
    case 'Age': return 18 + Math.floor(random() * 71)
    case 'Avatar Images': return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#${pseudoHash(`${rowIndex}:${Math.floor(random() * 1e9)}`).slice(0, 6)}"/><circle cx="16" cy="12" r="6" fill="#f2d4bd"/><path d="M4 32c1-8 6-12 12-12s11 4 12 12" fill="#586a80"/></svg>`)
    case 'Birth Date': return birthday
    case 'Death Date': return `${1960 + Math.floor(random() * 66)}-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`
    case 'Employment Term': return `${2010 + Math.floor(random() * 15)}-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`
    case 'CA Social Insurance Number (SIN)': return sin(random)
    case 'DE First Name (any gender)': return pick(GermanFirst, random)
    case 'DE First Name (female)': return pick(['Alma', 'Brigitte', 'Elke', 'Inga', 'Klara', 'Nadine', 'Petra', 'Tilda'], random)
    case 'DE First Name (male)': return pick(['Armin', 'Bastian', 'Conrad', 'Enno', 'Friedel', 'Klaus', 'Lars', 'Uwe'], random)
    case 'DE Full Name': return `${pick(GermanFirst, random)} ${pick(GermanLast, random)}`
    case 'DE Honorific Prefix (Title)': return pick(['Dr.', 'Prof.', 'Dipl.-Ing.', 'Mag.'], random)
    case 'DE Last Name': return pick(GermanLast, random)
    case 'Courtesy Title': return pick(['Mx.', 'Dr.', 'Prof.', 'Hon.'], random)
    case 'Email': return `${given.toLowerCase()}.${family.toLowerCase()}${rowIndex}@example.test`
    case 'Ethnic Group': return pick(ethnicLabels, random)
    case 'First Name (any gender)': return pick([...femaleNames, ...maleNames], random)
    case 'First Name (female)': return pick(femaleNames, random)
    case 'First Name (male)': return pick(maleNames, random)
    case 'Full Name': return `${given} ${family}`
    case 'Gender': return pick(['female', 'male', 'non-binary', 'unspecified'], random)
    case 'Honorific Prefix (Title)': return pick(['Mx.', 'Dr.', 'Prof.', 'Rev.'], random)
    case 'Honorific Suffix': return pick(['Jr.', 'Sr.', 'II', 'III', ''], random)
    case 'Initials': return `${given[0]}.${family[0]}.`
    case 'Integrated Circuit Card ID (ICCID)': return iccid(random)
    case 'Job Title': return pick(jobTitles, random)
    case 'Last Name': return family
    case 'Marital Status': return pick(['single', 'married', 'partnered', 'separated', 'widowed'], random)
    case 'Middle Name': return pick(first, random)
    case 'NickName': return `${given}${1 + Math.floor(random() * 99)}`
    case 'Permanent Account Number(PAN)': return `${pick(['ALMPR', 'BCTVS', 'CFDNT', 'DGHUW'], random)}${digits(4, random)}${pick([...'ABCDEFGHJKLMNPQRSTUVWXYZ'], random)}`
    case 'Phone Extension': return String(100 + Math.floor(random() * 900))
    case 'Phone Number (domestic)': return reservedPhones[Math.floor(random() * reservedPhones.length)]
    case 'Phone Number (international)': return `+1 ${reservedPhones[Math.floor(random() * reservedPhones.length)]}`
    case 'Phone Number (local)': return `555-01${String(Math.floor(random() * 100)).padStart(2, '0')}`
    case 'Phone Number (toll-free)': return `800-555-01${String(Math.floor(random() * 100)).padStart(2, '0')}`
    case 'Phone Number Type': return pick(['mobile', 'landline', 'work', 'fax', 'toll-free'], random)
    case 'Twitter ID': return `@${given.toLowerCase()}_${1000 + Math.floor(random() * 9000)}`
    case 'UK National Insurance Number (NINO)': return `QQ${digits(6, random)}${pick(['A', 'B', 'C', 'D'], random)}`
    case 'UK Phone Number (free)': return ukPhone('free', random)
    case 'UK Phone Number (mobile)': return ukPhone('mobile', random)
    case 'UK Phone Number (premium rate service)': return ukPhone('premium', random)
    case 'UK Phone Number (wide)': return ukPhone('wide', random)
    case 'URL (Gravatar image)': return `https://www.gravatar.com/avatar/${pseudoHash(`${given}.${family}.${rowIndex}`)}`
    case 'US Annual Salary': return 32000 + Math.floor(random() * 168001)
    case 'US Social Security Number (SSN)': return `900-${String(10 + Math.floor(random() * 90)).padStart(2, '0')}-${String(1000 + Math.floor(random() * 9000))}`
    case 'Working Age': return 18 + Math.floor(random() * 49)
    default: throw new Error(`Unknown Personal generator: ${reference}`)
  }
}

const validators: Record<string, (value: string) => boolean> = {
  'CA Social Insurance Number (SIN)': (value) => /^\d{9}$/.test(value) && luhnValid(value),
  'Integrated Circuit Card ID (ICCID)': (value) => /^89\d{18}$/.test(value) && luhnValid(value),
  'Permanent Account Number(PAN)': commonValidator(/^[A-Z]{5}\d{4}[A-Z]$/),
  'UK National Insurance Number (NINO)': commonValidator(/^(?:QQ|[A-CEGHJ-PR-TW-Z]{2})\d{6}[A-D]$/),
  'US Social Security Number (SSN)': commonValidator(/^9\d{2}-\d{2}-\d{4}$/),
  Email: commonValidator(/^[a-z]+\.[a-z]+\d*@example\.test$/),
  'URL (Gravatar image)': commonValidator(/^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{32}$/),
  'Phone Number (domestic)': commonValidator(/^202-555-01\d{2}$/),
  'Phone Number (international)': commonValidator(/^\+1 202-555-01\d{2}$/),
  'Phone Number (local)': commonValidator(/^555-01\d{2}$/),
  'Phone Number (toll-free)': commonValidator(/^800-555-01\d{2}$/),
  'UK Phone Number (free)': commonValidator(/^0808 157 0\d{3}$/),
  'UK Phone Number (mobile)': commonValidator(/^07700 900\d{3}$/),
  'UK Phone Number (premium rate service)': commonValidator(/^0909 879 0\d{3}$/),
  'UK Phone Number (wide)': commonValidator(/^01632 960\d{3}$/)
}

const uniqueRefs = new Set(['Email', 'Integrated Circuit Card ID (ICCID)', 'CA Social Insurance Number (SIN)', 'Permanent Account Number(PAN)', 'UK National Insurance Number (NINO)', 'US Social Security Number (SSN)', 'Twitter ID'])
const syntheticRefs = new Set([...uniqueRefs, 'Phone Number (domestic)', 'Phone Number (international)', 'Phone Number (local)', 'Phone Number (toll-free)', 'UK Phone Number (free)', 'UK Phone Number (mobile)', 'UK Phone Number (premium rate service)', 'UK Phone Number (wide)'])

export const personalGenerators: readonly CatalogGenerator[] = metadata.map((entry) => ({
  ...entry,
  unique: uniqueRefs.has(entry.name),
  ...(syntheticRefs.has(entry.name) ? { synthetic: 'Uses fabricated or reserved-range values; do not treat as a real identity or contact record.' } : {}),
  generate: (random, context) => personalValue(entry.name, { random, locale: context.locale, rowIndex: context.index }),
  ...(validators[entry.name] ? { validate: validators[entry.name] } : {})
}))

registerCatalogGenerators(personalGenerators)
