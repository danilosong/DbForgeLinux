import { randomUUID } from 'node:crypto'
import { dialog, ipcMain, BrowserWindow, writeFile } from './registry.js'
import type { IpcDeps } from './registry.js'
import { buildPivot, exportPivot, type PivotConfig, type PivotResult, type ReportExportFormat } from '../../modules/data-report-pivot/index.js'
import type { SqlValue } from '../db/DbDriver.js'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

const datasetLimit = 20_000
const datasets = new Map<string, { senderId: number; rows: Array<Record<string, unknown>>; columns: string[]; truncated: boolean; createdAt: number }>()

function pruneDatasets(): void {
  const now = Date.now()
  for (const [id, dataset] of datasets) if (now - dataset.createdAt > 15 * 60_000) datasets.delete(id)
  while (datasets.size > 10) datasets.delete(datasets.keys().next().value as string)
}

function validateSelect(query: string): void {
  const statements = splitSqlStatements(query).map((item) => item.sql.trim()).filter(Boolean)
  if (statements.length !== 1 || !/^SELECT\b/i.test(statements[0]!)) throw new Error('Report Pivot accepts one SELECT statement at a time.')
}

export function registerDataReportPivotIpc({ driver }: IpcDeps): void {
  ipcMain.handle('report-pivot:load', async (event, connectionId: string, query: string) => {
    if (!connectionId) throw new Error('Choose an active connection.')
    validateSelect(query)
    const rows: Array<Record<string, unknown>> = []
    let truncated = false
    for await (const row of driver.streamRows(connectionId, query, [] as SqlValue[])) {
      if (rows.length === datasetLimit) { truncated = true; break }
      rows.push(row)
    }
    const columns = rows.length ? Object.keys(rows[0]!) : []
    const datasetId = randomUUID()
    datasets.set(datasetId, { senderId: event.sender.id, rows, columns, truncated, createdAt: Date.now() })
    pruneDatasets()
    return { datasetId, columns, rowCount: rows.length, truncated, sample: rows.slice(0, 20) }
  })
  ipcMain.handle('report-pivot:build', (event, datasetId: string, config: PivotConfig) => {
    const dataset = datasets.get(datasetId)
    if (!dataset || dataset.senderId !== event.sender.id) throw new Error('Pivot data expired. Run the query again.')
    return buildPivot(dataset.rows, config, dataset.truncated)
  })
  ipcMain.handle('report-pivot:export', async (_event, pivot: PivotResult, format: ReportExportFormat) => {
    if (!['csv', 'html', 'pdf'].includes(format)) throw new Error('Unsupported report format.')
    const filters = [{ name: format.toUpperCase(), extensions: [format] }]
    const options = { title: 'Export Data Report', defaultPath: `data-report.${format}`, filters }
    const window = BrowserWindow.getFocusedWindow()
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, exportPivot(pivot, format), { mode: 0o600 })
    return result.filePath
  })
}
