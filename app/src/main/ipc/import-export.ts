import { app, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IpcDeps } from './registry.js'
import { exportData, importData, previewExport, previewImport, type ExportFormat, type ImportFormat, type ImportMode, type JobProgress, type ImportPreview } from '../../modules/data-export-import/index.js'
import type { ImportExportOptions, ImportExportTemplate } from '../../shared/contracts/import-export.js'

interface ActiveJob { controller: AbortController; senderId: number }
interface SelectedSource { file: string; senderId: number }
const activeJobs = new Map<string, ActiveJob>()
const selectedSources = new Map<string, SelectedSource>()
const allowedEncodings = ['utf8', 'utf16le', 'latin1'] as const

function progress(event: IpcMainInvokeEvent, jobId: string, value: JobProgress): void {
  if (!event.sender.isDestroyed()) event.sender.send('import-export:progress', jobId, value)
}

function startJob(event: IpcMainInvokeEvent, jobId: string): AbortController {
  if (!jobId || activeJobs.has(jobId)) throw new Error('Identificador de tarefa inválido ou em uso.')
  const controller = new AbortController()
  activeJobs.set(jobId, { controller, senderId: event.sender.id })
  return controller
}

function assertOptions(options?: ImportExportOptions): void {
  if (options?.encoding && !allowedEncodings.includes(options.encoding)) throw new Error('Encoding não suportado.')
  if (options?.columnMapping && Object.values(options.columnMapping).some((column) => typeof column !== 'string')) throw new Error('Mapeamento de colunas inválido.')
}

function templatePath(): string { return join(app.getPath('userData'), 'data-tasks', 'templates.json') }
async function readTemplates(): Promise<ImportExportTemplate[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(templatePath(), 'utf8'))
    return Array.isArray(parsed) ? parsed.filter(isTemplate).map((item) => safeTemplate(item)) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
function isTemplate(value: unknown): value is ImportExportTemplate {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ImportExportTemplate>
  return typeof item.id === 'string' && typeof item.name === 'string' && (item.direction === 'import' || item.direction === 'export') && typeof item.format === 'string'
}
function safeTemplate(value: Omit<ImportExportTemplate, 'id'> & { id?: string }): ImportExportTemplate {
  if (!value.name.trim() || value.name.length > 120 || !['import', 'export'].includes(value.direction)) throw new Error('Nome ou direção de template inválido.')
  const options: ImportExportOptions = {}
  for (const key of ['delimiter', 'quote', 'header', 'encoding', 'onRowError', 'rowElement'] as const) {
    const optionValue = value.options?.[key]
    if (optionValue !== undefined) Object.assign(options, { [key]: optionValue })
  }
  if (value.options?.columnMapping) options.columnMapping = { ...value.options.columnMapping }
  return {
    id: value.id ?? randomUUID(), name: value.name.trim(), direction: value.direction, format: value.format,
    ...(value.query ? { query: value.query } : {}), ...(value.table ? { table: value.table } : {}),
    ...(value.mode ? { mode: value.mode } : {}), ...(value.keyColumns ? { keyColumns: value.keyColumns.filter((key) => typeof key === 'string') } : {}), options
  }
}

export function registerImportExportIpc({ driver }: IpcDeps): void {
  ipcMain.handle('import-export:export', async (event, connectionId: string, query: string, format: ExportFormat, options?: ImportExportOptions, jobId = randomUUID()) => {
    if (!connectionId || !query.trim()) throw new Error('Informe a consulta de origem para exportar.')
    assertOptions(options)
    const statement = query.trim().replace(/;+\s*$/, '')
    if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) throw new Error('A exportação aceita apenas uma consulta SELECT.')
    const extensions: Record<ExportFormat, string> = { csv: 'csv', json: 'json', xml: 'xml', sql: 'sql', html: 'html', xlsx: 'xlsx' }
    const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Data Export Wizard', defaultPath: `export.${extensions[format]}`, filters: [{ name: format.toUpperCase(), extensions: [extensions[format]] }] })
    if (canceled || !filePath) throw new Error('Exportação cancelada.')
    const controller = startJob(event, jobId)
    try {
      const report = await exportData({ driver, connectionId, query: statement, format, options, signal: controller.signal, onProgress: (value) => progress(event, jobId, value), destination: createWriteStream(filePath, { mode: 0o600 }) })
      await chmod(filePath, 0o600)
      return { path: filePath, report }
    } finally { activeJobs.delete(jobId) }
  })

  ipcMain.handle('import-export:select-source', async (event, jobId: string, format: ImportFormat, options?: ImportExportOptions) => {
    if (!jobId) throw new Error('Identificador da tarefa ausente.')
    assertOptions(options)
    const extensions: Record<ImportFormat, string[]> = { csv: ['csv', 'tsv', 'txt'], json: ['json'], xml: ['xml'], xlsx: ['xlsx'], sql: ['sql'] }
    const selected = await dialog.showOpenDialog({ title: 'Data Import from', properties: ['openFile'], filters: [{ name: format.toUpperCase(), extensions: extensions[format] }] })
    if (selected.canceled || !selected.filePaths[0]) return null
    const file = selected.filePaths[0]
    const details = await stat(file)
    if (!details.size) throw new Error('O arquivo selecionado está vazio.')
    if (details.size > 100 * 1024 * 1024) throw new Error('O arquivo de importação excede o limite de 100 MB.')
    selectedSources.set(jobId, { file, senderId: event.sender.id })
    const preview = await previewImport({ driver, connectionId: '', table: '', format, source: createReadStream(file), options: { ...options, previewRows: 20 }, onProgress: (value) => progress(event, jobId, value) }, 20)
    return { name: file.split(/[\\/]/).pop() ?? file, size: details.size, modified: details.mtimeMs, preview }
  })

  ipcMain.handle('import-export:preview-export', async (event, connectionId: string, query: string, jobId: string): Promise<ImportPreview> => {
    if (!connectionId || !query.trim()) throw new Error('Informe a consulta de origem para visualizar.')
    const statement = query.trim().replace(/;+\s*$/, '')
    if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) throw new Error('O preview aceita apenas uma consulta SELECT.')
    const controller = startJob(event, jobId)
    try {
      const rows = await previewExport({ driver, connectionId, query: `SELECT * FROM (${statement}) AS dbforge_preview LIMIT 20`, signal: controller.signal, onProgress: (value) => progress(event, jobId, value) }, 20)
      return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows }
    } finally { activeJobs.delete(jobId) }
  })

  ipcMain.handle('import-export:import', async (event, connectionId: string, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: ImportExportOptions, jobId?: string) => {
    if (!connectionId || !table.trim()) throw new Error('Escolha a tabela de destino.')
    if (['update', 'delete', 'upsert'].includes(mode) && !keyColumns.length) throw new Error('Este modo exige ao menos uma coluna-chave.')
    if (!jobId) throw new Error('Selecione o arquivo de origem antes de importar.')
    assertOptions(options)
    const selected = selectedSources.get(jobId)
    if (!selected || selected.senderId !== event.sender.id) throw new Error('Arquivo selecionado expirou. Selecione-o novamente.')
    const controller = startJob(event, jobId)
    selectedSources.delete(jobId)
    try {
      return await importData({ driver, connectionId, table, format, source: createReadStream(selected.file), signal: controller.signal, onProgress: (value) => progress(event, jobId, value), options: { ...options, mode, keyColumns, transactional: true } })
    } finally { activeJobs.delete(jobId) }
  })

  ipcMain.handle('import-export:cancel', async (event, jobId: string) => {
    const job = activeJobs.get(jobId)
    if (job && job.senderId === event.sender.id) job.controller.abort()
  })

  ipcMain.handle('import-export:templates:list', () => readTemplates())
  ipcMain.handle('import-export:templates:save', async (_event, input: Omit<ImportExportTemplate, 'id'> & { id?: string }) => {
    const template = safeTemplate(input)
    const templates = await readTemplates()
    const index = templates.findIndex((item) => item.id === template.id)
    if (index >= 0) templates[index] = template
    else templates.push(template)
    await mkdir(join(app.getPath('userData'), 'data-tasks'), { recursive: true })
    await writeFile(templatePath(), `${JSON.stringify(templates, null, 2)}\n`, { mode: 0o600 })
    return template
  })
  ipcMain.handle('import-export:templates:delete', async (_event, id: string) => {
    const templates = (await readTemplates()).filter((item) => item.id !== id)
    await mkdir(join(app.getPath('userData'), 'data-tasks'), { recursive: true })
    await writeFile(templatePath(), `${JSON.stringify(templates, null, 2)}\n`, { mode: 0o600 })
  })
}
