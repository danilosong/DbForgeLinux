import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionRecord, DatabaseObject } from '../../../../../shared/contracts.js'
import type { ExportFormat, ImportFormat, ImportMode } from '../../../../../modules/data-export-import/types.js'
import type { ImportExportTemplate } from '../../../../../shared/contracts/import-export.js'
import { usePanelConnection, usePanelNavigation } from '../registry'
import { exportFormats, importFormats, unsupportedExportFormats, unsupportedImportFormats } from './formats.js'
import { getSelectedGridRows, subscribeSelectedGridRows } from '../../components/gridSelection.js'
import { buildCreateTableSql, inferImportColumns, type InferredColumn } from '../../../../../modules/data-export-import/inference.js'
import AssistantFinish from '../../components/AssistantFinish.js'

type Direction = 'export' | 'import'
function sqlIdentifier(value: string): string { return `\`${value.replaceAll('`', '``')}\`` }
function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('A selected row contains a non-finite number.'); return String(value) }
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (value instanceof Uint8Array) return `X'${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}'`
  const text = value instanceof Date ? value.toISOString().slice(0, 19).replace('T', ' ') : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "''").replaceAll('\0', '\\0')}'`
}
function selectedRowsQuery(rows: Array<Record<string, unknown>>): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 256)
  if (!rows.length || !columns.length) throw new Error('Select rows in a result grid first.')
  return `SELECT ${columns.map((column) => `${sqlValue(rows[0]?.[column])} AS ${sqlIdentifier(column)}`).join(', ')}${rows.slice(1, 500).map((row) => ` UNION ALL SELECT ${columns.map((column) => sqlValue(row[column])).join(', ')}`).join('')}`
}
const exportSteps = ['imex.export.format', 'imex.export.source', 'imex.export.outputSettings', 'imex.export.options', 'imex.export.dataFormats', 'imex.export.rows', 'imex.export.errors', 'imex.export.run', 'imex.export.finish']
const importSteps = ['imex.import.source', 'imex.import.destination', 'imex.import.options', 'imex.import.dataFormats', 'imex.import.mapping', 'imex.import.modes', 'imex.import.output', 'imex.import.errors', 'imex.import.run', 'imex.import.finish']

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const { selectedObject, selectedIntent } = usePanelNavigation()
  const selectedExplorerTable = selectedObject?.object.name
  const selectedExplorerDatabase = selectedObject?.database
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [connection, setConnection] = useState('')
  const [direction, setDirection] = useState<Direction>('export'); const [exportFormat, setExportFormat] = useState<ExportFormat>('csv'); const [importFormat, setImportFormat] = useState<ImportFormat>(() => { const saved = localStorage.getItem('tuxsql.import.lastFormat'); return importFormats.some((item) => item.id === saved) ? saved as ImportFormat : 'csv' })
  const [query, setQuery] = useState('SELECT * FROM `table_name` LIMIT 1000'); const [table, setTable] = useState('')
  const [mode, setMode] = useState<ImportMode>('append'); const [keys, setKeys] = useState('id'); const [delimiter, setDelimiter] = useState(','); const [quote, setQuote] = useState('"'); const [header, setHeader] = useState(true); const [encoding, setEncoding] = useState<'utf8' | 'utf16le' | 'latin1'>('utf8')
  const [rowElement, setRowElement] = useState('row'); const [mapping, setMapping] = useState<Record<string, string>>({}); const [sourceFile, setSourceFile] = useState<{ name: string; size: number; modified: number } | null>(null); const [sample, setSample] = useState<string[][]>([])
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new'); const [importColumns, setImportColumns] = useState<InferredColumn[]>([]); const [skipLines, setSkipLines] = useState(0); const [headerPosition, setHeaderPosition] = useState(1); const [autoDelimiter, setAutoDelimiter] = useState(true); const [importOutput, setImportOutput] = useState<'editor' | 'file' | 'direct'>('editor')
  const [nullString, setNullString] = useState(''); const [booleanTrueValue, setBooleanTrueValue] = useState('true'); const [booleanFalseValue, setBooleanFalseValue] = useState('false')
  const [forceQuotes, setForceQuotes] = useState(false); const [outputMode, setOutputMode] = useState<'single' | 'separate'>('single'); const [fileName, setFileName] = useState('export'); const [timestamp, setTimestamp] = useState(true); const [autoDelete, setAutoDelete] = useState(false); const [deleteDays, setDeleteDays] = useState(30); const [deleteCount, setDeleteCount] = useState(20); const [rowMode, setRowMode] = useState<'all' | 'selected' | 'range'>('all'); const [rowStart, setRowStart] = useState(1); const [rowCount, setRowCount] = useState(0); const [zipEnabled, setZipEnabled] = useState(false); const [zipLevel, setZipLevel] = useState(6); const [zipPassword, setZipPassword] = useState(''); const [zipComment, setZipComment] = useState(''); const [errorPolicy, setErrorPolicy] = useState<'abort' | 'prompt' | 'ignore'>('abort'); const [writeLog, setWriteLog] = useState(false)
  const [selectedGridRows, setSelectedGridRows] = useState<Array<Record<string, unknown>>>([])
  const [databases, setDatabases] = useState<string[]>([]); const [selectedDatabase, setSelectedDatabase] = useState(''); const [sourceObjects, setSourceObjects] = useState<DatabaseObject[]>([]); const [selectedSources, setSelectedSources] = useState<string[]>([]); const [sourceSearch, setSourceSearch] = useState('')
  const [dataTypes, setDataTypes] = useState<Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>>({})
  const [formatCategory, setFormatCategory] = useState<'all' | 'formats' | 'templates'>('all')
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [report, setReport] = useState(''); const [resultPaths, setResultPaths] = useState<string[]>([]); const [logPath, setLogPath] = useState(''); const [jobId, setJobId] = useState(() => crypto.randomUUID()); const [progress, setProgress] = useState<{ phase: string; rows: number; bytes?: number } | null>(null); const [templates, setTemplates] = useState<ImportExportTemplate[]>([])
  const steps = direction === 'export' ? exportSteps : importSteps
  useEffect(() => { setSelectedGridRows(getSelectedGridRows().rows); return subscribeSelectedGridRows((_columns, rows) => setSelectedGridRows(rows)) }, [])
  const formats = direction === 'export' ? exportFormats : importFormats
  const selectedFormat = direction === 'export' ? exportFormat : importFormat
  const selectedFormatTitle = formats.find((item) => item.id === selectedFormat)?.title ?? selectedFormat.toUpperCase()
  const canAdvance = useMemo(() => {
    if (direction === 'export') return (step !== 1 || Boolean(query.trim())) && (step !== 5 || rowMode !== 'selected' || selectedGridRows.length > 0)
    if (step === 0) return Boolean(sourceFile)
    if (step === 1) return Boolean(table.trim()) && (destinationMode !== 'new' || Boolean(selectedDatabase))
    if (step === 4) return Object.keys(mapping).length === 0 || Object.values(mapping).some(Boolean)
    if (step === 5) return mode === 'append' || mode === 'repopulate' || Boolean(keys.trim())
    return true
  }, [direction, step, query, sourceFile, table, mapping, mode, keys, rowMode, selectedGridRows, destinationMode, selectedDatabase])
  useEffect(() => { void window.tuxsql.getConnections().then((items) => { const selected = items.find((item) => item.id === activeConnection?.recordId || item.name === activeConnection?.name)?.id ?? items[0]?.id ?? ''; setRecords(items); setConnection(selected) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')); void window.tuxsql.listImportExportTemplates().then(setTemplates).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar templates.')) }, [activeConnection?.name, activeConnection?.recordId])
  useEffect(() => { const listener = (event: Event): void => { const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind; if (kind !== 'import' && kind !== 'export') return; setDirection(kind); setStep(0); setMessage(''); setReport(''); setResultPaths([]) }; window.addEventListener('tuxsql:task:restore', listener); return () => window.removeEventListener('tuxsql:task:restore', listener) }, [])
  useEffect(() => window.tuxsql.onImportExportProgress(jobId, setProgress), [jobId])
  useEffect(() => {
    const record = records.find((item) => item.id === connection)
    if (!record) return
    let active = true
    void window.tuxsql.connect(record).then(async (connected) => {
      try {
        const names = await window.tuxsql.listDatabases(connected.id)
        const database = selectedExplorerDatabase && names.includes(selectedExplorerDatabase) ? selectedExplorerDatabase : record.database && names.includes(record.database) ? record.database : names[0] ?? ''
        if (active) { setDatabases(names); setSelectedDatabase((current) => names.includes(current) ? current : database) }
        if (database) {
          const objects = await window.tuxsql.listDatabaseObjects(connected.id, database)
          if (active) setSourceObjects(objects.filter((item) => item.kind === 'table' || item.kind === 'view'))
        }
      } finally { await window.tuxsql.disconnect(connected.id) }
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load database objects.') })
    return () => { active = false }
  }, [connection, records, selectedExplorerDatabase])
  useEffect(() => {
    if (!selectedExplorerTable || !selectedExplorerDatabase) return
    const target = selectedExplorerTable.replaceAll('`', '``')
    const databaseName = selectedExplorerDatabase.replaceAll('`', '``')
    setTable(selectedExplorerTable)
    setDestinationMode('existing')
    setImportOutput('direct')
    setQuery(`SELECT * FROM \`${databaseName}\`.\`${target}\` LIMIT 1000`)
    setSelectedSources([selectedExplorerTable])
    if (selectedIntent === 'importData') setDirection('import')
    else if (selectedIntent === 'exportData') setDirection('export')
  }, [selectedExplorerTable, selectedExplorerDatabase, selectedIntent])

  async function chooseSource(): Promise<void> {
    setMessage('')
    try {
      localStorage.setItem('tuxsql.import.lastFormat', importFormat)
      const selected = await window.tuxsql.selectImportSource(jobId, importFormat, { delimiter: importFormat === 'text' && delimiter === ',' ? '\t' : delimiter, autoDelimiter, skipLines, headerPosition, nullString, booleanTrueValue, booleanFalseValue, quote, header, encoding, rowElement })
      if (!selected) return
      setSourceFile({ name: selected.name, size: selected.size, modified: selected.modified })
      if (selected.detectedDelimiter) setDelimiter(selected.detectedDelimiter)
      const columns = selected.preview.columns
      setMapping(Object.fromEntries(columns.map((column) => [column, column])))
      setSample(rowsForPreview(columns, selected.preview.rows))
      const inferred = inferImportColumns(columns, selected.preview.rows)
      setImportColumns(inferred)
      if (destinationMode === 'new') setTable(selected.name.replace(/\.[^.]+$/, '').replace(/(?:[_ -]?\d{8}(?:[_-]?\d{4,6})?)$/, '').replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^\d/, '_$&').slice(0, 60) || 'imported_data')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.') }
  }

  async function run(): Promise<void> {
    const record = records.find((item) => item.id === connection)
    if (!record) { setMessage('Selecione uma conexão.'); return }
    setBusy(true); setMessage(direction === 'export' ? 'Exporting…' : 'Importing…'); setReport(''); setResultPaths([]); setLogPath('')
    let connectedId = ''
    try {
      const connected = await window.tuxsql.connect(record); connectedId = connected.id
      if (direction === 'export') {
        const rowQuery = rowMode === 'range' ? `${query.replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?\s*;?$/i, '')} LIMIT ${Math.max(0, rowCount)} OFFSET ${Math.max(0, rowStart - 1)}` : query
        const sources = rowMode === 'selected' ? [''] : selectedSources.length ? selectedSources : ['']
        if (sources.length > 1 && outputMode !== 'separate') throw new Error(t('imex.multiFileRequired'))
        const savedReports: string[] = []; const outputPaths: string[] = []
        for (const sourceName of sources) {
          const objectQuery = sourceName ? `SELECT * FROM \`${selectedDatabase.replaceAll('`', '``')}\`.\`${sourceName.replaceAll('`', '``')}\`` : rowQuery
          let sourceQuery = rowMode === 'selected' ? selectedRowsQuery(selectedGridRows) : sourceName ? objectQuery : rowQuery
          if (sourceName && rowMode === 'range') sourceQuery = `${sourceQuery} LIMIT ${Math.max(0, rowCount)} OFFSET ${Math.max(0, rowStart - 1)}`
          const aliases = sources.length === 1 ? Object.entries(mapping).filter(([, alias]) => alias.trim()) : []
          if (aliases.length && sources.length === 1) sourceQuery = `SELECT ${aliases.map(([column, alias]) => `\`_tuxsql_source\`.\`${column.replaceAll('`', '``')}\` AS \`${alias.replaceAll('`', '``')}\``).join(', ')} FROM (${sourceQuery.replace(/;\s*$/, '')}) AS \`_tuxsql_source\``
          const columnTypes = Object.fromEntries(Object.entries(mapping).filter(([, alias]) => alias.trim()).map(([column, alias]) => [alias, dataTypes[column] ?? 'String'])) as Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>
          const saved = await window.tuxsql.exportData(connectedId, sourceQuery, exportFormat, { delimiter, quote, header, forceQuotes, encoding: encoding as 'utf8' | 'utf16le' | 'latin1', fileName: sourceName || fileName, appendTimestamp: timestamp, autoDeleteDays: autoDelete ? deleteDays : undefined, autoDeleteCount: autoDelete ? deleteCount : undefined, rowStart, rowCount, columnTypes, compress: zipEnabled, zipLevel, zipPassword: zipPassword || undefined, zipComment }, jobId)
          savedReports.push(`${sourceName || fileName}: ${saved.report.rows} rows · ${formatBytes(saved.report.bytes)}\n${saved.path}`)
          outputPaths.push(saved.path)
        }
        setResultPaths(outputPaths)
        void window.tuxsql.recordRecentTask({ kind: 'export', title: `${exportFormat.toUpperCase()} export`, detail: selectedDatabase || t('tasks.allData') }).catch(() => undefined)
        setReport(`Data Export finished successfully.\n${savedReports.join('\n\n')}`)
      } else {
        const keyColumns = keys.split(',').map((value) => value.trim()).filter(Boolean)
        const columnMapping = Object.fromEntries(Object.entries(mapping).filter(([, target]) => target.trim()))
        if (mode === 'repopulate' && !window.confirm(t('imex.repopulateConfirm'))) { setBusy(false); return }
        if (mode === 'delete' && !window.confirm(t('imex.deleteConfirm'))) { setBusy(false); return }
        const newTableSchema = destinationMode === 'new' ? { database: selectedDatabase, name: table, columns: importColumns } : undefined
        const targetTable = destinationMode === 'new' ? `${selectedDatabase}.${table}` : table
        const importOptions = { delimiter: importFormat === 'text' && delimiter === ',' ? '\t' : delimiter, quote, header, skipLines, headerPosition, nullString, booleanTrueValue, booleanFalseValue, onRowError: errorPolicy === 'ignore' ? 'continue' as const : errorPolicy, encoding, rowElement, ...(importFormat !== 'sql' && Object.keys(columnMapping).length ? { columnMapping } : {}), ...(newTableSchema ? { createTable: newTableSchema } : {}) }
        if (importOutput !== 'direct') {
          const generated = await window.tuxsql.generateImportSql(targetTable, importFormat, mode, keyColumns, importOptions, jobId)
          setResultPaths([generated.path])
          if (importOutput === 'editor') {
            await window.tuxsql.openSqlPath(generated.path)
          }
          setReport(`${importOutput === 'editor' ? 'Import script opened in the SQL editor.' : 'SQL script saved.'}\n${generated.rows} rows\n${generated.path}`)
          void window.tuxsql.recordRecentTask({ kind: 'import', title: `${importFormat.toUpperCase()} import script`, detail: targetTable }).catch(() => undefined)
          setStep(steps.length - 1); setMessage(''); return
        }
        if (newTableSchema) {
          if (!window.confirm(t('imex.createTableConfirm', [`${selectedDatabase}.${table}`]))) { setBusy(false); return }
          await window.tuxsql.executeSql(connectedId, buildCreateTableSql(selectedDatabase, table, importColumns), crypto.randomUUID(), selectedDatabase)
        }
        const result = await window.tuxsql.importData(connectedId, targetTable, importFormat, mode, keyColumns, importOptions, jobId)
        void window.tuxsql.recordRecentTask({ kind: 'import', title: `${importFormat.toUpperCase()} import`, detail: targetTable }).catch(() => undefined)
        let reportText = `Import complete\nRows imported: ${result.inserted}\nErrors: ${result.errors}\nWarnings: 0\n${result.read} rows read · ${result.inserted} inserted · ${result.updated} updated · ${result.deleted} deleted${result.rowErrors.length ? `\n\n${result.rowErrors.map((item) => `Row ${item.row}: ${item.message}`).join('\n')}` : ''}`
        if (writeLog && result.rowErrors.length) { const savedLogPath = await window.tuxsql.saveImportExportLog(reportText); if (savedLogPath) { reportText += `\n\nError log: ${savedLogPath}`; setLogPath(savedLogPath) } }
        setReport(reportText)
      }
      setStep(steps.length - 1); setMessage('')
    } catch (error) { let detail = error instanceof Error ? error.message : direction === 'export' ? 'Data export failed.' : 'Data Import failed.'; if (direction === 'import') detail = `Errors: 1\nWarnings: 0\nRows imported: 0\n\n${detail}`; if (writeLog) { const savedLogPath = await window.tuxsql.saveImportExportLog(detail).catch(() => null); if (savedLogPath) { detail += `\nError log: ${savedLogPath}`; setLogPath(savedLogPath) } } setReport(detail); setStep(steps.length - 1); setMessage('') }
    finally { if (connectedId) void window.tuxsql.disconnect(connectedId); setZipPassword(''); setBusy(false) }
  }

  async function saveTemplate(): Promise<void> {
    const name = window.prompt('Template name')?.trim(); if (!name) return
    try {
      const saved = await window.tuxsql.saveImportExportTemplate({ name, direction, format: selectedFormat, query: direction === 'export' ? query : undefined, table: direction === 'import' ? table : undefined, mode: direction === 'import' ? mode : undefined, keyColumns: direction === 'import' ? keys.split(',').map((key) => key.trim()).filter(Boolean) : undefined, options: { delimiter, quote, header, forceQuotes, encoding: encoding as 'utf8' | 'utf16le' | 'latin1', rowElement, columnMapping: mapping, columnTypes: dataTypes, outputMode, fileName, appendTimestamp: timestamp, autoDeleteDays: autoDelete ? deleteDays : undefined, autoDeleteCount: autoDelete ? deleteCount : undefined } })
      setTemplates((current) => [...current.filter((item) => item.id !== saved.id), saved]); setMessage('Template saved in userData. Connection credentials are not stored.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save template.') }
  }

  function loadTemplate(item: ImportExportTemplate): void {
    setDirection(item.direction); if (item.direction === 'export') setExportFormat(item.format as ExportFormat); else setImportFormat(item.format as ImportFormat)
    setQuery(item.query ?? query); setTable(item.table ?? ''); setMode(item.mode ?? 'append'); setKeys(item.keyColumns?.join(', ') ?? 'id'); setDelimiter(item.options?.delimiter ?? ','); setQuote(item.options?.quote ?? '"'); setHeader(item.options?.header ?? true); setForceQuotes(item.options?.forceQuotes ?? false); setEncoding(item.options?.encoding ?? 'utf8'); setRowElement(item.options?.rowElement ?? 'row'); setMapping(item.options?.columnMapping ?? {}); setDataTypes(item.options?.columnTypes ?? {}); setFileName(item.options?.fileName ?? 'export'); setTimestamp(item.options?.appendTimestamp ?? true); setAutoDelete(Boolean(item.options?.autoDeleteDays)); setDeleteDays(item.options?.autoDeleteDays ?? 30); setDeleteCount(item.options?.autoDeleteCount ?? 20); setOutputMode(item.options?.outputMode ?? 'single'); setZipEnabled(item.options?.compress ?? false); setZipLevel(item.options?.zipLevel ?? 6); setZipComment(item.options?.zipComment ?? ''); setZipPassword(''); setStep(0); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()); setMessage(`Loaded template “${item.name}”.`)
  }

  async function refreshPreview(): Promise<void> {
    const record = records.find((item) => item.id === connection); if (!record) { setMessage('Selecione uma conexão.'); return }
    try {
      const connected = await window.tuxsql.connect(record)
      try {
        const preview = await window.tuxsql.previewExport(connected.id, query, jobId)
        const columns = preview.columns; setSample(rowsForPreview(columns, preview.rows)); setMapping(Object.fromEntries(columns.map((column) => [column, column])))
      } finally { await window.tuxsql.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Preview failed.') }
  }

  async function deleteTemplate(id: string): Promise<void> {
    await window.tuxsql.deleteImportExportTemplate(id); setTemplates((current) => current.filter((item) => item.id !== id))
  }

  const changeDirection = (next: Direction): void => { setDirection(next); setStep(0); setReport(''); setMessage(''); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()) }
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { const heading = pageRef.current?.querySelector<HTMLElement>('h3'); if (heading) { heading.tabIndex = -1; heading.focus() } }, [step, direction])
  return <section className="tool-panel io-wizard" aria-label={t('panel.import.export.m4bdfe4744d')} onKeyDown={(event) => { if (event.key === 'Escape' && !busy && step > 0) { event.preventDefault(); setStep((current) => current - 1) } }}>
    <h2>{t('panel.import.export.m05ba66e6cd')}</h2><p>{t('panel.import.export.ma34a200dba')}</p>
    <nav className="io-stepper" aria-label={t('panel.import.export.mabb6679b11')}>{steps.map((key, index) => <button type="button" key={key} className={index === step ? 'current' : index < step ? 'complete' : ''} onClick={() => index < step && setStep(index)} disabled={busy || index >= step} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{t(key)}</button>)}</nav>
    {step !== steps.length - 1 && <div className="io-toolbar"><label>{t('panel.import.export.m23ad6f9599')} <select value={direction} disabled={busy} onChange={(event) => changeDirection(event.target.value as Direction)}><option value="export">{t('io.export.title')}</option><option value="import">{t('io.import.title')}</option></select></label><label>{t('panel.import.export.mb2d15b6cb0')} <select value={connection} disabled={busy} onChange={(event) => setConnection(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}{item.environment === 'prod' ? ' · Prod' : ''}</option>)}</select></label></div>}
    <main ref={pageRef} className="io-page" key={`${direction}-${step}`}>
      {step === 0 && <div className="io-categories">{(['all', 'formats', 'templates'] as const).map((category) => <button type="button" key={category} className={formatCategory === category ? 'selected' : ''} onClick={() => setFormatCategory(category)}>{t(`imex.category.${category}`)}</button>)}</div>}
      {step === 0 && direction === 'export' && <><h3>{t('io.export.format')}</h3>{formatCategory !== 'templates' ? <div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => setExportFormat(format.id)}><strong>{format.title}</strong><span>{t(format.description)}</span></button>)}{unsupportedExportFormats.map((format) => <button type="button" key={format.title} disabled title={t(format.reason)}><strong>{format.title}</strong><span>{t('imex.unsupported', [t(format.reason)])}</span></button>)}</div> : <TemplatePicker templates={templates.filter((item) => item.direction === 'export')} onLoad={loadTemplate} onSave={() => void saveTemplate()} />}</>}
      {step === 0 && direction === 'import' && <><h3>{t('panel.import.export.m76d88b83fa')}</h3>{formatCategory !== 'templates' ? <><button type="button" onClick={() => void chooseSource()}>{t('panel.import.export.m2b4e906f71')}</button>{sourceFile && <p>{sourceFile.name} · {formatBytes(sourceFile.size)} · {new Date(sourceFile.modified).toLocaleString()}</p>}<div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => { setImportFormat(format.id as ImportFormat); localStorage.setItem('tuxsql.import.lastFormat', format.id); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()) }}><strong>{format.title}</strong><span>{t(format.description)}</span></button>)}{unsupportedImportFormats.map((format) => <button type="button" key={format.title} disabled title={t(format.reason)}><strong>{format.title}</strong><span>{t('imex.unsupported', [t(format.reason)])}</span></button>)}</div></> : <TemplatePicker templates={templates.filter((item) => item.direction === 'import')} onLoad={loadTemplate} onSave={() => void saveTemplate()} />}</>}
      {step === 1 && direction === 'export' && <><h3>{t('io.export.source.hint')}</h3><label>{t('panel.import.export.m33ac32d2b1')} <select value={selectedDatabase} onChange={(event) => { setSelectedDatabase(event.target.value); setSelectedSources([]) }}>{databases.map((name) => <option key={name}>{name}</option>)}</select></label><label>{t('panel.import.export.m0f13e241de9')} <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} /></label><div className="io-source-list">{sourceObjects.filter((item) => item.name.toLowerCase().includes(sourceSearch.toLowerCase())).map((item) => <label key={`${item.kind}:${item.name}`}><input type="checkbox" checked={selectedSources.includes(item.name)} onChange={(event) => { const next = event.target.checked ? [...selectedSources, item.name] : selectedSources.filter((name) => name !== item.name); setSelectedSources(next); if (next.length > 1) setOutputMode('separate') }} />{item.name}<small>{item.kind}</small></label>)}</div><label className="io-wide">{t('panel.import.export.m7bde9f9405')} <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} spellCheck={false} /></label><p>{selectedSources.length > 1 ? t('imex.multiFileRequired') : t('panel.import.export.m3164ae8877')}</p></>}
      {step === 1 && direction === 'import' && <><h3>{t('io.import.target.hint')}</h3><label><input type="radio" checked={destinationMode === 'new'} onChange={() => { setDestinationMode('new'); setMode('append'); setImportOutput('editor') }} /> {t('imex.newTable')}</label><label><input type="radio" checked={destinationMode === 'existing'} onChange={() => { setDestinationMode('existing'); setImportOutput('direct') }} /> {t('imex.existingTable')}</label><label>{t('imex.database')} <select value={selectedDatabase} onChange={(event) => setSelectedDatabase(event.target.value)}>{databases.map((name) => <option key={name}>{name}</option>)}</select></label>{destinationMode === 'existing' ? <label>{t('panel.import.export.m34ae80ec1b')} <select value={table} onChange={(event) => setTable(event.target.value)}>{sourceObjects.filter((item) => item.kind === 'table').map((item) => <option key={item.name}>{item.name}</option>)}</select></label> : <label>{t('panel.import.export.m34ae80ec1b')} <input value={table} onChange={(event) => setTable(event.target.value)} placeholder={t('panel.import.export.m28b250e0aa')} /></label>}<p>{t('panel.import.export.m19fd8d3ae9')} {records.find((item) => item.id === connection)?.name ?? t('audit.imex.selectConnection')}.</p></>}
      {step === 2 && direction === 'export' && <><h3>{t('imex.export.outputSettings')}</h3><label><input type="radio" checked={outputMode === 'single'} disabled={selectedSources.length > 1} onChange={() => setOutputMode('single')} /> {t('imex.singleFile')}</label><label><input type="radio" checked={outputMode === 'separate'} onChange={() => setOutputMode('separate')} /> {t('imex.separateFiles')}</label><label>{t('imex.fileName')} <input value={fileName} onChange={(event) => setFileName(event.target.value)} /></label><label><input type="checkbox" checked={timestamp} onChange={(event) => setTimestamp(event.target.checked)} /> {t('imex.timestamp')}</label><label><input type="checkbox" checked={autoDelete} onChange={(event) => setAutoDelete(event.target.checked)} /> {t('imex.autoDelete')}</label>{autoDelete && <><label>{t('imex.deleteDays')} <input type="number" min="1" value={deleteDays} onChange={(event) => setDeleteDays(Number(event.target.value))} /></label><label>{t('imex.deleteCount')} <input type="number" min="1" value={deleteCount} onChange={(event) => setDeleteCount(Number(event.target.value))} /></label></>}<label><input type="checkbox" checked={zipEnabled} onChange={(event) => setZipEnabled(event.target.checked)} /> {t('imex.compression')}</label>{zipEnabled && <><label>{t('imex.zipLevel')} <input type="number" min="0" max="9" value={zipLevel} onChange={(event) => setZipLevel(Number(event.target.value))} /></label><label>{t('imex.zipPassword')} <input type="password" autoComplete="new-password" value={zipPassword} onChange={(event) => setZipPassword(event.target.value)} /></label><label>{t('imex.zipComment')} <input maxLength={500} value={zipComment} onChange={(event) => setZipComment(event.target.value)} /></label></>}</>}
      {step === 2 && direction === 'import' && <><h3>{t('panel.import.export.m4e8c99d0bc')} {selectedFormatTitle}</h3>{importFormat === 'sql' ? <p role="note">{t('panel.import.export.mebd16dd58d')}</p> : <Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={importFormat === 'csv' || importFormat === 'text'} forceQuotes={forceQuotes} setForceQuotes={setForceQuotes} />}{(importFormat === 'csv' || importFormat === 'text') && <><label><input type="checkbox" checked={autoDelimiter} onChange={(event) => setAutoDelimiter(event.target.checked)} /> {t('imex.autoDelimiter')}</label><label>{t('imex.skipLines')} <input type="number" min="0" max="100000" value={skipLines} onChange={(event) => setSkipLines(Math.max(0, Number(event.target.value)))} /></label><label>{t('imex.headerPosition')} <input type="number" min="1" max="100000" value={headerPosition} disabled={!header} onChange={(event) => setHeaderPosition(Math.max(1, Number(event.target.value)))} /></label><label>Null String <input aria-label="Null String" value={nullString} onChange={(event) => setNullString(event.target.value)} /></label></>}{importFormat === 'xml' && <label>{t('panel.import.export.m477c4d576d')} <input value={rowElement} onChange={(event) => setRowElement(event.target.value)} /></label>}{sourceFile && <Preview sample={sample} label={t('audit.imex.sourcePreview')} />}</>}
      {step === 3 && direction === 'export' && <><h3>{t('panel.import.export.m4e8c99d0bc')} {selectedFormatTitle}</h3><Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={exportFormat === 'csv' || exportFormat === 'text'} forceQuotes={forceQuotes} setForceQuotes={setForceQuotes} /></>}
      {step === 3 && direction === 'import' && <><h3>{t('tbl.page.columns')}</h3><p>{t('panel.import.export.m9bb4f7c2ba')}</p><fieldset><legend>Boolean values</legend><label>True <input aria-label="Boolean true value" value={booleanTrueValue} onChange={(event) => setBooleanTrueValue(event.target.value)} /></label><label>False <input aria-label="Boolean false value" value={booleanFalseValue} onChange={(event) => setBooleanFalseValue(event.target.value)} /></label></fieldset>{sourceFile && <p>{t('imex.inferredFromPreview', [String(Math.max(0, sample.length - 1))])}</p>}<table className="io-mapping"><thead><tr><th>{t('imex.destinationColumn')}</th><th>{t('imex.inferredType')}</th></tr></thead><tbody>{importColumns.map((column, index) => <tr key={`${column.name}-${index}`}><td>{column.name}</td><td>{column.type}</td></tr>)}</tbody></table></>}
      {step === 4 && direction === 'export' && <><h3>{t('tbl.page.columns')}</h3><button type="button" onClick={() => void refreshPreview()}>{t('panel.import.export.m6ba76f777b')}</button><ColumnsGrid columns={sample[0] ?? []} aliases={mapping} setAliases={setMapping} types={dataTypes} setTypes={setDataTypes} /><Preview sample={sample} label="Column preview" /></>}
      {step === 4 && direction === 'import' && <><h3>{t('panel.import.export.m763ce4cf9c')}</h3><p>{t('panel.import.export.mb751db47db')}</p>{importFormat === 'sql' ? <p>{t('panel.import.export.m9a878d506a')}</p> : <>{destinationMode === 'existing' ? <Mapping mapping={mapping} setMapping={setMapping} /> : <><div className="io-toolbar"><button type="button" onClick={() => setMapping(Object.fromEntries(Object.keys(mapping).map((key) => [key, key])))}>{t('imex.fillMapping')}</button><button type="button" onClick={() => setMapping({})}>{t('imex.clearMapping')}</button><button type="button" onClick={() => setImportColumns((items) => [...items, { name: `column${items.length + 1}`, type: 'VARCHAR(255)', primaryKey: false }])}>{t('imex.newColumn')}</button><button type="button" onClick={() => setImportColumns((items) => items.slice(0, -1))} disabled={!importColumns.length}>{t('imex.deleteColumn')}</button></div><table className="io-mapping"><thead><tr><th>{t('imex.sourceColumn')}</th><th>{t('imex.destinationColumn')}</th><th>{t('imex.inferredType')}</th><th>{t('imex.primaryKey')}</th></tr></thead><tbody>{importColumns.map((column, index) => { const source = Object.keys(mapping)[index] ?? ''; const sourceColumns = sample[0] ?? []; const columnTypes = [...new Set([column.type, 'INT','BIGINT','DECIMAL(18,2)','DATETIME','TEXT','JSON','VARCHAR(255)'])]; return <tr key={`${source}-${index}`}><td><select value={source} onChange={(event) => { const oldName = Object.keys(mapping)[index] ?? ''; const nextMap = { ...mapping }; delete nextMap[oldName]; if (event.target.value) nextMap[event.target.value] = column.name; setMapping(nextMap) }}><option value="">—</option>{sourceColumns.map((key) => <option key={key}>{key}</option>)}</select></td><td><input value={column.name} onChange={(event) => { setImportColumns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)); const sourceName = Object.keys(mapping)[index]; if (sourceName) setMapping({ ...mapping, [sourceName]: event.target.value }) }} /></td><td><select value={column.type} onChange={(event) => setImportColumns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>{columnTypes.map((type) => <option key={type}>{type}</option>)}</select></td><td><input type="checkbox" checked={column.primaryKey} aria-label={`${t('imex.primaryKey')} ${column.name}`} onChange={(event) => setImportColumns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, primaryKey: event.target.checked } : item))} /></td></tr>})}</tbody></table></>}{sample.length > 1 && <Preview sample={sample} label="Preview · first rows" />}</>}</>}
      {step === 5 && direction === 'export' && <><h3>{t('imex.export.rows')}</h3>{(['all', 'selected', 'range'] as const).map((value) => <label key={value}><input type="radio" checked={rowMode === value} disabled={value === 'selected' && !selectedGridRows.length} onChange={() => setRowMode(value)} /> {t(value === 'all' ? 'imex.exportAll' : value === 'selected' ? 'imex.exportSelected' : 'imex.exportRange')}</label>)}{rowMode === 'selected' && <p>{selectedGridRows.length} {t('grid.selected')} · {t('imex.selectedRowsLimit')}</p>}{rowMode === 'range' && <><label>{t('imex.start')} <input type="number" min="1" value={rowStart} onChange={(event) => setRowStart(Number(event.target.value))} /></label><label>{t('imex.count')} <input type="number" min="0" value={rowCount} onChange={(event) => setRowCount(Number(event.target.value))} /></label></>}</>}
      {step === 5 && direction === 'import' && <><h3>{t('io.import.mode.hint')}</h3><label>{t('panel.import.export.m30d1fd14cd')} <select value={mode} disabled={destinationMode === 'new'} onChange={(event) => setMode(event.target.value as ImportMode)}><option value="append">{t('audit.imex.mode.append')}</option><option value="update">{t('audit.imex.mode.update')}</option><option value="delete">{t('audit.imex.mode.delete')}</option><option value="upsert">{t('audit.imex.mode.upsert')}</option><option value="repopulate">{t('audit.imex.mode.repopulate')}</option></select></label>{destinationMode === 'new' ? <p>{t('imex.newTableAppendOnly')}</p> : !['append', 'repopulate'].includes(mode) && <label>{t('panel.import.export.me6a2226e5d')} <input value={keys} onChange={(event) => setKeys(event.target.value)} placeholder={t('panel.import.export.ma98a7d7c7b')} /></label>}<p>{t('panel.import.export.mcc380f64c9')}</p></>}
      {step === 6 && direction === 'export' && <><h3>{t('io.errors.title')}</h3><ErrorOptions policy={errorPolicy} setPolicy={setErrorPolicy} writeLog={writeLog} setWriteLog={setWriteLog} /></>}
      {step === 6 && direction === 'import' && <><h3>{t('imex.import.output')}</h3>{([['editor','imex.outputEditor'],['file','imex.outputFile'],['direct','imex.outputDirect']] as const).map(([value,label]) => <label key={value}><input type="radio" checked={importOutput === value} onChange={() => setImportOutput(value)} /> {t(label)}</label>)}<p>{t('panel.import.export.m6416fe507b')}{sourceFile ? ` · ${sample.length - 1} rows previewed` : ''}</p></>}
      {step === 7 && direction === 'import' && <><h3>{t('io.errors.title')}</h3><ErrorOptions policy={errorPolicy} setPolicy={setErrorPolicy} writeLog={writeLog} setWriteLog={setWriteLog} /></>}
      {step === (direction === 'export' ? 7 : 8) && <><h3>{t(direction === 'export' ? 'audit.imex.readyExport' : 'audit.imex.readyImport')}</h3><p>{direction === 'export' ? t('audit.imex.exportSummary', [query.trim() ? t('audit.imex.selectedQuery') : t('audit.imex.data'), selectedFormatTitle]) : t('audit.imex.importSummary', [sourceFile?.name ?? t('audit.imex.selectedFile'), table || t('audit.imex.destinationTable'), t(`audit.imex.mode.${mode}`)])}</p><p>{t('panel.import.export.mca128259eb')} {t(direction === 'export' ? 'audit.imex.export' : 'audit.imex.import')} {t('panel.import.export.m7d6b5badc4')}</p></>}
      {step === steps.length - 2 && <><h3>{t(direction === 'export' ? 'audit.imex.readyExport' : 'audit.imex.readyImport')}</h3><p>{direction === 'export' ? t('audit.imex.exportSummary', [query.trim() ? t('audit.imex.selectedQuery') : t('audit.imex.data'), selectedFormatTitle]) : t('audit.imex.importSummary', [sourceFile?.name ?? t('audit.imex.selectedFile'), table || t('audit.imex.destinationTable'), t(`audit.imex.mode.${mode}`)])}</p><p>{t('panel.import.export.mca128259eb')} {t(direction === 'export' ? 'audit.imex.export' : 'audit.imex.import')} {t('panel.import.export.m7d6b5badc4')}</p></>}
      {step === steps.length - 1 && <AssistantFinish summary={<pre className="io-report" role="status">{report || t('assistant.finish.noRun')}</pre>} paths={resultPaths} logPath={logPath || undefined} onError={setMessage} />}
    </main>
    {templates.length > 0 && <div className="io-templates"><label>{t('panel.import.export.me16fe4b9f2')} <select defaultValue="" onChange={(event) => { const item = templates.find((template) => template.id === event.target.value); if (item) loadTemplate(item) }}><option value="">{t('panel.import.export.mf953f535f3')}</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.direction}</option>)}</select></label>{templates.map((item) => <button type="button" aria-label={`Delete template ${item.name}`} title={t('panel.import.export.m333d0ddce5')} key={item.id} onClick={() => void deleteTemplate(item.id)}>× {item.name}</button>)}</div>}
    <footer className="io-footer"><div><button type="button" onClick={() => void saveTemplate()} disabled={busy}>{t('panel.import.export.m6b8f437d0d')}</button></div><div>{step > 0 && step < steps.length - 1 && <button type="button" onClick={() => setStep((current) => current - 1)} disabled={busy}>{t('panel.import.export.m631bf5f93f')}</button>}{step < steps.length - 2 ? <button type="button" className="button-primary" onClick={() => setStep((current) => current + 1)} disabled={!canAdvance || busy}>{t('panel.import.export.m73136aa4bd')}</button> : step === steps.length - 2 ? <button type="button" className="button-primary" onClick={() => void run()} disabled={busy || !connection || (direction === 'export' ? !query.trim() : !table.trim() || !sourceFile)}>{busy ? t('audit.imex.working') : t(direction === 'export' ? 'audit.imex.export' : 'audit.imex.import')}</button> : <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setSourceFile(null); setSample([]); setMapping({}); setImportColumns([]); setJobId(crypto.randomUUID()) }}>{direction === 'import' ? t('imex.importMore') : t('panel.import.export.m1795ee1801')}</button>}{busy ? <button type="button" onClick={() => void window.tuxsql.cancelImportExport(jobId)}>{t('common.cancel')}</button> : step < steps.length - 1 && <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setSourceFile(null); setJobId(crypto.randomUUID()) }}>{t('common.cancel')}</button>}</div></footer>
    {progress && busy && <p role="status">{progress.phase === 'reading' ? `Importing: ${progress.rows} rows processed` : progress.phase === 'writing' ? `Exporting: ${progress.rows} rows · ${progress.bytes ?? 0} bytes` : `${progress.phase}: ${progress.rows} rows`}</p>}
    {message && <p className="io-message" role="status">{message}</p>}
    <style>{`.io-wizard{max-width:980px}.io-stepper{display:flex;gap:4px;overflow:auto;margin:20px 0}.io-stepper button{border:0;background:transparent;color:var(--muted,#777);display:flex;align-items:center;gap:7px;padding:8px;white-space:nowrap}.io-stepper button:focus-visible,.io-categories button:focus-visible,.io-format-grid button:focus-visible,.io-footer button:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}.io-stepper button span{border:1px solid currentColor;border-radius:50%;width:22px;height:22px;display:inline-grid;place-items:center}.io-stepper button.current{color:var(--accent,#3774d6);font-weight:700}.io-stepper button.complete{color:var(--success,#25834a);cursor:pointer}.io-toolbar,.io-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.io-toolbar{padding:10px 0;border-block:1px solid var(--border,#888)}.io-toolbar label,.io-page>label,.io-page label{display:flex;gap:8px;align-items:center;margin:12px 0}.io-page{min-height:260px;padding:16px 0}.io-format-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.io-format-grid button{text-align:left;padding:14px;border:1px solid var(--border,#888);border-radius:6px;background:var(--surface,#fff);color:inherit;cursor:pointer}.io-format-grid button.selected{outline:2px solid var(--accent,#3774d6)}.io-format-grid button:disabled{opacity:.55;cursor:not-allowed}.io-format-grid span{display:block;margin-top:6px;color:var(--muted,#777)}.io-categories{display:flex;gap:8px;border-bottom:1px solid var(--border,#888);padding-bottom:8px}.io-categories button{border:0;background:transparent;color:inherit;padding:8px}.io-categories button.selected{color:var(--accent,#3774d6);font-weight:700;border-bottom:2px solid var(--accent,#3774d6)}.io-wide{display:block}.io-wide textarea{display:block;width:100%;font-family:monospace}.io-source-list{max-height:180px;overflow:auto;border:1px solid var(--border,#888);padding:8px}.io-source-list label{display:flex;gap:8px;align-items:center}.io-source-list small{margin-left:auto;color:var(--muted,#777)}.io-mapping{width:100%;border-collapse:collapse}.io-mapping th,.io-mapping td{text-align:left;padding:8px;border-bottom:1px solid var(--border,#888)}.io-preview,.io-report{max-height:240px;overflow:auto;padding:12px;background:var(--surface-raised,#f2f3f5);white-space:pre-wrap}.io-message{color:var(--status-error,#a32)}.io-footer{border-top:1px solid var(--border,#888);padding-top:14px}.io-footer>div{display:flex;gap:8px}`}</style>
  </section>
}

function Options({ delimiter, setDelimiter, quote, setQuote, header, setHeader, encoding, setEncoding, csv, forceQuotes, setForceQuotes }: { delimiter: string; setDelimiter: (value: string) => void; quote: string; setQuote: (value: string) => void; header: boolean; setHeader: (value: boolean) => void; encoding: 'utf8' | 'utf16le' | 'latin1'; setEncoding: (value: 'utf8' | 'utf16le' | 'latin1') => void; csv: boolean; forceQuotes: boolean; setForceQuotes: (value: boolean) => void }): React.JSX.Element {
  const { t } = useI18n()
  return <div className="io-options">{csv && <><label>{t('panel.import.export.m765fd256a4')} <select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=",">,</option><option value=";">;</option><option value="\t">{t('panel.import.export.m07bccaade0')}</option><option value="|">|</option></select></label><label>{t('panel.import.export.mecfc0f1b07')} <input value={quote} maxLength={1} onChange={(event) => setQuote(event.target.value)} /></label><label><input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} /> {t('panel.import.export.ma6f498bdcd')}</label><label><input type="checkbox" checked={forceQuotes} onChange={(event) => setForceQuotes(event.target.checked)} /> {t('imex.forceQuotes')}</label></>}<label>{t('panel.import.export.m3a81a30ecd')} <select value={encoding} onChange={(event) => setEncoding(event.target.value as 'utf8' | 'utf16le' | 'latin1')}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="latin1">{t('panel.import.export.mc8dac03d1f')}</option></select></label></div>
}

function ErrorOptions({ policy, setPolicy, writeLog, setWriteLog }: { policy: 'abort' | 'prompt' | 'ignore'; setPolicy(value: 'abort' | 'prompt' | 'ignore'): void; writeLog: boolean; setWriteLog(value: boolean): void }): React.JSX.Element {
  const { t } = useI18n()
  return <div>{([['abort', 'imex.abort'], ['prompt', 'imex.prompt'], ['ignore', 'imex.ignore']] as const).map(([value, label]) => <label key={value}><input type="radio" checked={policy === value} onChange={() => setPolicy(value)} /> {t(label)}</label>)}<label><input type="checkbox" checked={writeLog} onChange={(event) => setWriteLog(event.target.checked)} /> {t('imex.writeLog')}</label></div>
}

function ColumnsGrid({ columns, aliases, setAliases, types, setTypes }: { columns: string[]; aliases: Record<string, string>; setAliases(value: Record<string, string>): void; types: Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>; setTypes(value: Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>): void }): React.JSX.Element {
  const { t } = useI18n()
  if (!columns.length) return <p>{t('panel.import.export.m06e93023d5')}</p>
  return <table className="io-mapping"><thead><tr><th>{t('tbl.page.columns')}</th><th>{t('imex.alias')}</th><th>{t('imex.dataType')}</th></tr></thead><tbody>{columns.map((column) => <tr key={column}><td><input type="checkbox" checked={Boolean(aliases[column])} aria-label={`Include ${column}`} onChange={(event) => setAliases({ ...aliases, [column]: event.target.checked ? aliases[column] || column : '' })} /> {column}</td><td><input value={aliases[column] ?? column} onChange={(event) => setAliases({ ...aliases, [column]: event.target.value })} /></td><td><select value={types[column] ?? 'String'} onChange={(event) => setTypes({ ...types, [column]: event.target.value as 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString' })}>{(['String', 'Integer', 'Float', 'DateTime', 'HexString'] as const).map((type) => <option key={type}>{type}</option>)}</select></td></tr>)}</tbody></table>
}

function TemplatePicker({ templates, onLoad, onSave }: { templates: ImportExportTemplate[]; onLoad(item: ImportExportTemplate): void; onSave(): void }): React.JSX.Element {
  const { t } = useI18n()
  return <section className="io-template-picker"><h4>{t('imex.category.templates')}</h4>{templates.length ? templates.map((item) => <button key={item.id} type="button" onClick={() => onLoad(item)}>{item.name} · {item.format.toUpperCase()}</button>) : <p>{t('panel.import.export.m38b6446fbe')}</p>}<button type="button" onClick={onSave}>{t('panel.import.export.m6b8f437d0d')}</button></section>
}

function Mapping({ mapping, setMapping }: { mapping: Record<string, string>; setMapping: (value: Record<string, string>) => void }): React.JSX.Element {
  const { t } = useI18n()
  const entries = Object.entries(mapping)
  if (!entries.length) return <p>{t('panel.import.export.m38b6446fbe')}</p>
  return <table className="io-mapping"><thead><tr><th>{t('panel.import.export.md5d0c93d8e')}</th><th>{t('panel.import.export.m56ff34de5c')}</th><th>→</th><th>{t('panel.import.export.m08c095985d')}</th></tr></thead><tbody>{entries.map(([source, target]) => <tr key={source}><td><input type="checkbox" checked={Boolean(target)} aria-label={`Include ${source}`} onChange={(event) => setMapping({ ...mapping, [source]: event.target.checked ? source : '' })} /></td><td>{source}</td><td>→</td><td><input aria-label={`Destination for ${source}`} value={target} onChange={(event) => setMapping({ ...mapping, [source]: event.target.value })} /></td></tr>)}</tbody></table>
}

function Preview({ sample, label }: { sample: string[][]; label: string }): React.JSX.Element {
  const { t } = useI18n()
  return <section><h4>{label}</h4>{sample.length ? <div style={{ overflow: 'auto', maxHeight: 220 }}><table className="io-mapping"><tbody>{sample.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => rowIndex === 0 ? <th key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <p>{t('panel.import.export.m06e93023d5')}</p>}</section>
}

function rowsForPreview(columns: string[], rows: Array<Record<string, unknown>>): string[][] {
  return [columns, ...rows.map((row) => columns.map((column) => {
    const value = row[column]
    if (value === null || value === undefined) return ''
    if (value instanceof Uint8Array) return btoa(Array.from(value, (byte) => String.fromCharCode(byte)).join(''))
    if (value instanceof Date) return value.toISOString()
    return String(value)
  }))]
}

function formatBytes(bytes: number): string { return bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB` }
