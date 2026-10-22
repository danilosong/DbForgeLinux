import { allChartSeries, findChartFamily } from './catalog.js'

export const MAX_CHART_POINTS = 50_000

export type ChartChannel = 'argument' | 'value' | 'color' | 'size' | 'low' | 'high' | 'open' | 'close' | 'start' | 'end'

export interface ChartSeriesModel {
  id: string
  name: string
  type: string
  visible: boolean
  showInLegend: boolean
  mappings: Partial<Record<ChartChannel, string>>
  properties: {
    labelsVisible: boolean
    smooth: boolean
    opacity: number
    symbolSize: number
    numericSummary: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'
  }
}

export interface ChartDocumentModel {
  version: 1
  title: string
  legend: boolean
  additionalLegends: string[]
  titles: string[]
  annotations: string[]
  appearance: string
  palette: string
  background: string
  autoLayout: boolean
  series: ChartSeriesModel[]
}

export interface ChartHistory {
  past: ChartDocumentModel[]
  present: ChartDocumentModel
  future: ChartDocumentModel[]
}

export type ChartSeriesUpdate = Partial<Omit<ChartSeriesModel, 'mappings' | 'properties'>> & { mappings?: Partial<Record<ChartChannel, string>>; properties?: Partial<ChartSeriesModel['properties']> }

export type ChartAction =
  | { type: 'add-series'; series: ChartSeriesModel }
  | { type: 'remove-series'; id: string }
  | { type: 'update-series'; id: string; update: ChartSeriesUpdate }
  | { type: 'update-chart'; update: Partial<Pick<ChartDocumentModel, 'title' | 'legend' | 'appearance' | 'palette' | 'background' | 'autoLayout'>> }
  | { type: 'add-title' }
  | { type: 'add-annotation' }

const emptyDocument = (): ChartDocumentModel => ({ version: 1, title: '', legend: true, additionalLegends: [], titles: [], annotations: [], appearance: 'Default', palette: 'Nature', background: 'transparent', autoLayout: true, series: [] })

export function createChartHistory(initial = emptyDocument()): ChartHistory {
  return { past: [], present: initial, future: [] }
}

function cloneDocument(value: ChartDocumentModel): ChartDocumentModel {
  return { ...value, additionalLegends: [...value.additionalLegends], titles: [...value.titles], annotations: [...value.annotations], series: value.series.map((series) => ({ ...series, mappings: { ...series.mappings }, properties: { ...series.properties } })) }
}

export function createSeriesModel(type: string, columns: readonly string[], sampleRows: readonly Record<string, unknown>[], index: number): ChartSeriesModel {
  if (!allChartSeries.some((item) => item.name === type)) throw new Error(`Unknown chart series: ${type}`)
  const numericColumn = columns.find((column) => sampleRows.some((row) => typeof row[column] === 'number'))
  const argument = columns[0]
  const value = numericColumn ?? columns.find((column) => column !== argument) ?? argument
  const secondNumeric = columns.find((column) => column !== value && sampleRows.some((row) => typeof row[column] === 'number'))
  const family = findChartFamily(type)?.id
  const mappings: Partial<Record<ChartChannel, string>> = { ...(argument ? { argument } : {}), ...(value ? { value } : {}) }
  if (family === 'range') { if (value) mappings.low = value; if (secondNumeric) mappings.high = secondNumeric }
  if (type === 'Bubble' && secondNumeric) mappings.size = secondNumeric
  if (family === 'financial') { if (value) mappings.open = value; if (secondNumeric) mappings.close = secondNumeric; if (secondNumeric) mappings.low = secondNumeric; if (numericColumn) mappings.high = numericColumn }
  if (family === 'gantt') { if (value) mappings.start = value; if (secondNumeric) mappings.end = secondNumeric }
  if (columns.length > 2) mappings.color = columns[2]
  return { id: `series-${index}`, name: `Series ${index}`, type, visible: true, showInLegend: true, mappings, properties: { labelsVisible: false, smooth: type.includes('Spline'), opacity: 0.8, symbolSize: type === 'Bubble' ? 20 : 8, numericSummary: 'SUM' } }
}

export function applyChartAction(history: ChartHistory, action: ChartAction): ChartHistory {
  const next = cloneDocument(history.present)
  if (action.type === 'add-series' && !next.series.some((series) => series.id === action.series.id)) next.series.push({ ...action.series, mappings: { ...action.series.mappings }, properties: { ...action.series.properties } })
  if (action.type === 'remove-series') next.series = next.series.filter((series) => series.id !== action.id)
  if (action.type === 'update-series') {
    next.series = next.series.map((series) => series.id === action.id ? { ...series, ...action.update, mappings: { ...series.mappings, ...action.update.mappings }, properties: { ...series.properties, ...action.update.properties } } : series)
  }
  if (action.type === 'update-chart') Object.assign(next, action.update)
  if (action.type === 'add-title') next.titles.push(`Title ${next.titles.length + 1}`)
  if (action.type === 'add-annotation') next.annotations.push(`Annotation ${next.annotations.length + 1}`)
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history
  return { past: [...history.past, cloneDocument(history.present)], present: next, future: [] }
}

export function undoChart(history: ChartHistory): ChartHistory {
  if (!history.past.length) return history
  const [present, ...past] = history.past.slice().reverse()
  return { past: past.reverse(), present: cloneDocument(present!), future: [cloneDocument(history.present), ...history.future] }
}

export function redoChart(history: ChartHistory): ChartHistory {
  if (!history.future.length) return history
  const [present, ...future] = history.future
  return { past: [...history.past, cloneDocument(history.present)], present: cloneDocument(present!), future: future.map(cloneDocument) }
}

export function treeItems(document: ChartDocumentModel): Array<{ id: string; label: string; kind: 'chart' | 'group' | 'series' | 'legend' | 'additional-legend' | 'title' | 'annotation' }> {
  return [
    { id: 'chart', label: 'Chart', kind: 'chart' },
    { id: 'series-group', label: `Series (${document.series.length})`, kind: 'group' },
    ...document.series.map((series) => ({ id: series.id, label: series.name, kind: 'series' as const })),
    { id: 'legend', label: 'Legend', kind: 'legend' },
    { id: 'additional-legends', label: `Additional Legends (${document.additionalLegends.length})`, kind: 'group' },
    ...document.additionalLegends.map((label, index) => ({ id: `additional-legend-${index}`, label, kind: 'additional-legend' as const })),
    { id: 'titles', label: `Titles (${document.titles.length})`, kind: 'group' },
    ...document.titles.map((label, index) => ({ id: `title-${index}`, label, kind: 'title' as const })),
    { id: 'annotations', label: `Annotations (${document.annotations.length})`, kind: 'group' },
    ...document.annotations.map((label, index) => ({ id: `annotation-${index}`, label, kind: 'annotation' as const }))
  ]
}

export function getChannelValue(series: ChartSeriesModel, channel: ChartChannel): string { return series.mappings[channel] ?? '' }
