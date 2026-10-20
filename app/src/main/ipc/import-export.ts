import { ipcMain, dialog } from 'electron'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type { IpcDeps } from './registry.js'
import { exportData, importData, type ExportFormat, type ImportFormat, type ImportMode } from '../../modules/data-export-import/index.js'

export function registerImportExportIpc({ driver }: IpcDeps): void {
  ipcMain.handle('import-export:export', async (_event, connectionId: string, query: string, format: ExportFormat, options?: { delimiter?: string; quote?: string; header?: boolean }) => {
    if (!connectionId || !query.trim()) throw new Error('Informe a consulta de origem para exportar.')
    const statement = query.trim().replace(/;+\s*$/, '')
    if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) throw new Error('A exportação aceita apenas uma consulta SELECT.')
    const extensions: Record<ExportFormat, string> = { csv: 'csv', json: 'json', xml: 'xml', sql: 'sql', html: 'html', xlsx: 'xlsx' }
    const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Data Export Wizard', defaultPath: `export.${extensions[format]}`, filters: [{ name: format.toUpperCase(), extensions: [extensions[format]] }] })
    if (canceled || !filePath) throw new Error('Exportação cancelada.')
    const report = await exportData({ driver, connectionId, query, format, options, destination: createWriteStream(filePath) })
    return { path: filePath, report }
  })
  ipcMain.handle('import-export:import', async (_event, connectionId: string, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: { delimiter?: string; quote?: string; header?: boolean; onRowError?: 'continue' | 'abort' }) => {
    if (!connectionId || !table.trim()) throw new Error('Escolha a tabela de destino.')
    if (['update', 'delete', 'upsert'].includes(mode) && !keyColumns.length) throw new Error('Este modo exige ao menos uma coluna-chave.')
    const extensions: Record<ImportFormat, string[]> = { csv: ['csv', 'tsv', 'txt'], json: ['json'], xlsx: ['xlsx'], sql: ['sql'] }
    const selected = await dialog.showOpenDialog({ title: 'Data Import from', properties: ['openFile'], filters: [{ name: format.toUpperCase(), extensions: extensions[format] }] })
    if (selected.canceled || !selected.filePaths[0]) throw new Error('Importação cancelada.')
    const file = selected.filePaths[0]
    if (!(await stat(file)).size) throw new Error('O arquivo selecionado está vazio.')
    return importData({ driver, connectionId, table, format, source: createReadStream(file), options: { ...options, mode, keyColumns, transactional: true } })
  })
}
