import type { ImportFormat, ExportFormat, ImportMode, ImportReport, ExportReport } from '../../modules/data-export-import/types.js'
export interface ImportExportApi {
  exportData(connectionId: string, query: string, format: ExportFormat, options?: { delimiter?: string; quote?: string; header?: boolean }): Promise<{ path: string; report: ExportReport }>
  importData(connectionId: string, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: { delimiter?: string; quote?: string; header?: boolean; onRowError?: 'continue' | 'abort' }): Promise<ImportReport>
}
