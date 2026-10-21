import { describe, expect, it } from 'vitest'
import { buildPivot, buildPivotChart, exportPivot, validateReportQuery, type PivotConfig } from '../../src/modules/data-report-pivot/index.js'
import { createReportDesign, exportDesignedReport, parseReportDesign, placeReportField, reportPages } from '../../src/modules/data-report-pivot/report-design.js'

describe('Data Report Pivot', () => {
  const rows = [
    { region: 'North', year: '2024-01-01', product: 'A', sales: 10 },
    { region: 'North', year: '2024-02-01', product: 'B', sales: 20 },
    { region: 'South', year: '2024-01-01', product: 'A', sales: 7 },
    { region: 'South', year: '2024-04-01', product: 'B', sales: 13 }
  ]
  const config: PivotConfig = { rows: [{ field: 'region' }], columns: [{ field: 'product' }], values: [{ field: 'sales', aggregation: 'sum' }, { field: 'sales', label: 'Order count', aggregation: 'count' }], rowTotals: true, columnTotals: true, grandTotal: true, subtotals: true }

  it('groups row and column fields, aggregates values, and calculates totals', () => {
    const result = buildPivot(rows, config)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.find((row) => row.values[0] === 'North')?.total).toEqual({ 'sum(sales)': 30, 'Order count': 2 })
    expect(result.grandTotal).toEqual({ 'sum(sales)': 50, 'Order count': 4 })
    expect(Object.values(result.columnTotals)).toContain(17)
    expect(result.rows.some((row) => row.subtotal)).toBe(false)
  })

  it('supports grouping, filters, and chart data', () => {
    const grouped = buildPivot(rows, { rows: [{ field: 'year', grouping: 'quarter' }], columns: [], values: [{ field: 'sales', aggregation: 'average' }], filters: { region: ['North'] } })
    expect(grouped.rows.map((row) => row.values[0])).toEqual(['2024 Q1'])
    expect(grouped.grandTotal).toEqual({ 'average(sales)': 15 })
    const chart = buildPivotChart(grouped, { type: 'bar', title: 'Sales' })
    expect(chart).toMatchObject({ type: 'bar', title: 'Sales', labels: ['year: 2024 Q1'], series: [{ values: [15] }] })
  })

  it('moves report fields between bands, validates saved JSON, and paginates preview rows', () => {
    const design = createReportDesign('Quarterly', ['region', 'sales'])
    const updated = placeReportField(design, 'sales', 'Page Header')
    expect(updated.bands.Detail).toEqual(['region'])
    expect(updated.bands['Page Header']).toEqual(['sales'])
    expect(parseReportDesign(JSON.stringify(updated))).toEqual(updated)
    expect(() => parseReportDesign('{"version":2}')).toThrow('Unsupported report design')
    expect(reportPages(Array.from({ length: 45 }, (_, index) => index), 20)).toHaveLength(3)
    expect(exportDesignedReport(updated, ['region', 'sales'], [['<20>', 20]], 'html')).toContain('&lt;20&gt;')
    expect(exportDesignedReport(updated, ['region', 'sales'], [['North', 20]], 'csv')).toBe('"region"\r\n"North"')
  })

  it('exports escaped CSV, HTML, and a valid single-page PDF', () => {
    const pivot = buildPivot([{ name: 'A, "B"', value: 42 }], { rows: [{ field: 'name' }], columns: [], values: [{ field: 'value', aggregation: 'sum' }] })
    const csv = exportPivot(pivot, 'csv') as string
    expect(csv).toContain('"A, ""B"""')
    expect(exportPivot(pivot, 'html')).toContain('<table>')
    const pdf = exportPivot(pivot, 'pdf') as Buffer
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    expect(pdf.toString('latin1')).toContain('%%EOF')
  })

  it('rejects report SELECT forms that write server-side files or lock rows, including comments between keywords', () => {
    expect(() => validateReportQuery("SELECT * FROM items INTO OUTFILE '/tmp/export.csv'")).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery("SELECT * FROM items INTO/* hidden */DUMPFILE '/tmp/export.bin'")).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery('SELECT * FROM items FOR UPDATE')).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery('SELECT \'INTO OUTFILE\' AS message')).not.toThrow()
  })
})
