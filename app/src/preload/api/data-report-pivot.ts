import { ipcRenderer } from 'electron'
import type { ReportPivotApi } from '../../shared/contracts/data-report-pivot.js'

export const dataReportPivotApi: ReportPivotApi = {
  loadReportQuery: (connectionId, query) => ipcRenderer.invoke('report-pivot:load', connectionId, query),
  buildPivot: (datasetId, config) => ipcRenderer.invoke('report-pivot:build', datasetId, config),
  exportPivot: (pivot, format) => ipcRenderer.invoke('report-pivot:export', pivot, format)
}
