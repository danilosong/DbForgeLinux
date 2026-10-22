import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron'
import { createReadStream, createWriteStream } from 'node:fs'
import { execFile } from 'node:child_process'
import { chmod, mkdir, readFile, stat, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { IpcDeps } from './registry.js'
import { exportData, importData, generateImportSql, previewExport, previewImport, type ExportFormat, type ImportFormat, type ImportMode, type JobProgress, type ImportPreview } from '../../modules/data-export-import/index.js'
import { once } from 'node:events'
import type { ImportExportOptions, ImportExportTemplate } from '../../shared/contracts/import-export.js'
import { encodeZipArchive } from '../../modules/archive/index.js'
import { deleteExportFilesAfterConfirmation, planExportRetention } from '../../modules/data-export-import/exportRetention.js'
import { buildCreateTableSql, type InferredColumn } from '../../modules/data-export-import/inference.js'
import { createTuxSqlBrowserWindow } from '../windowOptions.js'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'

const execFileAsync = promisify(execFile)

interface ActiveJob { controller: AbortController; senderId: number }
interface SelectedSource { file: string; senderId: number; accessTables?: string[]; accessTable?: string }
const activeJobs = new Map<string, ActiveJob>()
const selectedSources = new Map<string, SelectedSource>()
const allowedEncodings = ['utf8', 'utf16le', 'latin1'] as const

function progress(event: IpcMainInvokeEvent, jobId: string, value: JobProgress): void {
  if (!event.sender.isDestroyed()) event.sender.send('import-export:progress', jobId, value)
}

function startJob(event: IpcMainInvokeEvent, jobId: string): AbortController {
  if (!jobId || activeJobs.has(jobId)) throw new Error('Task identifier is invalid or already in use.')
  const controller = new AbortController()
  activeJobs.set(jobId, { controller, senderId: event.sender.id })
  return controller
}

function assertOptions(options?: ImportExportOptions): void {
  if (options?.accessTable !== undefined && (typeof options.accessTable !== 'string' || options.accessTable.length > 255)) throw new Error('Access table selection is invalid.')
  if (options?.compress !== undefined && typeof options.compress !== 'boolean') throw new Error('Compression option is invalid.')
  if (options?.encoding && !allowedEncodings.includes(options.encoding)) throw new Error('Encoding is not supported.')
  if (options?.columnMapping && Object.values(options.columnMapping).some((column) => typeof column !== 'string')) throw new Error('Column mapping is invalid.')
  if (options?.columnTypes && Object.values(options.columnTypes).some((type) => !['String', 'Integer', 'Float', 'DateTime', 'HexString'].includes(type))) throw new Error('Column type is invalid.')
  if (options?.onRowError && !['abort', 'continue', 'prompt'].includes(options.onRowError)) throw new Error('Error policy is invalid.')
  if (options?.zipLevel !== undefined && (!Number.isInteger(options.zipLevel) || options.zipLevel < 0 || options.zipLevel > 9)) throw new Error('ZIP compression level is invalid.')
  if (options?.zipPassword !== undefined && (typeof options.zipPassword !== 'string' || options.zipPassword.length > 256)) throw new Error('ZIP password is invalid.')
  if (options?.zipComment !== undefined && (typeof options.zipComment !== 'string' || options.zipComment.length > 500)) throw new Error('ZIP comment is invalid.')
  if (options?.autoDeleteDays !== undefined && (!Number.isInteger(options.autoDeleteDays) || options.autoDeleteDays < 1 || options.autoDeleteDays > 36_500)) throw new Error('Retention period is invalid.')
  if (options?.autoDeleteCount !== undefined && (!Number.isInteger(options.autoDeleteCount) || options.autoDeleteCount < 1 || options.autoDeleteCount > 100_000)) throw new Error('Retention count is invalid.')
  if (options?.skipLines !== undefined && (!Number.isInteger(options.skipLines) || options.skipLines < 0 || options.skipLines > 100_000)) throw new Error('Skipped-line count is invalid.')
  if (options?.headerPosition !== undefined && (!Number.isInteger(options.headerPosition) || options.headerPosition < 1 || options.headerPosition > 100_000)) throw new Error('Header position is invalid.')
  for (const value of [options?.nullString, options?.booleanTrueValue, options?.booleanFalseValue]) if (value !== undefined && (typeof value !== 'string' || value.length > 256)) throw new Error('Import value is invalid.')
  if (options?.confirmedDatabase !== undefined && (typeof options.confirmedDatabase !== 'string' || options.confirmedDatabase.length > 255)) throw new Error('Production confirmation is invalid.')
  if (options?.createTable) {
    const schema = options.createTable
    if (typeof schema.database !== 'string' || typeof schema.name !== 'string' || !Array.isArray(schema.columns) || schema.columns.length > 1000) throw new Error('Table definition is invalid.')
    buildCreateTableSql(schema.database, schema.name, schema.columns as InferredColumn[])
  }
}

async function accessTables(file: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('mdb-tables', ['-1', '--', file], { timeout: 10_000, maxBuffer: 1024 * 1024, encoding: 'utf8', shell: false })
    const tables = stdout.split(/\r?\n/).map((table) => table.trim()).filter(Boolean)
    if (!tables.length || tables.length > 500) throw new Error('The Access file has no tables or exceeds the 500-table safety limit.')
    return tables
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Access import requires mdbtools. Install it with: sudo apt install mdbtools', { cause: error })
    throw error
  }
}

async function exportAccessTable(file: string, table: string): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync('mdb-export', ['--', file, table], { timeout: 60_000, maxBuffer: 100 * 1024 * 1024, encoding: 'buffer', shell: false })
    const data = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)
    if (data.byteLength > 100 * 1024 * 1024) throw new Error('Access table export exceeds the 100 MB safety limit.')
    return data
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Access import requires mdbtools. Install it with: sudo apt install mdbtools', { cause: error })
    throw error
  }
}

async function detectDelimiter(file: string, quote = '"'): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of createReadStream(file, { start: 0, end: 32_767 })) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); if (Buffer.concat(chunks).length >= 32_768) break }
  const sample = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).slice(0, 20)
  const candidates = [',', '\t', ';', '|']
  const score = (delimiter: string): number => {
    const counts = sample.map((line) => { let quoted = false; let count = 0; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === quote) { if (quoted && line[index + 1] === quote) index++; else quoted = !quoted } else if (!quoted && char === delimiter) count++ } return count })
    const nonzero = counts.filter((count) => count > 0)
    if (!nonzero.length) return 0
    const average = nonzero.reduce((sum, count) => sum + count, 0) / nonzero.length
    const consistency = nonzero.length / Math.max(1, counts.length)
    return average * consistency
  }
  return candidates.sort((left, right) => score(right) - score(left))[0] ?? ','
}

async function askOnImportRowError(event: IpcMainInvokeEvent, row: number, message: string): Promise<'continue' | 'abort'> {
  const parent = BrowserWindow.fromWebContents(event.sender)
  const options: MessageBoxOptions = {
    type: 'warning' as const, title: 'Import row failed', message: `Row ${row} could not be imported.`, detail: message.slice(0, 1000),
    buttons: ['Continue with next row', 'Abort import'], defaultId: 1, cancelId: 1, noLink: true
  }
  const result = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)
  return result.response === 0 ? 'continue' : 'abort'
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
  if (!value.name.trim() || value.name.length > 120 || !['import', 'export'].includes(value.direction)) throw new Error('Template name or direction is invalid.')
  const options: ImportExportOptions = {}
  for (const key of ['delimiter', 'quote', 'header', 'skipLines', 'headerPosition', 'nullString', 'booleanTrueValue', 'booleanFalseValue', 'forceQuotes', 'encoding', 'onRowError', 'rowElement', 'fileName', 'appendTimestamp', 'autoDeleteDays', 'autoDeleteCount', 'rowStart', 'rowCount', 'columnTypes', 'outputMode', 'compress', 'zipLevel', 'zipComment'] as const) {
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
  ipcMain.handle('import-export:legacy-capabilities', async () => {
    try { await execFileAsync('mdb-tables', [], { timeout: 3000, maxBuffer: 1024, encoding: 'utf8', shell: false }); return { accessRead: true } }
    catch (error) { return { accessRead: (error as NodeJS.ErrnoException).code !== 'ENOENT' } }
  })
  ipcMain.handle('import-export:export', async (event, connectionId: string, query: string, format: ExportFormat, options?: ImportExportOptions, jobId = randomUUID()) => {
    if (!connectionId || !query.trim()) throw new Error('Enter a source query to export.')
    assertOptions(options)
    const statement = query.trim().replace(/;+\s*$/, '')
    if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) throw new Error('Exports accept one SELECT query only.')
    const extensions: Record<ExportFormat, string> = { csv: 'csv', text: 'txt', json: 'json', xml: 'xml', sql: 'sql', html: 'html', xlsx: 'xlsx', pdf: 'pdf', dbf: 'dbf' }
    const baseName = (options?.fileName || 'export').replace(/[\\/\\0]/g, '_').slice(0, 120)
    const stamp = options?.appendTimestamp ? `_${new Date().toISOString().replace(/[:.]/g, '-')}` : ''
    const outputExtension = options?.compress ? 'zip' : extensions[format]
    const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Data Export Wizard', defaultPath: `${baseName}${stamp}.${outputExtension}`, filters: [{ name: options?.compress ? 'ZIP archive' : format.toUpperCase(), extensions: [outputExtension] }] })
    if (canceled || !filePath) throw new Error('Export was cancelled.')
    const controller = startJob(event, jobId)
    let temporaryOutput: string | undefined
    let temporaryHtml: string | undefined
    try {
      temporaryOutput = options?.compress ? join(app.getPath('temp'), `tuxsql-export-${randomUUID()}.${extensions[format]}`) : filePath
      temporaryHtml = format === 'pdf' ? join(app.getPath('temp'), `tuxsql-export-${randomUUID()}.html`) : undefined
      const exportFormat = format === 'pdf' ? 'html' : format
      const exportOptions = options && { ...options, createTable: undefined }
      const report = await exportData({ driver, connectionId, query: statement, format: exportFormat, options: exportOptions, signal: controller.signal, onProgress: (value) => progress(event, jobId, value), destination: createWriteStream(temporaryHtml ?? temporaryOutput, { mode: 0o600 }) })
      if (format === 'pdf' && temporaryHtml) {
        const printer = createTuxSqlBrowserWindow({ show: false })
        try { await printer.loadURL(pathToFileURL(temporaryHtml).toString()); const pdf = await printer.webContents.printToPDF({ printBackground: true, pageSize: 'A4' }); await writeFile(temporaryOutput, pdf, { mode: 0o600 }) }
        finally { printer.destroy() }
      }
      if (options?.compress) {
        const contents = await readFile(temporaryOutput)
        const entry = await encodeZipArchive(contents, `${baseName}.${extensions[format]}`, { compressionLevel: options.zipLevel ?? 6, comment: (options.zipComment ?? '').slice(0, 500), password: options.zipPassword || undefined })
        await writeFile(filePath, entry, { mode: 0o600 })
      }
      if (options?.autoDeleteDays || options?.autoDeleteCount) {
        const plan = await planExportRetention(filePath, { baseName, extension: outputExtension, maxAgeDays: options.autoDeleteDays, keepCount: options.autoDeleteCount })
        await deleteExportFilesAfterConfirmation(plan, async (retentionPlan) => {
          const names = retentionPlan.files.map((item) => item.slice(retentionPlan.directory.length + 1))
          const detail = [...names.slice(0, 8), ...(names.length > 8 ? [`… and ${names.length - 8} more`] : [])].join('\n')
          const confirmation: MessageBoxOptions = {
            type: 'warning', title: 'Delete old exports?', message: `Delete ${retentionPlan.files.length} old export file${retentionPlan.files.length === 1 ? '' : 's'} from the selected output folder?`,
            detail: `${retentionPlan.directory}\n\n${detail}`, buttons: ['Delete old files', 'Keep all files'], defaultId: 1, cancelId: 1, noLink: true
          }
          const parent = BrowserWindow.fromWebContents(event.sender)
          const answer = parent ? await dialog.showMessageBox(parent, confirmation) : await dialog.showMessageBox(confirmation)
          return answer.response === 0
        })
      }
      await chmod(filePath, 0o600)
      return { path: filePath, report }
    } finally {
      if (temporaryOutput && temporaryOutput !== filePath) await unlink(temporaryOutput).catch(() => undefined)
      if (temporaryHtml) await unlink(temporaryHtml).catch(() => undefined)
      activeJobs.delete(jobId)
    }
  })

  ipcMain.handle('import-export:select-source', async (event, jobId: string, format: ImportFormat, options?: ImportExportOptions) => {
    if (!jobId) throw new Error('Task identifier is missing.')
    assertOptions(options)
    const extensions: Record<ImportFormat, string[]> = { csv: ['csv', 'tsv'], text: ['txt', 'tsv'], json: ['json'], xml: ['xml'], xlsx: ['xlsx'], sql: ['sql'], dbf: ['dbf'], access: ['mdb', 'accdb'] }
    const selected = await dialog.showOpenDialog({ title: 'Data Import from', properties: ['openFile'], filters: [{ name: format.toUpperCase(), extensions: extensions[format] }] })
    if (selected.canceled || !selected.filePaths[0]) return null
    const file = selected.filePaths[0]
    const details = await stat(file)
    if (!details.size) throw new Error('The selected file is empty.')
    if (details.size > 100 * 1024 * 1024) throw new Error('The import file exceeds the 100 MB limit.')
    const tables = format === 'access' ? await accessTables(file) : undefined
    const selectedAccessTable = tables?.[0]
    selectedSources.set(jobId, { file, senderId: event.sender.id, accessTables: tables, accessTable: selectedAccessTable })
    const detectedDelimiter = options?.autoDelimiter && (format === 'csv' || format === 'text') ? await detectDelimiter(file, options.quote) : undefined
    const effectiveOptions = { ...options, ...(detectedDelimiter ? { delimiter: detectedDelimiter } : {}), previewRows: 20 }
    const source = format === 'access' ? Readable.from([await exportAccessTable(file, selectedAccessTable!)]) : createReadStream(file)
    const preview = await previewImport({ driver, connectionId: '', table: '', format: format === 'access' ? 'csv' : format, source, options: effectiveOptions, onProgress: (value) => progress(event, jobId, value) }, 20)
    return { name: file.split(/[\\/]/).pop() ?? file, size: details.size, modified: details.mtimeMs, preview, ...(detectedDelimiter ? { detectedDelimiter } : {}), ...(tables ? { accessTables: tables, selectedAccessTable } : {}) }
  })

  ipcMain.handle('import-export:preview-access-table', async (event, jobId: string, table: string) => {
    const selected = selectedSources.get(jobId)
    if (!selected || selected.senderId !== event.sender.id || !selected.accessTables?.includes(table)) throw new Error('Select a table from the chosen Access file.')
    selected.accessTable = table
    const preview = await previewImport({ driver, connectionId: '', table: '', format: 'csv', source: Readable.from([await exportAccessTable(selected.file, table)]) }, 20)
    return preview
  })

  ipcMain.handle('import-export:preview-export', async (event, connectionId: string, query: string, jobId: string): Promise<ImportPreview> => {
    if (!connectionId || !query.trim()) throw new Error('Enter a source query to preview.')
    const statement = query.trim().replace(/;+\s*$/, '')
    if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) throw new Error('Preview accepts one SELECT query only.')
    const controller = startJob(event, jobId)
    try {
      const rows = await previewExport({ driver, connectionId, query: `SELECT * FROM (${statement}) AS tuxsql_preview LIMIT 20`, signal: controller.signal, onProgress: (value) => progress(event, jobId, value) }, 20)
      return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows }
    } finally { activeJobs.delete(jobId) }
  })

  ipcMain.handle('import-export:import', async (event, connectionId: string, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: ImportExportOptions, jobId?: string) => {
    if (!connectionId || !table.trim()) throw new Error('Choose a destination table.')
    if (['update', 'delete', 'upsert'].includes(mode) && !keyColumns.length) throw new Error('This mode requires at least one key column.')
    if (!jobId) throw new Error('Select the source file before importing.')
    assertOptions(options)
    if (mode === 'delete' || mode === 'repopulate') {
      const targetDatabase = table.includes('.') ? table.slice(0, table.indexOf('.')).replaceAll('`', '') : ''
      if (driver.connectionEnvironment(connectionId) === 'prod' && (!targetDatabase || options?.confirmedDatabase !== targetDatabase)) {
        throw new Error(`Production import requires typing the target database name: ${targetDatabase ?? 'unavailable'}.`)
      }
    }
    const selected = selectedSources.get(jobId)
    if (!selected || selected.senderId !== event.sender.id) throw new Error('The selected source file expired. Select it again.')
    const controller = startJob(event, jobId)
    selectedSources.delete(jobId)
    try {
      const source = format === 'access' ? Readable.from([await exportAccessTable(selected.file, selected.accessTable ?? '')]) : createReadStream(selected.file)
      return await importData({ driver, connectionId, table, format: format === 'access' ? 'csv' : format, source, signal: controller.signal, onProgress: (value) => progress(event, jobId, value), options: { ...options, mode, keyColumns, onRowErrorPrompt: options?.onRowError === 'prompt' ? (row, message) => askOnImportRowError(event, row, message) : undefined, transactional: true } })
    } finally { activeJobs.delete(jobId) }
  })

  ipcMain.handle('import-export:script', async (event, table: string, format: ImportFormat, mode: ImportMode, keyColumns: string[], options?: ImportExportOptions, jobId?: string) => {
    if (!table.trim() || !jobId) throw new Error('Select a destination table and source file before generating SQL.')
    if (['update', 'delete', 'upsert'].includes(mode) && !keyColumns.length) throw new Error('This import mode requires key columns.')
    assertOptions(options)
    const selected = selectedSources.get(jobId)
    if (!selected || selected.senderId !== event.sender.id) throw new Error('Selected source expired. Choose the file again.')
    const dialogResult = await dialog.showSaveDialog({ title: 'Save generated import script', defaultPath: 'data-import.sql', filters: [{ name: 'SQL script', extensions: ['sql'] }] })
    if (dialogResult.canceled || !dialogResult.filePath) throw new Error('SQL script generation was cancelled.')
    const controller = startJob(event, jobId); selectedSources.delete(jobId)
    const destination = createWriteStream(dialogResult.filePath, { mode: 0o600 })
    let rows = 0
    try {
      if (options?.createTable) destination.write(buildCreateTableSql(options.createTable.database, options.createTable.name, options.createTable.columns as InferredColumn[]))
      const source = format === 'access' ? Readable.from([await exportAccessTable(selected.file, selected.accessTable ?? '')]) : createReadStream(selected.file)
      for await (const line of generateImportSql({ driver, connectionId: '', table, format: format === 'access' ? 'csv' : format, source, signal: controller.signal, options: { ...options, mode, keyColumns, onRowErrorPrompt: options?.onRowError === 'prompt' ? (row, message) => askOnImportRowError(event, row, message) : undefined }, onProgress: (value) => { rows = value.rows; progress(event, jobId, value) } })) {
        if (!destination.write(line)) await once(destination, 'drain')
      }
      destination.end(); await once(destination, 'finish'); await chmod(dialogResult.filePath, 0o600)
      return { path: dialogResult.filePath, rows }
    } catch (error) { destination.destroy(error instanceof Error ? error : undefined); throw error }
    finally { activeJobs.delete(jobId) }
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
  ipcMain.handle('import-export:save-log', async (_event, content: string) => {
    const selected = await dialog.showSaveDialog({ title: 'Save import/export error log', defaultPath: 'DataImport.log', filters: [{ name: 'Log file', extensions: ['log', 'txt'] }] })
    if (selected.canceled || !selected.filePath) return null
    await writeFile(selected.filePath, content.slice(0, 2 * 1024 * 1024), { mode: 0o600 })
    return selected.filePath
  })
}
