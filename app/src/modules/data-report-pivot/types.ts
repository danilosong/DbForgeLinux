export type PivotAggregation = 'sum' | 'count' | 'average' | 'min' | 'max' | 'stddev' | 'distinct-count'
export type PivotGrouping = 'year' | 'quarter' | 'month' | 'day' | 'first-letter' | 'number-bin'
export type PivotChartType = 'bar' | 'line' | 'pie' | 'area' | 'stacked'
export type ReportExportFormat = 'csv' | 'html' | 'pdf'

export interface PivotField { field: string; label?: string; grouping?: PivotGrouping; interval?: number }
export interface PivotValueField { field: string; label?: string; aggregation: PivotAggregation }
export interface PivotConfig {
  rows: PivotField[]
  columns: PivotField[]
  values: PivotValueField[]
  filters?: Record<string, unknown[]>
  rowTotals?: boolean
  columnTotals?: boolean
  grandTotal?: boolean
  subtotals?: boolean
}
export interface PivotColumn { key: string; label: string; values: unknown[]; valueField: string; valueLabel: string }
export interface PivotRow { key: string; values: unknown[]; label: string; cells: Record<string, unknown>; total?: Record<string, unknown>; subtotal?: boolean }
export interface PivotResult {
  rowFields: string[]
  columnFields: string[]
  valueFields: PivotValueField[]
  columns: PivotColumn[]
  rows: PivotRow[]
  rowTotals: Record<string, Record<string, unknown>>
  columnTotals: Record<string, unknown>
  grandTotal: Record<string, unknown>
  rowCount: number
  truncated: boolean
}
export interface PivotChartConfig { type: PivotChartType; valueField?: string; seriesField?: string; title?: string }
export interface PivotChartData { type: PivotChartType; title: string; labels: string[]; series: Array<{ name: string; values: number[] }> }
export interface ReportPivotApi {
  loadReportQuery(connectionId: string, query: string): Promise<{ datasetId: string; columns: string[]; rowCount: number; truncated: boolean; sample: Array<Record<string, unknown>> }>
  buildPivot(datasetId: string, config: PivotConfig): Promise<PivotResult>
  exportPivot(pivot: PivotResult, format: ReportExportFormat): Promise<string | null>
}
