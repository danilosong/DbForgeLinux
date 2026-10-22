import { digits, fromAlphabet, integer, pick, registerCatalogGenerators, type CatalogGenerator } from './types.js'

const metadata = [
  {
    "id": "health.drug-name",
    "reference": "Drug Name",
    "name": "Drug Name",
    "category": "Health",
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
    "id": "health.icd10-diagnose-code",
    "reference": "ICD10 Diagnose Code",
    "name": "ICD10 Diagnose Code",
    "category": "Health",
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
    "id": "health.icd10-diagnose-description-long",
    "reference": "ICD10 Diagnose Description (long)",
    "name": "ICD10 Diagnose Description (long)",
    "category": "Health",
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
    "id": "health.icd10-diagnose-description-short",
    "reference": "ICD10 Diagnose Description (short)",
    "name": "ICD10 Diagnose Description (short)",
    "category": "Health",
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
    "id": "health.icd10-procedure-code",
    "reference": "ICD10 Procedure Code",
    "name": "ICD10 Procedure Code",
    "category": "Health",
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
    "id": "health.icd10-procedure-description-long",
    "reference": "ICD10 Procedure Description (long)",
    "name": "ICD10 Procedure Description (long)",
    "category": "Health",
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
    "id": "health.icd10-procedure-description-short",
    "reference": "ICD10 Procedure Description (short)",
    "name": "ICD10 Procedure Description (short)",
    "category": "Health",
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
    "id": "health.icd9-diagnose-code",
    "reference": "ICD9 Diagnose Code",
    "name": "ICD9 Diagnose Code",
    "category": "Health",
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
    "id": "health.icd9-diagnose-description-long",
    "reference": "ICD9 Diagnose Description (long)",
    "name": "ICD9 Diagnose Description (long)",
    "category": "Health",
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
    "id": "health.icd9-diagnose-description-short",
    "reference": "ICD9 Diagnose Description (short)",
    "name": "ICD9 Diagnose Description (short)",
    "category": "Health",
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
    "id": "health.icd9-procedure-code",
    "reference": "ICD9 Procedure Code",
    "name": "ICD9 Procedure Code",
    "category": "Health",
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
    "id": "health.icd9-procedure-description-long",
    "reference": "ICD9 Procedure Description (long)",
    "name": "ICD9 Procedure Description (long)",
    "category": "Health",
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
    "id": "health.icd9-procedure-description-short",
    "reference": "ICD9 Procedure Description (short)",
    "name": "ICD9 Procedure Description (short)",
    "category": "Health",
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
    "id": "health.uk-national-health-service-number-nhs-number-isb-0149",
    "reference": "UK National Health Service Number (NHS Number, ISB 0149)",
    "name": "UK National Health Service Number (NHS Number, ISB 0149)",
    "category": "Health",
    "languages": [
      "GB"
    ],
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
    "id": "health.us-national-drug-code-fda-ndc",
    "reference": "US National Drug Code (FDA NDC)",
    "name": "US National Drug Code (FDA NDC)",
    "category": "Health",
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
  }
] as const

const drugRoots = ['Aven', 'Belor', 'Ceral', 'Dovex', 'Elar', 'Fenor', 'Galun', 'Havix', 'Ivor', 'Jalen', 'Korin', 'Lumer'] as const
const drugEnds = ['afin', 'adryl', 'emide', 'orate', 'ivex', 'azone', 'uron', 'alate'] as const
const shortTerms = ['synthetic respiratory condition', 'sample joint discomfort', 'test digestive syndrome', 'fictional skin response', 'synthetic nerve condition', 'sample metabolic pattern'] as const
const longTerms = ['A generated example describing a nonclinical respiratory pattern for interface and schema testing.', 'A synthetic joint-related label intended only for software validation and demonstration.', 'A fictional digestive-system description created for deterministic test data.', 'A generated skin-response phrase with no link to a real diagnosis.', 'A synthetic nervous-system label for testing search and text columns.', 'A fictional metabolic description intended for test records only.'] as const
const procedureTerms = ['synthetic tissue sampling', 'sample mobility assessment', 'fictional imaging procedure', 'test-based fluid analysis', 'synthetic device fitting', 'sample recovery session'] as const
const drugName = (random: () => number): string => `${pick(drugRoots, random)}${pick(drugEnds, random)}`
const diagnosisCode10 = (random: () => number): string => `${pick([...'ABCDEFGHJKLMNPQRSTUVWXYZ'], random)}${digits(random, 2)}.${integer(random, 0, 99).toString().padStart(2, '0')}`
const diagnosisCode9 = (random: () => number): string => `${digits(random, 3)}.${String(integer(random, 0, 99)).padStart(2, '0')}`
const procedureCode10 = (random: () => number): string => fromAlphabet(random, '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 7)
const procedureCode9 = (random: () => number): string => `${digits(random, 2)}.${String(integer(random, 0, 99)).padStart(2, '0')}`
function nhsNumber(random: () => number): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const body = `999${digits(random, 6)}`
    const total = [...body].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0)
    const check = 11 - (total % 11)
    if (check !== 10) return body + (check === 11 ? 0 : check)
  }
  throw new Error('Unable to generate a format-valid synthetic NHS number.')
}
function nhsValid(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false
  const total = [...value.slice(0, 9)].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0)
  const check = 11 - (total % 11)
  return (check === 11 ? 0 : check) === Number(value[9]) && check !== 10
}
function healthValue(reference: string, random: () => number): string {
  switch (reference) {
    case 'Drug Name': return drugName(random)
    case 'ICD10 Diagnose Code': return diagnosisCode10(random)
    case 'ICD10 Diagnose Description (long)': return `${pick(longTerms, random)} Synthetic record ${integer(random, 100, 999)}.`
    case 'ICD10 Diagnose Description (short)': return pick(shortTerms, random)
    case 'ICD10 Procedure Code': return procedureCode10(random)
    case 'ICD10 Procedure Description (long)': return `${pick(procedureTerms, random)} using generated protocol ${integer(random, 10, 99)}; test data only.`
    case 'ICD10 Procedure Description (short)': return pick(procedureTerms, random)
    case 'ICD9 Diagnose Code': return diagnosisCode9(random)
    case 'ICD9 Diagnose Description (long)': return `${pick(longTerms, random)} Synthetic legacy label ${integer(random, 100, 999)}.`
    case 'ICD9 Diagnose Description (short)': return pick(shortTerms, random)
    case 'ICD9 Procedure Code': return procedureCode9(random)
    case 'ICD9 Procedure Description (long)': return `${pick(procedureTerms, random)} with generated session marker ${integer(random, 10, 99)}; not a clinical record.`
    case 'ICD9 Procedure Description (short)': return pick(procedureTerms, random)
    case 'UK National Health Service Number (NHS Number, ISB 0149)': return nhsNumber(random)
    case 'US National Drug Code (FDA NDC)': return `${integer(random, 1, 9)}${digits(random, 10)}`
    default: throw new Error(`Unknown Health generator: ${reference}`)
  }
}

const validators: Record<string, (value: string) => boolean> = {
  'Drug Name': (value) => /^[A-Z][a-z]{6,12}$/.test(value),
  'ICD10 Diagnose Code': (value) => /^[A-Z][0-9]{2}\.[0-9]{2}$/.test(value),
  'ICD10 Diagnose Description (long)': (value) => value.length >= 40 && value.includes('Synthetic record'),
  'ICD10 Diagnose Description (short)': (value) => shortTerms.includes(value as typeof shortTerms[number]),
  'ICD10 Procedure Code': (value) => /^[0-9A-HJ-NP-Z]{7}$/.test(value),
  'ICD10 Procedure Description (long)': (value) => value.length >= 40 && value.includes('test data only'),
  'ICD10 Procedure Description (short)': (value) => procedureTerms.includes(value as typeof procedureTerms[number]),
  'ICD9 Diagnose Code': (value) => /^\d{3}\.\d{2}$/.test(value),
  'ICD9 Diagnose Description (long)': (value) => value.length >= 40 && value.includes('Synthetic legacy label'),
  'ICD9 Diagnose Description (short)': (value) => shortTerms.includes(value as typeof shortTerms[number]),
  'ICD9 Procedure Code': (value) => /^\d{2}\.\d{2}$/.test(value),
  'ICD9 Procedure Description (long)': (value) => value.length >= 40 && value.includes('not a clinical record'),
  'ICD9 Procedure Description (short)': (value) => procedureTerms.includes(value as typeof procedureTerms[number]),
  'UK National Health Service Number (NHS Number, ISB 0149)': nhsValid,
  'US National Drug Code (FDA NDC)': (value) => /^[1-9]\d{10}$/.test(value)
}

export const healthGenerators: readonly CatalogGenerator[] = metadata.map((entry) => ({
  ...entry,
  unique: entry.reference === 'UK National Health Service Number (NHS Number, ISB 0149)',
  synthetic: 'Contains fabricated names, descriptions, or format-only codes; not a medical or patient record.',
  generate: (random) => healthValue(entry.name, random),
  validate: validators[entry.name]!
}))

registerCatalogGenerators(healthGenerators)
