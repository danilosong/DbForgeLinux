import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nContext } from '../../src/renderer/src/i18n/context.js'
import { ChartDesignerModal } from '../../src/renderer/src/ui/components/ChartDesignerModal.js'
import { chartFamilies } from '../../src/modules/chart-designer/catalog.js'
import { buildChartOption } from '../../src/modules/chart-designer/echartsOption.js'
import { applyChartAction, createChartHistory, createSeriesModel, MAX_CHART_POINTS, redoChart, treeItems, undoChart, type ChartDocumentModel, type ChartSeriesModel } from '../../src/modules/chart-designer/model.js'
import { defaultSettings } from '../../src/modules/options/types.js'
import { mergeSettings } from '../../src/modules/options/index.js'

const rows = [
  { month: 'Jan', sales: 12, floor: 8, ceiling: 17, segment: 'North', opened: 1704067200000, closed: 1704153600000, start: 1704067200000, end: 1704326400000 },
  { month: 'Feb', sales: 19, floor: 14, ceiling: 23, segment: 'South', opened: 1706745600000, closed: 1706832000000, start: 1706745600000, end: 1707091200000 },
  { month: 'Mar', sales: 8, floor: 5, ceiling: 11, segment: 'North', opened: 1709251200000, closed: 1709337600000, start: 1709251200000, end: 1709596800000 }
]
const columns = Object.keys(rows[0]!)

function documentWith(series: ChartSeriesModel[]): ChartDocumentModel {
  return { version: 1, title: '', legend: true, additionalLegends: [], titles: [], annotations: [], appearance: 'Default', palette: 'Nature', background: '#ffffff', autoLayout: true, series }
}

describe('Chart Designer model', () => {
  it('provides the 11 requested 2D series families', () => {
    expect(chartFamilies.map((family) => family.id)).toEqual(['bar', 'point-bubble', 'line', 'area', 'range', 'pie-doughnut', 'funnel', 'radar', 'polar', 'financial', 'gantt'])
    expect(chartFamilies.every((family) => family.series.length > 0)).toBe(true)
  })

  it('builds the requested element tree and supports undo and redo', () => {
    let history = createChartHistory()
    const series = createSeriesModel('Bar', columns, rows, 1)
    history = applyChartAction(history, { type: 'add-series', series })
    history = applyChartAction(history, { type: 'add-title' })
    expect(treeItems(history.present).map((item) => item.label)).toEqual(['Chart', 'Series (1)', 'Series 1', 'Legend', 'Additional Legends (0)', 'Titles (1)', 'Title 1', 'Annotations (0)'])
    const reverted = undoChart(history)
    expect(reverted.present.titles).toEqual([])
    expect(redoChart(reverted).present.titles).toEqual(['Title 1'])
    expect(undoChart(undoChart(history)).present.series).toEqual([])
  })

  it('keeps edited state separate until a document is saved', () => {
    const original = documentWith([])
    const draft = applyChartAction(createChartHistory(original), { type: 'add-series', series: createSeriesModel('Line', columns, rows, 1) })
    expect(original.series).toEqual([])
    expect(draft.present.series).toHaveLength(1)
  })

  it('caps the plotted rows and marks truncation without requesting more data', () => {
    const series = createSeriesModel('Bar', columns, rows, 1)
    const sample = Array.from({ length: MAX_CHART_POINTS + 1 }, (_, index) => ({ month: String(index), sales: index }))
    const result = buildChartOption(documentWith([series]), sample, sample.length)
    expect(result.rowsUsed).toBe(MAX_CHART_POINTS)
    expect(result.truncated).toBe(true)
    expect((result.option.series as Array<{ data: unknown[] }>)[0]!.data).toHaveLength(MAX_CHART_POINTS)
  })

  it.each(chartFamilies.map((family) => [family.name, family.series[0]!] as const))('%s produces an ECharts option from the grid rows', (_family, type) => {
    const series = createSeriesModel(type, columns, rows, 1)
    const result = buildChartOption(documentWith([series]), rows)
    expect(result.truncated).toBe(false)
    expect(result.rowsUsed).toBe(rows.length)
    const optionSeries = (result.option.series as Array<Record<string, unknown>>)[0]
    expect(optionSeries).toBeDefined()
    expect(optionSeries?.type).toBeDefined()
    expect(optionSeries?.data).toBeDefined()
  })

  it('maps stock, range, bubble, and Gantt channels into chart data', () => {
    const stock = createSeriesModel('Stock', columns, rows, 1)
    stock.mappings = { argument: 'month', open: 'sales', close: 'sales', low: 'floor', high: 'ceiling' }
    const stockOption = buildChartOption(documentWith([stock]), rows).option.series as Array<{ type: string; data: unknown[][] }>
    expect(stockOption[0]).toMatchObject({ type: 'candlestick' })
    expect(stockOption[0]!.data[0]).toEqual(['Jan', 12, 12, 8, 17])
    const range = createSeriesModel('Range Area', columns, rows, 1)
    expect((buildChartOption(documentWith([range]), rows).option.series as Array<{ type: string }>)[0]?.type).toBe('custom')
    const bubble = createSeriesModel('Bubble', columns, rows, 1)
    expect(bubble.mappings.size).toBe('floor')
    const gantt = createSeriesModel('Gantt', columns, rows, 1)
    const ganttOption = (buildChartOption(documentWith([gantt]), rows).option.series as Array<Record<string, unknown>>)[0]
    expect(ganttOption).toHaveProperty('renderItem')
    expect(ganttOption).toHaveProperty('encode', { x: [1, 2], y: 0 })
  })

  it('renders the modal shell, required tabs and empty state', () => {
    const markup = renderToStaticMarkup(<I18nContext.Provider value={{ locale: 'en', t: (key) => key }}><ChartDesignerModal sourceName="Query Result" columns={columns} rows={rows} totalRows={rows.length} resultWasTruncated={false} showEveryTime onSave={() => undefined} onCancel={() => undefined} onPreferenceChange={() => undefined} /></I18nContext.Provider>)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('There are no visible series in the chart...')
    expect(markup).toContain('Options')
    expect(markup).toContain('Properties')
    expect(markup).toContain('Data')
    expect(markup).toContain('Display the designer every time a new chart is added')
  })

  it('persists the designer preference through normalized app settings', () => {
    const settings = mergeSettings({ ...defaultSettings, chartDesigner: { showEveryTime: false } })
    expect(settings.chartDesigner.showEveryTime).toBe(false)
    expect(mergeSettings({ ...defaultSettings }).chartDesigner.showEveryTime).toBe(true)
  })
})
