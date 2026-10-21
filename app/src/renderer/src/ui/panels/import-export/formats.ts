import type { ExportFormat, ImportFormat } from '../../../../../modules/data-export-import/types.js'

export const exportFormats: Array<{ id: ExportFormat; title: string; description: string }> = [
  { id: 'csv', title: 'CSV', description: 'imex.format.csv' },
  { id: 'text', title: 'Text', description: 'imex.format.text' },
  { id: 'xlsx', title: 'Excel', description: 'imex.format.excel' },
  { id: 'pdf', title: 'PDF', description: 'imex.format.pdf' },
  { id: 'xml', title: 'XML', description: 'imex.format.xml' },
  { id: 'json', title: 'JSON', description: 'imex.format.json' },
  { id: 'sql', title: 'SQL', description: 'imex.format.sql' },
  { id: 'html', title: 'HTML', description: 'imex.format.html' }
]

export const unsupportedExportFormats = [
  { title: 'Google Sheets', reason: 'imex.reason.google' },
  { title: 'Access', reason: 'imex.reason.accessExport' },
  { title: 'ODBC', reason: 'imex.reason.odbc' },
  { title: 'DBF', reason: 'imex.reason.dbf' },
  { title: 'RTF', reason: 'imex.reason.rtf' }
]

export const importFormats: Array<{ id: ImportFormat; title: string; description: string }> = [
  { id: 'text', title: 'Text', description: 'imex.format.text' },
  { id: 'csv', title: 'CSV / TSV', description: 'imex.format.csv' },
  { id: 'xlsx', title: 'Excel', description: 'imex.format.excel' },
  { id: 'xml', title: 'XML', description: 'imex.format.xml' },
  { id: 'json', title: 'JSON', description: 'imex.format.json' },
  { id: 'sql', title: 'SQL', description: 'imex.format.sqlImport' }
]

export const unsupportedImportFormats = [
  { title: 'Google Sheets', reason: 'imex.reason.google' },
  { title: 'Access', reason: 'imex.reason.accessImport' },
  { title: 'ODBC', reason: 'imex.reason.odbc' },
  { title: 'DBF', reason: 'imex.reason.dbf' }
]
