import type { ImportFormat, ExportFormat, ImportMode, ImportReport, ExportReport, ImportPreview, JobProgress } from '../../modules/data-export-import/types.js'
export interface ImportExportOptions { delimiter?: string; quote?: string; header?: boolean; skipLines?: number; headerPosition?: number; autoDelimiter?: boolean; forceQuotes?: boolean; encoding?: 'utf8' | 'utf16le' | 'latin1'; onRowError?: 'continue' | 'abort' | 'prompt'; columnMapping?: Record<string, string>; rowElement?: string; createTable?: { database: string; name: string; columns: Array<{ name: string; type: string; primaryKey: boolean }> }; fileName?: string; appendTimestamp?: boolean; autoDeleteDays?: number; autoDeleteCount?: number; rowStart?: number; rowCount?: number; columnTypes?: Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>; outputMode?: 'single' | 'separate'; compress?: boolean; zipLevel?: number; zipComment?: string; zipPassword?: string }
export interface ImportExportOptions { nullString?: string; booleanTrueValue?: string; booleanFalseValue?: string }
export interface ImportExportTemplate { id: string; name: string; direction: 'import' | 'export'; format: ImportFormat | ExportFormat; query?: string; table?: string; mode?: ImportMode; keyColumns?: string[]; options?: ImportExportOptions }
export interface ImportExportApi {
  exportData(connectionId: string, query: string, format: ExportFormat, options?: ImportExportOptions, jobId?: string): Promise<{ path: string; report: ExportReport }>
  importData(connectionId: string, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: ImportExportOptions, jobId?: string): Promise<ImportReport>
  generateImportSql(table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: ImportExportOptions, jobId?: string): Promise<{ path: string; rows: number }>
  selectImportSource(jobId: string, format: ImportFormat, options?: ImportExportOptions): Promise<{ name: string; size: number; modified: number; preview: ImportPreview; detectedDelimiter?: string } | null>
  previewExport(connectionId: string, query: string, jobId: string): Promise<ImportPreview>
  cancelImportExport(jobId: string): Promise<void>
  onImportExportProgress(jobId: string, callback: (progress: JobProgress) => void): () => void
  listImportExportTemplates(): Promise<ImportExportTemplate[]>
  saveImportExportTemplate(template: Omit<ImportExportTemplate, 'id'> & { id?: string }): Promise<ImportExportTemplate>
  deleteImportExportTemplate(id: string): Promise<void>
  saveImportExportLog(content: string): Promise<string | null>
}
