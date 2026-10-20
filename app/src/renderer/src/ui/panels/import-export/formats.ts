import type { ExportFormat, ImportFormat } from '../../../../../modules/data-export-import/types.js'

export const exportFormats: Array<{ id: ExportFormat; title: string; description: string }> = [
  { id: 'csv', title: 'CSV', description: 'Delimited text for spreadsheets and other tools.' },
  { id: 'xlsx', title: 'Excel', description: 'Microsoft Excel workbook.' },
  { id: 'xml', title: 'XML', description: 'Structured row document.' },
  { id: 'json', title: 'JSON', description: 'Array of row objects.' },
  { id: 'sql', title: 'SQL', description: 'INSERT statements.' },
  { id: 'html', title: 'HTML', description: 'A formatted HTML table.' }
]

export const importFormats: Array<{ id: ImportFormat; title: string; description: string }> = [
  { id: 'csv', title: 'CSV / TSV', description: 'Delimited text file.' },
  { id: 'xlsx', title: 'Excel', description: 'Excel workbook.' },
  { id: 'xml', title: 'XML', description: 'Rows and columns in XML format.' },
  { id: 'json', title: 'JSON', description: 'Array of row objects.' },
  { id: 'sql', title: 'SQL', description: 'INSERT statements only.' }
]
