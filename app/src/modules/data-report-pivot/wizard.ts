import { validateReportQuery } from './query-validation.js'

export type WizardReportType = 'standard' | 'label' | 'blank'
export type WizardLayout = 'columnar' | 'tabular' | 'justified'
export type WizardOrientation = 'portrait' | 'landscape'
export type WizardStyle = 'Aurora' | 'Slate' | 'Cedar' | 'Ocean' | 'Ember'

export interface DataReportWizardResult {
  reportType: WizardReportType
  connectionId: string
  database: string
  query: string
  columns: string[]
  grouping: string[]
  layout: WizardLayout
  orientation: WizardOrientation
  fitPage: boolean
  style: WizardStyle
  title: string
}

export function validateWizardResult(value: DataReportWizardResult): DataReportWizardResult {
  if (!['standard', 'label', 'blank'].includes(value.reportType) || !Array.isArray(value.columns) || !Array.isArray(value.grouping)) throw new Error('Incomplete Data Report setup.')
  if (value.reportType !== 'blank') {
    if (!value.connectionId || !value.database) throw new Error('Choose a connection and database.')
    validateReportQuery(value.query)
  }
  const columns = [...new Set(value.columns.filter((field) => typeof field === 'string' && field.length > 0))]
  const grouping = [...new Set(value.grouping.filter((field) => columns.includes(field)))]
  if (value.reportType !== 'blank' && columns.length === 0) throw new Error('Choose at least one report column.')
  if (!['columnar', 'tabular', 'justified'].includes(value.layout) || !['portrait', 'landscape'].includes(value.orientation) || !['Aurora', 'Slate', 'Cedar', 'Ocean', 'Ember'].includes(value.style)) throw new Error('Invalid Data Report layout.')
  return { ...value, columns, grouping, title: value.title.trim().slice(0, 120) || 'TuxSQL Report' }
}

export interface MasterDetailDocument {
  version: 1
  connectionId: string
  database: string
  table: string
  fetchLimit: number
  where: string
  orderBy: string
  selectedColumns: string[]
}

export function serializeMasterDetailDocument(document: MasterDetailDocument): string {
  return JSON.stringify({ ...document, version: 1 })
}

export function parseMasterDetailDocument(contents: string): MasterDetailDocument {
  let value: unknown
  try { value = JSON.parse(contents) } catch { throw new Error('Invalid Master-Detail document.') }
  if (!value || typeof value !== 'object') throw new Error('Invalid Master-Detail document.')
  const candidate = value as Partial<MasterDetailDocument>
  if (candidate.version !== 1 || typeof candidate.connectionId !== 'string' || typeof candidate.database !== 'string' || typeof candidate.table !== 'string' || !Number.isInteger(candidate.fetchLimit) || (candidate.fetchLimit ?? 0) < 1 || (candidate.fetchLimit ?? 0) > 5000 || typeof candidate.where !== 'string' || typeof candidate.orderBy !== 'string' || !Array.isArray(candidate.selectedColumns) || candidate.selectedColumns.some((column) => typeof column !== 'string')) throw new Error('Invalid Master-Detail document.')
  return candidate as MasterDetailDocument
}
