import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { ExportFormat, ImportFormat, ImportMode } from '../../../../../modules/data-export-import/types.js'
import type { ImportExportTemplate } from '../../../../../shared/contracts/import-export.js'
import { usePanelConnection } from '../registry'
import { exportFormats, importFormats } from './formats.js'

type Direction = 'export' | 'import'
const exportSteps = ['Format', 'Source', 'Options', 'Columns', 'Destination & preview', 'Run', 'Report']
const importSteps = ['Source', 'Format & options', 'Destination', 'Mapping', 'Mode & options', 'Preview & validation', 'Run', 'Report']

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [connection, setConnection] = useState('')
  const [direction, setDirection] = useState<Direction>('export'); const [exportFormat, setExportFormat] = useState<ExportFormat>('csv'); const [importFormat, setImportFormat] = useState<ImportFormat>('csv')
  const [query, setQuery] = useState('SELECT * FROM `table_name` LIMIT 1000'); const [table, setTable] = useState('')
  const [mode, setMode] = useState<ImportMode>('append'); const [keys, setKeys] = useState('id'); const [delimiter, setDelimiter] = useState(','); const [quote, setQuote] = useState('"'); const [header, setHeader] = useState(true); const [encoding, setEncoding] = useState<'utf8' | 'utf16le' | 'latin1'>('utf8')
  const [rowElement, setRowElement] = useState('row'); const [columnsText, setColumnsText] = useState(''); const [mapping, setMapping] = useState<Record<string, string>>({}); const [sourceFile, setSourceFile] = useState<{ name: string; size: number; modified: number } | null>(null); const [sample, setSample] = useState<string[][]>([])
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [report, setReport] = useState(''); const [jobId, setJobId] = useState(() => crypto.randomUUID()); const [progress, setProgress] = useState<{ phase: string; rows: number; bytes?: number } | null>(null); const [templates, setTemplates] = useState<ImportExportTemplate[]>([])
  const steps = direction === 'export' ? exportSteps : importSteps
  const formats = direction === 'export' ? exportFormats : importFormats
  const selectedFormat = direction === 'export' ? exportFormat : importFormat
  const selectedFormatTitle = formats.find((item) => item.id === selectedFormat)?.title ?? selectedFormat.toUpperCase()
  const canAdvance = useMemo(() => {
    if (direction === 'export') return step !== 1 || Boolean(query.trim())
    if (step === 0) return Boolean(sourceFile)
    if (step === 2) return Boolean(table.trim())
    if (step === 3) return Object.keys(mapping).length === 0 || Object.values(mapping).some(Boolean)
    if (step === 4) return mode === 'append' || Boolean(keys.trim())
    return true
  }, [direction, step, query, sourceFile, table, mapping, mode, keys])
  useEffect(() => { void window.dbforge.getConnections().then((items) => { const selected = items.find((item) => item.id === activeConnection?.recordId || item.name === activeConnection?.name)?.id ?? items[0]?.id ?? ''; setRecords(items); setConnection(selected) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')); void window.dbforge.listImportExportTemplates().then(setTemplates).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar templates.')) }, [activeConnection?.name, activeConnection?.recordId])
  useEffect(() => window.dbforge.onImportExportProgress(jobId, setProgress), [jobId])

  async function chooseSource(): Promise<void> {
    setMessage('')
    try {
      const selected = await window.dbforge.selectImportSource(jobId, importFormat, { delimiter, quote, header, encoding, rowElement })
      if (!selected) return
      setSourceFile({ name: selected.name, size: selected.size, modified: selected.modified })
      const columns = selected.preview.columns
      setColumnsText(columns.join(', ')); setMapping(Object.fromEntries(columns.map((column) => [column, column])))
      setSample(rowsForPreview(columns, selected.preview.rows))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.') }
  }

  function updateColumns(value: string): void {
    setColumnsText(value)
    const names = value.split(',').map((column) => column.trim()).filter(Boolean)
    setMapping(Object.fromEntries(names.map((column) => [column, mapping[column] ?? column])))
  }

  async function run(): Promise<void> {
    const record = records.find((item) => item.id === connection)
    if (!record) { setMessage('Selecione uma conexão.'); return }
    setBusy(true); setMessage(direction === 'export' ? 'Exporting…' : 'Importing…'); setReport('')
    let connectedId = ''
    try {
      const connected = await window.dbforge.connect(record); connectedId = connected.id
      if (direction === 'export') {
        const saved = await window.dbforge.exportData(connectedId, query, exportFormat, { delimiter, quote, header, encoding: encoding as 'utf8' | 'utf16le' | 'latin1' }, jobId)
        setReport(`Data Export finished successfully.\n${saved.report.rows} rows · ${formatBytes(saved.report.bytes)}\n${saved.path}`)
      } else {
        const keyColumns = keys.split(',').map((value) => value.trim()).filter(Boolean)
        const columnMapping = Object.fromEntries(Object.entries(mapping).filter(([, target]) => target.trim()))
        const result = await window.dbforge.importData(connectedId, table, importFormat, mode, keyColumns, { delimiter, quote, header, onRowError: 'continue', encoding, rowElement, ...(importFormat !== 'sql' && Object.keys(columnMapping).length ? { columnMapping } : {}) }, jobId)
        setReport(`Import complete\n${result.read} rows read · ${result.inserted} inserted · ${result.updated} updated · ${result.deleted} deleted · ${result.errors} errors${result.rowErrors.length ? `\n\n${result.rowErrors.map((item) => `Row ${item.row}: ${item.message}`).join('\n')}` : ''}`)
      }
      setStep(steps.length - 1); setMessage('')
    } catch (error) { setReport(error instanceof Error ? error.message : direction === 'export' ? 'Data export failed.' : 'Data Import failed.'); setStep(steps.length - 1); setMessage('') }
    finally { if (connectedId) void window.dbforge.disconnect(connectedId); setBusy(false) }
  }

  async function saveTemplate(): Promise<void> {
    const name = window.prompt('Template name')?.trim(); if (!name) return
    try {
      const saved = await window.dbforge.saveImportExportTemplate({ name, direction, format: selectedFormat, query: direction === 'export' ? query : undefined, table: direction === 'import' ? table : undefined, mode: direction === 'import' ? mode : undefined, keyColumns: direction === 'import' ? keys.split(',').map((key) => key.trim()).filter(Boolean) : undefined, options: { delimiter, quote, header, encoding: encoding as 'utf8' | 'utf16le' | 'latin1', rowElement, columnMapping: mapping } })
      setTemplates((current) => [...current.filter((item) => item.id !== saved.id), saved]); setMessage('Template saved in userData. Connection credentials are not stored.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save template.') }
  }

  function loadTemplate(item: ImportExportTemplate): void {
    setDirection(item.direction); if (item.direction === 'export') setExportFormat(item.format as ExportFormat); else setImportFormat(item.format as ImportFormat)
    setQuery(item.query ?? query); setTable(item.table ?? ''); setMode(item.mode ?? 'append'); setKeys(item.keyColumns?.join(', ') ?? 'id'); setDelimiter(item.options?.delimiter ?? ','); setQuote(item.options?.quote ?? '"'); setHeader(item.options?.header ?? true); setEncoding(item.options?.encoding ?? 'utf8'); setRowElement(item.options?.rowElement ?? 'row'); setMapping(item.options?.columnMapping ?? {}); setStep(0); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()); setMessage(`Loaded template “${item.name}”.`)
  }

  async function refreshPreview(): Promise<void> {
    const record = records.find((item) => item.id === connection); if (!record) { setMessage('Selecione uma conexão.'); return }
    try {
      const connected = await window.dbforge.connect(record)
      const preview = await window.dbforge.previewExport(connected.id, query, jobId)
      const columns = preview.columns; setSample(rowsForPreview(columns, preview.rows)); setColumnsText(columns.join(', ')); setMapping(Object.fromEntries(columns.map((column) => [column, column])))
      void window.dbforge.disconnect(connected.id)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Preview failed.') }
  }

  async function deleteTemplate(id: string): Promise<void> {
    await window.dbforge.deleteImportExportTemplate(id); setTemplates((current) => current.filter((item) => item.id !== id))
  }

  const changeDirection = (next: Direction): void => { setDirection(next); setStep(0); setReport(''); setMessage(''); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()) }
  return <section className="tool-panel io-wizard" aria-label="Import and export wizard">
    <h2>⇧ Import / Export</h2><p>Move table data between your database and files. Templates contain settings only; connection credentials are never saved.</p>
    <nav className="io-stepper" aria-label="Wizard steps">{steps.map((title, index) => <button type="button" key={title} className={index === step ? 'current' : index < step ? 'complete' : ''} onClick={() => index < step && setStep(index)} disabled={busy || index >= step} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{title}</button>)}</nav>
    {step !== steps.length - 1 && <div className="io-toolbar"><label>Operation <select value={direction} disabled={busy} onChange={(event) => changeDirection(event.target.value as Direction)}><option value="export">{t('io.export.title')}</option><option value="import">{t('io.import.title')}</option></select></label><label>Connection <select value={connection} disabled={busy} onChange={(event) => setConnection(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}{item.environment === 'prod' ? ' · Prod' : ''}</option>)}</select></label></div>}
    <main className="io-page" key={`${direction}-${step}`}>
      {step === 0 && direction === 'export' && <><h3>{t('io.export.format')}</h3><div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => setExportFormat(format.id)}><strong>{format.title}</strong><span>{format.description}</span></button>)}</div><p className="io-hint">Choose a format for the exported data.</p></>}
      {step === 0 && direction === 'import' && <><h3>Source file</h3><button type="button" onClick={() => void chooseSource()}>Browse…</button>{sourceFile && <p>{sourceFile.name} · {formatBytes(sourceFile.size)} · {new Date(sourceFile.modified).toLocaleString()}</p>}<div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => { setImportFormat(format.id as ImportFormat); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()) }}><strong>{format.title}</strong><span>{format.description}</span></button>)}</div></>}
      {step === 1 && direction === 'export' && <><h3>{t('io.export.source.hint')}</h3><label className="io-wide">Source query <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={6} spellCheck={false} /></label><p>Export uses a read-only SELECT query.</p></>}
      {step === 1 && direction === 'import' && <><h3>Read options</h3>{importFormat === 'sql' ? <p role="note">Execute only trusted SQL files. This importer accepts INSERT statements.</p> : <Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={importFormat === 'csv'} />}{importFormat === 'xml' && <label>Row element <input value={rowElement} onChange={(event) => setRowElement(event.target.value)} /></label>}{sourceFile && <Preview sample={sample} label="Source preview · first rows" />}</>}
      {step === 2 && direction === 'export' && <><h3>Export options · {selectedFormatTitle}</h3><Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={exportFormat === 'csv'} /><label><input type="checkbox" checked={true} readOnly /> Open folder after export</label><p>Destination file is selected when export starts.</p></>}
      {step === 2 && direction === 'import' && <><h3>{t('io.import.target.hint')}</h3><label>Destination table <input value={table} onChange={(event) => setTable(event.target.value)} placeholder="table_name" /></label><p>Connection: {records.find((item) => item.id === connection)?.name ?? 'Select a connection above'}.</p></>}
      {step === 3 && direction === 'export' && <><h3>Columns</h3><p>Set the output column names. Enter the source columns as a comma-separated list.</p><label>Columns <input value={columnsText} onChange={(event) => updateColumns(event.target.value)} placeholder="id, name, created_at" /></label><Mapping mapping={mapping} setMapping={setMapping} /></>}
      {step === 3 && direction === 'import' && <><h3>Column mapping</h3><p>Auto-map by name. Clear a destination to ignore that source column.</p>{importFormat === 'sql' ? <p>SQL INSERT files carry their own column names and do not use column mapping.</p> : <><label>Source columns <input value={columnsText} onChange={(event) => updateColumns(event.target.value)} placeholder="Choose a file to detect columns" /></label><Mapping mapping={mapping} setMapping={setMapping} />{sample.length > 1 && <Preview sample={sample} label="Preview · first rows" />}</>}</>}
      {step === 4 && direction === 'export' && <><h3>Destination and preview</h3><p>Export data into a single file. The destination picker opens when export starts.</p><button type="button" onClick={() => void refreshPreview()}>Refresh preview</button><Preview sample={sample} label="Exported files preview · first 20 rows" /></>}
      {step === 4 && direction === 'import' && <><h3>{t('io.import.mode.hint')}</h3><label>Import mode <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}><option value="append">Append</option><option value="update">Update</option><option value="upsert">Append/Update</option><option value="delete">Delete</option></select></label>{mode !== 'append' && <label>Key columns <input value={keys} onChange={(event) => setKeys(event.target.value)} placeholder="id" /></label>}<label>Batch size <input type="number" value="500" readOnly /></label><label>{t('io.errors.title')} <select defaultValue="continue"><option value="abort">Abort at the first error</option><option value="continue">Ignore row errors and continue</option></select></label><p>Import is applied in a transaction.</p></>}
      {step === 5 && direction === 'import' && <><h3>Preview and validation</h3>{sourceFile ? <><p>{sample.length > 1 ? `${sample.length - 1} preview rows · ${columnsText.split(',').filter(Boolean).length} columns` : 'Preview is available for this format.'}</p><Preview sample={sample} label="Preview" /></> : <p>Select a source file to preview its first rows.</p>}<p>Rows are checked during import. Any row errors will be listed in the report.</p></>}
      {step === steps.length - 2 && <><h3>{direction === 'export' ? 'Ready to export' : 'Ready to import'}</h3><p>{direction === 'export' ? `Export ${query.trim() ? 'the selected query' : 'data'} as ${selectedFormatTitle}.` : `${sourceFile?.name ?? 'Selected file'} → ${table || 'destination table'} · ${mode}.`}</p><p>Click {direction === 'export' ? 'Export' : 'Import'} to choose the output or source file and begin.</p></>}
      {step === steps.length - 1 && <><h3>Report</h3><pre className="io-report" role="status">{report || 'No operation has run yet.'}</pre></>}
    </main>
    {templates.length > 0 && <div className="io-templates"><label>Load Template <select defaultValue="" onChange={(event) => { const item = templates.find((template) => template.id === event.target.value); if (item) loadTemplate(item) }}><option value="">Choose template…</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.direction}</option>)}</select></label>{templates.map((item) => <button type="button" aria-label={`Delete template ${item.name}`} title="Delete template" key={item.id} onClick={() => void deleteTemplate(item.id)}>× {item.name}</button>)}</div>}
    <footer className="io-footer"><div><button type="button" onClick={() => void saveTemplate()} disabled={busy}>Save Template…</button></div><div>{step > 0 && step < steps.length - 1 && <button type="button" onClick={() => setStep((current) => current - 1)} disabled={busy}>‹ Back</button>}{step < steps.length - 2 ? <button type="button" className="button-primary" onClick={() => setStep((current) => current + 1)} disabled={!canAdvance || busy}>Next ›</button> : step === steps.length - 2 ? <button type="button" className="button-primary" onClick={() => void run()} disabled={busy || !connection || (direction === 'export' ? !query.trim() : !table.trim() || !sourceFile)}>{busy ? 'Working…' : direction === 'export' ? 'Export' : 'Import'}</button> : <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setJobId(crypto.randomUUID()) }}>Close</button>}{busy ? <button type="button" onClick={() => void window.dbforge.cancelImportExport(jobId)}>Cancel</button> : step < steps.length - 1 && <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setSourceFile(null); setJobId(crypto.randomUUID()) }}>Cancel</button>}</div></footer>
    {progress && busy && <p role="status">{progress.phase === 'reading' ? `Importing: ${progress.rows} rows processed` : progress.phase === 'writing' ? `Exporting: ${progress.rows} rows · ${progress.bytes ?? 0} bytes` : `${progress.phase}: ${progress.rows} rows`}</p>}
    {message && <p className="io-message" role="status">{message}</p>}
    <style>{`.io-wizard{max-width:980px}.io-stepper{display:flex;gap:4px;overflow:auto;margin:20px 0}.io-stepper button{border:0;background:transparent;color:var(--muted,#777);display:flex;align-items:center;gap:7px;padding:8px;white-space:nowrap}.io-stepper button span{border:1px solid currentColor;border-radius:50%;width:22px;height:22px;display:inline-grid;place-items:center}.io-stepper button.current{color:var(--accent,#3774d6);font-weight:700}.io-stepper button.complete{color:var(--success,#25834a);cursor:pointer}.io-toolbar,.io-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.io-toolbar{padding:10px 0;border-block:1px solid var(--border,#888)}.io-toolbar label,.io-page>label,.io-page label{display:flex;gap:8px;align-items:center;margin:12px 0}.io-page{min-height:260px;padding:16px 0}.io-format-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.io-format-grid button{text-align:left;padding:14px;border:1px solid var(--border,#888);border-radius:6px;background:var(--surface,#fff);color:inherit;cursor:pointer}.io-format-grid button.selected{outline:2px solid var(--accent,#3774d6)}.io-format-grid span{display:block;margin-top:6px;color:var(--muted,#777)}.io-wide{display:block}.io-wide textarea{display:block;width:100%;font-family:monospace}.io-mapping{width:100%;border-collapse:collapse}.io-mapping th,.io-mapping td{text-align:left;padding:8px;border-bottom:1px solid var(--border,#888)}.io-preview,.io-report{max-height:240px;overflow:auto;padding:12px;background:var(--surface-raised,#f2f3f5);white-space:pre-wrap}.io-message{color:var(--status-error,#a32)}.io-footer{border-top:1px solid var(--border,#888);padding-top:14px}.io-footer>div{display:flex;gap:8px}`}</style>
  </section>
}

function Options({ delimiter, setDelimiter, quote, setQuote, header, setHeader, encoding, setEncoding, csv }: { delimiter: string; setDelimiter: (value: string) => void; quote: string; setQuote: (value: string) => void; header: boolean; setHeader: (value: boolean) => void; encoding: 'utf8' | 'utf16le' | 'latin1'; setEncoding: (value: 'utf8' | 'utf16le' | 'latin1') => void; csv: boolean }): React.JSX.Element {
  return <div className="io-options">{csv && <><label>Delimiter <select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=",">,</option><option value=";">;</option><option value="\t">Tab</option><option value="|">|</option></select></label><label>Quote char <input value={quote} maxLength={1} onChange={(event) => setQuote(event.target.value)} /></label><label><input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} /> Include column header</label></>}<label>Encoding <select value={encoding} onChange={(event) => setEncoding(event.target.value as 'utf8' | 'utf16le' | 'latin1')}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="latin1">Latin1</option></select></label>{csv && <label>Null String <input value="" readOnly placeholder="Empty" /></label>}</div>
}

function Mapping({ mapping, setMapping }: { mapping: Record<string, string>; setMapping: (value: Record<string, string>) => void }): React.JSX.Element {
  const entries = Object.entries(mapping)
  if (!entries.length) return <p>Choose columns to map. Source columns can be entered above.</p>
  return <table className="io-mapping"><thead><tr><th>Include</th><th>Source column</th><th>→</th><th>Destination column</th></tr></thead><tbody>{entries.map(([source, target]) => <tr key={source}><td><input type="checkbox" checked={Boolean(target)} aria-label={`Include ${source}`} onChange={(event) => setMapping({ ...mapping, [source]: event.target.checked ? source : '' })} /></td><td>{source}</td><td>→</td><td><input aria-label={`Destination for ${source}`} value={target} onChange={(event) => setMapping({ ...mapping, [source]: event.target.value })} /></td></tr>)}</tbody></table>
}

function Preview({ sample, label }: { sample: string[][]; label: string }): React.JSX.Element {
  return <section><h4>{label}</h4>{sample.length ? <div style={{ overflow: 'auto', maxHeight: 220 }}><table className="io-mapping"><tbody>{sample.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => rowIndex === 0 ? <th key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <p>No preview rows available for this format.</p>}</section>
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
