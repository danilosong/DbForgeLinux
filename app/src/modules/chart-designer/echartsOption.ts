import type { EChartsOption } from 'echarts'
import type { CustomSeriesOption } from 'echarts/charts'
import type { ChartChannel, ChartDocumentModel, ChartSeriesModel } from './model.js'
import { MAX_CHART_POINTS } from './model.js'

type CustomSeriesRenderItem = NonNullable<CustomSeriesOption['renderItem']>

export interface ChartOptionResult {
  option: EChartsOption
  rowsUsed: number
  truncated: boolean
}

const palettes: Record<string, readonly string[]> = {
  Nature: ['#2f855a', '#3182ce', '#d69e2e', '#dd6b20', '#805ad5', '#319795'],
  Pastel: ['#93c5fd', '#fda4af', '#fde68a', '#c4b5fd', '#a7f3d0', '#fdba74'],
  Office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'],
  Vibrant: ['#e11d48', '#7c3aed', '#0284c7', '#16a34a', '#ea580c', '#ca8a04'],
  Monochrome: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
  'Devart Default': ['#4a90e2', '#50bfa5', '#f5a623', '#bd10e0', '#7ed321', '#f44336']
}

function value(row: Record<string, unknown>, key: string | undefined): unknown { return key ? row[key] : undefined }
function numeric(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'bigint') return Number(input)
  if (typeof input === 'string' && input.trim() && Number.isFinite(Number(input))) return Number(input)
  if (input instanceof Date && Number.isFinite(input.getTime())) return input.getTime()
  return undefined
}
function timeValue(input: unknown): number | string | undefined {
  if (input instanceof Date) return input.getTime()
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string') { const parsed = Date.parse(input); return Number.isFinite(parsed) ? parsed : input }
  return undefined
}
function hash(input: unknown): number {
  const text = String(input ?? '')
  let output = 0
  for (let index = 0; index < text.length; index++) output = (output * 31 + text.charCodeAt(index)) >>> 0
  return output
}
function colorFor(input: unknown, palette: readonly string[]): string { return palette[hash(input) % palette.length] ?? '#4a90e2' }
function mapType(series: ChartSeriesModel): 'bar' | 'line' | 'scatter' | 'pie' | 'funnel' | 'radar' | 'candlestick' | 'custom' {
  const type = series.type
  if (type === 'Pie' || type === 'Doughnut' || type === 'Nested Doughnut') return 'pie'
  if (type === 'Funnel') return 'funnel'
  if (type.startsWith('Radar')) return 'radar'
  if (type === 'Stock' || type === 'Candle Stick') return 'candlestick'
  if (type.includes('Gantt') || type === 'Range Area') return 'custom'
  if (type === 'Point' || type === 'Bubble' || type === 'Swift Point') return 'scatter'
  if (type.includes('Polar')) return type.includes('Area') ? 'bar' : type.includes('Point') ? 'scatter' : 'line'
  if (type.includes('Range')) return type.includes('Area') ? 'custom' : 'bar'
  if (type.includes('Bar') || type === 'Waterfall') return 'bar'
  if (type.includes('Area')) return 'line'
  return 'line'
}
function makePoint(series: ChartSeriesModel, row: Record<string, unknown>, index: number, palette: readonly string[]): Record<string, unknown> {
  const mapping = series.mappings
  const argument = value(row, mapping.argument) ?? index
  const color = colorFor(value(row, mapping.color), palette)
  const main = numeric(value(row, mapping.value)) ?? 0
  const type = series.type
  const itemStyle = { color, opacity: series.properties.opacity }
  if (type.includes('Polar')) return { name: String(argument), value: [index, main], itemStyle }
  if (type.includes('Gantt')) {
    const start = timeValue(value(row, mapping.start)) ?? 0
    const end = timeValue(value(row, mapping.end)) ?? start
    return { name: String(argument), value: [index, start, end], itemStyle }
  }
  if (type.startsWith('Range')) {
    const low = numeric(value(row, mapping.low)) ?? main
    const high = numeric(value(row, mapping.high)) ?? main
    return { name: String(argument), value: [argument, low, high], itemStyle }
  }
  return { name: String(argument), value: main, itemStyle, symbolSize: type === 'Bubble' ? Math.max(5, Math.abs(numeric(value(row, mapping.size)) ?? main) * 2) : series.properties.symbolSize }
}

function customRangeRenderer(): CustomSeriesRenderItem {
  return (_params, api) => {
    const x = api.coord([api.value(0), api.value(1)])
    const y = api.coord([api.value(0), api.value(2)])
    const size = api.size?.([1, 0]) ?? 0
    const width = Math.abs(Array.isArray(size) ? size[0] ?? 0 : size)
    const shape = { x: x[0]! - width * 0.32, y: y[1]!, width: width * 0.64, height: x[1]! - y[1]! }
    return { type: 'rect', shape, style: api.style() }
  }
}

function customGanttRenderer(): CustomSeriesRenderItem {
  return (_params, api) => {
    const start = api.coord([api.value(1), api.value(0)])
    const end = api.coord([api.value(2), api.value(0)])
    const size = api.size?.([0, 1]) ?? 0
    const height = Math.max(4, Math.abs(Array.isArray(size) ? size[1] ?? 0 : size) * 0.55)
    return { type: 'rect', shape: { x: start[0]!, y: start[1]! - height / 2, width: Math.max(1, end[0]! - start[0]!), height }, style: api.style() }
  }
}

function seriesOption(series: ChartSeriesModel, rows: readonly Record<string, unknown>[], palette: readonly string[]): Record<string, unknown> {
  const type = mapType(series)
  const data = rows.map((row, index) => makePoint(series, row, index, palette))
  const mapping = series.mappings
  const common: Record<string, unknown> = { name: series.name, type, data, show: series.visible, label: { show: series.properties.labelsVisible }, itemStyle: { opacity: series.properties.opacity } }
  if (!series.showInLegend) common.legendHoverLink = false
  if (type === 'pie') return { ...common, type, radius: series.type === 'Pie' ? ['0%', '72%'] : series.type === 'Nested Doughnut' ? ['25%', '74%'] : ['42%', '74%'], encode: { itemName: 'name', value: 'value' } }
  if (type === 'funnel') return { ...common, encode: { itemName: 'name', value: 'value' }, sort: 'descending', gap: 3 }
  if (type === 'radar') return { ...common, data: [{ name: series.name, value: data.map((item) => Number(item.value) || 0) }], areaStyle: series.type.includes('Area') ? { opacity: series.properties.opacity } : undefined, lineStyle: { width: series.type.includes('Line') ? 2 : 1 }, symbol: series.type.includes('Point') ? 'circle' : 'none' }
  if (type === 'candlestick') {
    const ohlc = rows.map((row) => [value(row, mapping.argument), numeric(value(row, mapping.open)) ?? 0, numeric(value(row, mapping.close)) ?? 0, numeric(value(row, mapping.low)) ?? 0, numeric(value(row, mapping.high)) ?? 0])
    return { ...common, data: ohlc, encode: { x: 0, y: [1, 2, 3, 4] } }
  }
  if (type === 'custom' && series.type.includes('Gantt')) return { ...common, renderItem: customGanttRenderer(), encode: { x: [1, 2], y: 0 } }
  if (type === 'custom') return { ...common, renderItem: customRangeRenderer(), encode: { x: 0, y: [1, 2] } }
  if (series.type.includes('Polar')) return { ...common, coordinateSystem: 'polar', encode: { angle: 0, radius: 1 }, showSymbol: type === 'scatter' || series.type.includes('Point'), areaStyle: series.type.includes('Area') ? { opacity: series.properties.opacity } : undefined, smooth: series.properties.smooth }
  if (series.type === 'Range Bar' || series.type === 'Side By Side Range Bar') return { ...common, data: data.map((item) => ({ name: item.name, value: [item.value instanceof Array ? item.value[1] : 0, item.value instanceof Array ? item.value[2] : 0], itemStyle: item.itemStyle })), barGap: series.type === 'Side By Side Range Bar' ? '20%' : '-100%' }
  const stacked = /Stacked/i.test(series.type)
  const area = series.type.includes('Area')
  const step = /Step/i.test(series.type)
  return { ...common, stack: stacked ? series.name : undefined, stackStrategy: series.type.includes('100%') ? 'all' : undefined, areaStyle: area ? { opacity: series.properties.opacity } : undefined, smooth: series.properties.smooth, step: step ? 'middle' : undefined, showSymbol: type === 'scatter' || series.type === 'Scatter Line', symbolSize: series.properties.symbolSize, barMinHeight: series.type === 'Waterfall' ? 1 : undefined }
}

export function buildChartOption(document: ChartDocumentModel, sourceRows: readonly Record<string, unknown>[], totalRows = sourceRows.length, resultWasTruncated = false): ChartOptionResult {
  const rows = sourceRows.slice(0, MAX_CHART_POINTS)
  const visible = document.series.filter((series) => series.visible)
  const palette = palettes[document.palette] ?? palettes.Nature!
  const option: Record<string, unknown> = {
    backgroundColor: document.background,
    title: document.title ? { text: document.title, left: 'center' } : undefined,
    tooltip: { trigger: 'item' },
    legend: { show: document.legend, bottom: 0, data: visible.filter((series) => series.showInLegend).map((series) => series.name) },
    color: palette,
    animation: false,
    grid: { containLabel: true, left: '8%', right: '6%', top: '10%', bottom: document.legend ? '18%' : '10%' },
    xAxis: { type: 'category', data: rows.map((row, index) => String(value(row, visible[0]?.mappings.argument) ?? index)), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', scale: true },
    polar: visible.some((series) => series.type.includes('Polar')) ? { center: ['50%', '48%'], radius: '72%' } : undefined,
    angleAxis: visible.some((series) => series.type.includes('Polar')) ? { type: 'category', data: rows.map((row, index) => String(value(row, visible[0]?.mappings.argument) ?? index)), startAngle: 90 } : undefined,
    radiusAxis: visible.some((series) => series.type.includes('Polar')) ? {} : undefined,
    radar: visible.some((series) => series.type.startsWith('Radar')) ? { indicator: rows.map((row, index) => ({ name: String(value(row, visible[0]?.mappings.argument) ?? index), max: Math.max(1, numeric(value(row, visible[0]?.mappings.value)) ?? 1) })) } : undefined,
    series: visible.map((series) => seriesOption(series, rows, palette))
  }
  if (visible.some((series) => series.type.includes('Gantt'))) {
    option.xAxis = { type: 'time', scale: true }
    option.yAxis = { type: 'category', data: rows.map((row, index) => String(value(row, visible[0]?.mappings.argument) ?? `Task ${index + 1}`)), inverse: true }
  }
  if (visible.some((series) => series.type.includes('Polar'))) { delete option.xAxis; delete option.yAxis; delete option.grid }
  if (visible.some((series) => series.type.startsWith('Radar'))) { delete option.xAxis; delete option.yAxis; delete option.grid }
  if (visible.some((series) => ['Pie', 'Doughnut', 'Nested Doughnut', 'Funnel'].includes(series.type))) { delete option.xAxis; delete option.yAxis; delete option.grid }
  const isTruncated = resultWasTruncated || totalRows > rows.length || sourceRows.length > MAX_CHART_POINTS
  return { option: option as EChartsOption, rowsUsed: rows.length, truncated: isTruncated }
}

export function getChannelValue(series: ChartSeriesModel, channel: ChartChannel): string { return series.mappings[channel] ?? '' }
