export const REPORT_BANDS = ['Report Header', 'Page Header', 'Group Header', 'Detail', 'Group Footer', 'Page Footer', 'Report Footer'] as const
export type ReportBand = typeof REPORT_BANDS[number]
export interface ReportDesign { version: 1; title: string; pageSize: 'A4' | 'Letter'; bands: Record<ReportBand, string[]>; dataSourceQuery?: string; groupField?: string; groupFields?: string[]; sortField?: string; sortDirection?: 'ASC' | 'DESC'; layout?: 'columnar' | 'tabular' | 'justified'; orientation?: 'portrait' | 'landscape'; fitPage?: boolean; style?: 'Aurora' | 'Slate' | 'Cedar' | 'Ocean' | 'Ember' }

export const REPORT_LAYOUTS = ['columnar', 'tabular', 'justified'] as const
export const REPORT_ORIENTATIONS = ['portrait', 'landscape'] as const
export const REPORT_STYLES = ['Aurora', 'Slate', 'Cedar', 'Ocean', 'Ember'] as const

export function reportPresentation(design: ReportDesign): { layout: typeof REPORT_LAYOUTS[number]; orientation: typeof REPORT_ORIENTATIONS[number]; style: typeof REPORT_STYLES[number]; fitPage: boolean } {
  return {
    layout: design.layout && REPORT_LAYOUTS.includes(design.layout) ? design.layout : 'tabular',
    orientation: design.orientation && REPORT_ORIENTATIONS.includes(design.orientation) ? design.orientation : 'portrait',
    style: design.style && REPORT_STYLES.includes(design.style) ? design.style : 'Aurora',
    fitPage: design.fitPage ?? true
  }
}

export function createReportDesign(title: string, fields: string[]): ReportDesign {
  return { version: 1, title: title.trim().slice(0, 120) || 'Data Report', pageSize: 'A4', bands: Object.fromEntries(REPORT_BANDS.map((band) => [band, band === 'Detail' ? [...fields] : []])) as Record<ReportBand, string[]> }
}

export function placeReportField(design: ReportDesign, field: string, band: ReportBand): ReportDesign {
  if (!field || field.length > 256 || !REPORT_BANDS.includes(band)) throw new Error('Invalid report field placement.')
  return { ...design, bands: Object.fromEntries(REPORT_BANDS.map((name) => [name, name === band ? [...design.bands[name], field] : design.bands[name].filter((item) => item !== field)])) as Record<ReportBand, string[]> }
}

export function parseReportDesign(json: string): ReportDesign {
  if (json.length > 1_000_000) throw new Error('Report design exceeds 1 MB.')
  const value: unknown = JSON.parse(json)
  if (!value || typeof value !== 'object' || (value as Partial<ReportDesign>).version !== 1) throw new Error('Unsupported report design.')
  const design = value as ReportDesign
  if (typeof design.title !== 'string' || !['A4', 'Letter'].includes(design.pageSize) || !design.bands || !REPORT_BANDS.every((band) => Array.isArray(design.bands[band]) && design.bands[band].every((field) => typeof field === 'string' && field.length <= 256))) throw new Error('Invalid report design.')
  if (design.dataSourceQuery !== undefined && (typeof design.dataSourceQuery !== 'string' || design.dataSourceQuery.length > 100_000)) throw new Error('Invalid report data source query.')
  if (design.groupField !== undefined && (typeof design.groupField !== 'string' || design.groupField.length > 256)) throw new Error('Invalid report group field.')
  if (design.groupFields !== undefined && (!Array.isArray(design.groupFields) || design.groupFields.length > 256 || design.groupFields.some((field) => typeof field !== 'string' || field.length > 256))) throw new Error('Invalid report group fields.')
  if (design.sortField !== undefined && (typeof design.sortField !== 'string' || design.sortField.length > 256)) throw new Error('Invalid report sort field.')
  if (design.sortDirection !== undefined && !['ASC', 'DESC'].includes(design.sortDirection)) throw new Error('Invalid report sort direction.')
  if (design.layout !== undefined && !['columnar', 'tabular', 'justified'].includes(design.layout)) throw new Error('Invalid report layout.')
  if (design.orientation !== undefined && !['portrait', 'landscape'].includes(design.orientation)) throw new Error('Invalid report orientation.')
  if (design.fitPage !== undefined && typeof design.fitPage !== 'boolean') throw new Error('Invalid fit-page setting.')
  if (design.style !== undefined && !['Aurora', 'Slate', 'Cedar', 'Ocean', 'Ember'].includes(design.style)) throw new Error('Invalid report style.')
  return { version: 1, title: design.title.slice(0, 120), pageSize: design.pageSize, bands: Object.fromEntries(REPORT_BANDS.map((band) => [band, [...design.bands[band]]])) as Record<ReportBand, string[]>, dataSourceQuery: design.dataSourceQuery?.slice(0, 100_000), groupField: design.groupField?.slice(0, 256), groupFields: design.groupFields?.map((field) => field.slice(0, 256)), sortField: design.sortField?.slice(0, 256), sortDirection: design.sortDirection, layout: design.layout, orientation: design.orientation, fitPage: design.fitPage, style: design.style }
}

export function reportPages<T>(rows: T[], pageSize = 20): T[][] {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('Report page size must be between 1 and 500 rows.')
  const pages: T[][] = []
  for (let index = 0; index < rows.length; index += pageSize) pages.push(rows.slice(index, index + pageSize))
  return pages.length ? pages : [[]]
}

export function exportDesignedReport(design: ReportDesign, headers: string[], rows: unknown[][], format: 'csv' | 'html'): string {
  const selected = design.bands.Detail.length ? headers.map((header, index) => ({ header, index })).filter(({ header }) => design.bands.Detail.includes(header)) : headers.map((header, index) => ({ header, index }))
  const outputHeaders = selected.map(({ header }) => header)
  const outputRows = rows.map((row) => selected.map(({ index }) => row[index] ?? null))
  if (format === 'csv') return [outputHeaders, ...outputRows].map((row) => row.map(safeCsvCell).join(',')).join('\r\n')
  const escape = (value: unknown): string => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const bands = REPORT_BANDS.map((band) => design.bands[band].length ? `<section data-band="${escape(band)}"><h2>${escape(band)}</h2><p>${design.bands[band].map(escape).join(' · ')}</p></section>` : '').join('')
  const table = `<table><thead><tr>${outputHeaders.map((header) => `<th>${escape(header)}</th>`).join('')}</tr></thead><tbody>${outputRows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  return `<!doctype html><meta charset="utf-8"><title>${escape(design.title)}</title><h1>${escape(design.title)}</h1>${bands}${table}`
}
import { safeCsvCell } from '../csv/safeCsv.js'
