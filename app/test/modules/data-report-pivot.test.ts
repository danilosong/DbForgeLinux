import { describe, expect, it } from 'vitest'
import { buildPivot, buildPivotChart, buildPivotConfigFromRoles, exportPivot, validateReportQuery, type PivotConfig } from '../../src/modules/data-report-pivot/index.js'
import { createReportDesign, exportDesignedReport, parseReportDesign, placeReportField, reportPages, reportPresentation } from '../../src/modules/data-report-pivot/report-design.js'
import { activeSessionForSavedProfile, masterDetailMatchesConnection, parseMasterDetailDocument, serializeMasterDetailDocument, validateWizardResult } from '../../src/modules/data-report-pivot/wizard.js'

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

  it('builds an expandable date hierarchy with grouped labels and a grand total', () => {
    const result = buildPivot([
      { ordered_at: '2025-01-03', total: 10 }, { ordered_at: '2025-01-09', total: 5 }, { ordered_at: '2025-04-02', total: 7 }
    ], { rows: [{ field: 'ordered_at', label: 'ordered_at year', grouping: 'year' }, { field: 'ordered_at', label: 'ordered_at month', grouping: 'month' }], columns: [], values: [{ field: 'total', aggregation: 'sum' }], grandTotal: true })
    expect(result.rowFields).toEqual(['ordered_at year', 'ordered_at month'])
    expect(result.rows.map((row) => row.values)).toEqual([[2025, '2025-01'], [2025, '2025-04']])
    expect(result.grandTotal).toEqual({ 'sum(total)': 22 })
  })

  it('supports grouping, filters, and chart data', () => {
    const grouped = buildPivot(rows, { rows: [{ field: 'year', grouping: 'quarter' }], columns: [], values: [{ field: 'sales', aggregation: 'average' }], filters: { region: ['North'] } })
    expect(grouped.rows.map((row) => row.values[0])).toEqual(['2024 Q1'])
    expect(grouped.grandTotal).toEqual({ 'average(sales)': 15 })
    const chart = buildPivotChart(grouped, { type: 'bar', title: 'Sales' })
    expect(chart).toMatchObject({ type: 'bar', title: 'Sales', labels: ['year: 2024 Q1'], series: [{ values: [15] }] })
  })

  it('rebuilds chart projections from changed field roles and supports each exportable chart type', () => {
    const fields = ['region', 'product', 'sales']
    const firstConfig = buildPivotConfigFromRoles(fields, { region: 'rows', sales: 'values' }, {}, { sales: 'sum' }, { grandTotal: true })
    const firstChart = buildPivotChart(buildPivot(rows, firstConfig), { type: 'bar' })
    expect(firstChart.labels).toEqual(['region: North', 'region: South'])

    const secondConfig = buildPivotConfigFromRoles(fields, { product: 'rows', sales: 'values' }, {}, { sales: 'sum' }, { grandTotal: true })
    const refreshed = buildPivot(rows, secondConfig)
    expect(refreshed).not.toBe(firstConfig)
    expect(buildPivotChart(refreshed, { type: 'line' }).labels).toEqual(['product: A', 'product: B'])
    for (const type of ['bar', 'line', 'pie', 'area', 'stacked'] as const) {
      expect(buildPivotChart(refreshed, { type }).type).toBe(type)
    }
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
    expect(exportDesignedReport(updated, ['region', 'sales'], [['North', 20]], 'csv')).toBe('region\r\nNorth')
  })

  it('persists the report query and group/sort settings in its own validated design file', () => {
    const design = { ...createReportDesign('Orders', ['id', 'ordered_at']), dataSourceQuery: 'SELECT id, ordered_at FROM orders', groupField: 'ordered_at', sortField: 'id', sortDirection: 'DESC' as const }
    expect(parseReportDesign(JSON.stringify(design))).toEqual(design)
    expect(() => parseReportDesign(JSON.stringify({ ...design, dataSourceQuery: 'x'.repeat(100_001) }))).toThrow('Invalid report data source query.')
    expect(() => parseReportDesign(JSON.stringify({ ...design, sortDirection: 'SIDEWAYS' }))).toThrow('Invalid report sort direction.')
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
  it('neutralizes formula-like data in report and pivot CSV exports', () => {
    const pivot = buildPivot([{ name: ' =1+1', value: 1 }], { rows: [{ field: 'name' }], columns: [], values: [{ field: 'value', aggregation: 'sum' }] })
    expect(exportPivot(pivot, 'csv')).toContain("' =1+1")
    const design = createReportDesign('Formula test', ['name'])
    expect(exportDesignedReport(design, ['name'], [['@SUM(A1)']], 'csv')).toContain("'@SUM(A1)")
  })

  it('rejects report SELECT forms that write server-side files or lock rows, including comments between keywords', () => {
    expect(() => validateReportQuery("SELECT * FROM items INTO OUTFILE '/tmp/export.csv'")).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery("SELECT * FROM items INTO/* hidden */DUMPFILE '/tmp/export.bin'")).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery('SELECT * FROM items FOR UPDATE')).toThrow(/read-only SELECT/)
    expect(() => validateReportQuery('SELECT \'INTO OUTFILE\' AS message')).not.toThrow()
  })

  it('validates the eight-step report setup and keeps its preferences in the designer model', () => {
    const wizard = validateWizardResult({ reportType: 'standard', connectionId: 'session-1', connectionRecordId: 'profile-1', database: 'sales', query: 'SELECT id, total FROM orders', columns: ['id', 'total', 'id'], grouping: ['total', 'missing'], layout: 'tabular', orientation: 'landscape', fitPage: true, style: 'Ocean', title: '   ' })
    expect(wizard).toMatchObject({ columns: ['id', 'total'], grouping: ['total'], title: 'TuxSQL Report', layout: 'tabular', orientation: 'landscape', style: 'Ocean' })
    expect(wizard.connectionRecordId).toBe('profile-1')
    expect(() => validateWizardResult({ ...wizard, query: 'SELECT 1; DELETE FROM orders' })).toThrow(/one SELECT/)
    expect(() => validateWizardResult({ ...wizard, query: "SELECT * FROM orders FOR UPDATE" })).toThrow(/read-only SELECT/)
    expect(validateWizardResult({ ...wizard, reportType: 'blank', connectionId: '', database: '', query: '', columns: [], grouping: [] })).toMatchObject({ reportType: 'blank', title: 'TuxSQL Report', query: '' })
    const design = parseReportDesign(JSON.stringify({ ...createReportDesign(wizard.title, wizard.columns), dataSourceQuery: wizard.query, groupField: wizard.grouping[0], groupFields: wizard.grouping, layout: wizard.layout, orientation: wizard.orientation, fitPage: wizard.fitPage, style: wizard.style }))
    expect(design).toMatchObject({ layout: 'tabular', orientation: 'landscape', fitPage: true, style: 'Ocean', groupField: 'total', groupFields: ['total'] })
  })

  it('uses only the already-active session for a saved profile and matches Master-Detail by durable profile identity', () => {
    const active = { id: 'session-1', recordId: 'profile-1', name: 'Primary', host: 'localhost', port: 3306, user: 'user', environment: 'development' as const }
    expect(activeSessionForSavedProfile('profile-1', active)).toBe('session-1')
    expect(activeSessionForSavedProfile('profile-2', active)).toBe('')
    const document = { version: 1 as const, connectionId: 'session-old', connectionRecordId: 'profile-1', database: 'sales', table: 'orders', fetchLimit: 100, where: '', orderBy: '', selectedColumns: [] }
    expect(masterDetailMatchesConnection(document, active)).toBe(true)
    expect(masterDetailMatchesConnection({ ...document, connectionRecordId: 'profile-2' }, active)).toBe(false)
    expect(masterDetailMatchesConnection({ ...document, connectionRecordId: undefined, connectionId: 'session-1' }, active)).toBe(true)
  })

  it('resolves all report layout, orientation, page-fit and style combinations for the designer preview', () => {
    const layouts = ['columnar', 'tabular', 'justified'] as const
    const orientations = ['portrait', 'landscape'] as const
    const styles = ['Aurora', 'Slate', 'Cedar', 'Ocean', 'Ember'] as const
    for (const layout of layouts) for (const orientation of orientations) for (const style of styles) {
      const presentation = reportPresentation({ ...createReportDesign('Visual matrix', ['name']), layout, orientation, style, fitPage: false })
      expect(presentation).toEqual({ layout, orientation, style, fitPage: false })
    }
    expect(reportPresentation(createReportDesign('Defaults', []))).toEqual({ layout: 'tabular', orientation: 'portrait', style: 'Aurora', fitPage: true })
  })

  it('round-trips bounded Master-Detail documents and rejects malformed settings', () => {
    const document = { version: 1 as const, connectionId: 'session-1', connectionRecordId: 'profile-1', database: 'sales', table: 'orders', fetchLimit: 250, where: 'status = 1', orderBy: 'id', selectedColumns: ['id', 'total'] }
    expect(parseMasterDetailDocument(serializeMasterDetailDocument(document))).toEqual(document)
    expect(() => parseMasterDetailDocument(JSON.stringify({ ...document, fetchLimit: 50_001 }))).toThrow(/Invalid Master-Detail/)
    expect(() => parseMasterDetailDocument('{')).toThrow(/Invalid Master-Detail/)
  })
})
