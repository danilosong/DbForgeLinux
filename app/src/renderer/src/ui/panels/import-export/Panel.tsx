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
  return <section className="tool-panel io-wizard" aria-label={t('panel.import.export.m4bdfe4744d')}>
    <h2>{t('panel.import.export.m05ba66e6cd')}</h2><p>{t('panel.import.export.ma34a200dba')}</p>
    <nav className="io-stepper" aria-label={t('panel.import.export.mabb6679b11')}>{steps.map((title, index) => <button type="button" key={title} className={index === step ? 'current' : index < step ? 'complete' : ''} onClick={() => index < step && setStep(index)} disabled={busy || index >= step} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{title}</button>)}</nav>
    {step !== steps.length - 1 && <div className="io-toolbar"><label>{t('panel.import.export.m23ad6f9599')} <select value={direction} disabled={busy} onChange={(event) => changeDirection(event.target.value as Direction)}><option value="export">{t('io.export.title')}</option><option value="import">{t('io.import.title')}</option></select></label><label>{t('panel.import.export.mb2d15b6cb0')} <select value={connection} disabled={busy} onChange={(event) => setConnection(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}{item.environment === 'prod' ? ' · Prod' : ''}</option>)}</select></label></div>}
    <main className="io-page" key={`${direction}-${step}`}>
      {step === 0 && direction === 'export' && <><h3>{t('io.export.format')}</h3><div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => setExportFormat(format.id)}><strong>{format.title}</strong><span>{format.description}</span></button>)}</div><p className="io-hint">{t('panel.import.export.m0ab2c5a405')}</p></>}
      {step === 0 && direction === 'import' && <><h3>{t('panel.import.export.m76d88b83fa')}</h3><button type="button" onClick={() => void chooseSource()}>{t('panel.import.export.m2b4e906f71')}</button>{sourceFile && <p>{sourceFile.name} · {formatBytes(sourceFile.size)} · {new Date(sourceFile.modified).toLocaleString()}</p>}<div className="io-format-grid">{formats.map((format) => <button type="button" key={format.id} className={selectedFormat === format.id ? 'selected' : ''} onClick={() => { setImportFormat(format.id as ImportFormat); setSourceFile(null); setSample([]); setJobId(crypto.randomUUID()) }}><strong>{format.title}</strong><span>{format.description}</span></button>)}</div></>}
      {step === 1 && direction === 'export' && <><h3>{t('io.export.source.hint')}</h3><label className="io-wide">{t('panel.import.export.m7bde9f9405')} <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={6} spellCheck={false} /></label><p>{t('panel.import.export.m3164ae8877')}</p></>}
      {step === 1 && direction === 'import' && <><h3>{t('panel.import.export.md1a4861a93')}</h3>{importFormat === 'sql' ? <p role="note">{t('panel.import.export.mebd16dd58d')}</p> : <Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={importFormat === 'csv'} />}{importFormat === 'xml' && <label>{t('panel.import.export.m477c4d576d')} <input value={rowElement} onChange={(event) => setRowElement(event.target.value)} /></label>}{sourceFile && <Preview sample={sample} label="Source preview · first rows" />}</>}
      {step === 2 && direction === 'export' && <><h3>{t('panel.import.export.m4e8c99d0bc')} {selectedFormatTitle}</h3><Options delimiter={delimiter} setDelimiter={setDelimiter} quote={quote} setQuote={setQuote} header={header} setHeader={setHeader} encoding={encoding} setEncoding={setEncoding} csv={exportFormat === 'csv'} /><label><input type="checkbox" checked={true} readOnly /> {t('panel.import.export.me1134bd403')}</label><p>{t('panel.import.export.m61c70a39ca')}</p></>}
      {step === 2 && direction === 'import' && <><h3>{t('io.import.target.hint')}</h3><label>{t('panel.import.export.m34ae80ec1b')} <input value={table} onChange={(event) => setTable(event.target.value)} placeholder={t('panel.import.export.m28b250e0aa')} /></label><p>{t('panel.import.export.m19fd8d3ae9')} {records.find((item) => item.id === connection)?.name ?? 'Select a connection above'}.</p></>}
      {step === 3 && direction === 'export' && <><h3>{t('tbl.page.columns')}</h3><p>{t('panel.import.export.m9bb4f7c2ba')}</p><label>{t('tbl.page.columns')} <input value={columnsText} onChange={(event) => updateColumns(event.target.value)} placeholder={t('panel.import.export.ma658dcdab4')} /></label><Mapping mapping={mapping} setMapping={setMapping} /></>}
      {step === 3 && direction === 'import' && <><h3>{t('panel.import.export.m763ce4cf9c')}</h3><p>{t('panel.import.export.mb751db47db')}</p>{importFormat === 'sql' ? <p>{t('panel.import.export.m9a878d506a')}</p> : <><label>{t('panel.import.export.m1f425accfa')} <input value={columnsText} onChange={(event) => updateColumns(event.target.value)} placeholder={t('panel.import.export.m181a09d467')} /></label><Mapping mapping={mapping} setMapping={setMapping} />{sample.length > 1 && <Preview sample={sample} label="Preview · first rows" />}</>}</>}
      {step === 4 && direction === 'export' && <><h3>{t('panel.import.export.m32fc0fcc4b')}</h3><p>{t('panel.import.export.me7d00aeee0')}</p><button type="button" onClick={() => void refreshPreview()}>{t('panel.import.export.m6ba76f777b')}</button><Preview sample={sample} label="Exported files preview · first 20 rows" /></>}
      {step === 4 && direction === 'import' && <><h3>{t('io.import.mode.hint')}</h3><label>{t('panel.import.export.m30d1fd14cd')} <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}><option value="append">{t('panel.import.export.mcb1fefe3b9')}</option><option value="update">{t('panel.import.export.m1bfe76b21a')}</option><option value="upsert">{t('panel.import.export.mae30dd2f13')}</option><option value="delete">{t('panel.import.export.m1ef03fb31d')}</option></select></label>{mode !== 'append' && <label>{t('panel.import.export.me6a2226e5d')} <input value={keys} onChange={(event) => setKeys(event.target.value)} placeholder={t('panel.import.export.ma98a7d7c7b')} /></label>}<label>{t('panel.import.export.m79ed6ba15c')} <input type="number" value="500" readOnly /></label><label>{t('io.errors.title')} <select defaultValue="continue"><option value="abort">{t('panel.import.export.ma6af951db3')}</option><option value="continue">{t('panel.import.export.m77bc2a89d8')}</option></select></label><p>{t('panel.import.export.mcc380f64c9')}</p></>}
      {step === 5 && direction === 'import' && <><h3>{t('panel.import.export.m6416fe507b')}</h3>{sourceFile ? <><p>{sample.length > 1 ? `${sample.length - 1} preview rows · ${columnsText.split(',').filter(Boolean).length} columns` : 'Preview is available for this format.'}</p><Preview sample={sample} label="Preview" /></> : <p>{t('panel.import.export.m0583f0764b')}</p>}<p>{t('panel.import.export.mb611daef59')}</p></>}
      {step === steps.length - 2 && <><h3>{direction === 'export' ? 'Ready to export' : 'Ready to import'}</h3><p>{direction === 'export' ? `Export ${query.trim() ? 'the selected query' : 'data'} as ${selectedFormatTitle}.` : `${sourceFile?.name ?? 'Selected file'} → ${table || 'destination table'} · ${mode}.`}</p><p>{t('panel.import.export.mca128259eb')} {direction === 'export' ? 'Export' : 'Import'} {t('panel.import.export.m7d6b5badc4')}</p></>}
      {step === steps.length - 1 && <><h3>{t('panel.import.export.mb5c5405fcc')}</h3><pre className="io-report" role="status">{report || 'No operation has run yet.'}</pre></>}
    </main>
    {templates.length > 0 && <div className="io-templates"><label>{t('panel.import.export.me16fe4b9f2')} <select defaultValue="" onChange={(event) => { const item = templates.find((template) => template.id === event.target.value); if (item) loadTemplate(item) }}><option value="">{t('panel.import.export.mf953f535f3')}</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.direction}</option>)}</select></label>{templates.map((item) => <button type="button" aria-label={`Delete template ${item.name}`} title={t('panel.import.export.m333d0ddce5')} key={item.id} onClick={() => void deleteTemplate(item.id)}>× {item.name}</button>)}</div>}
    <footer className="io-footer"><div><button type="button" onClick={() => void saveTemplate()} disabled={busy}>{t('panel.import.export.m6b8f437d0d')}</button></div><div>{step > 0 && step < steps.length - 1 && <button type="button" onClick={() => setStep((current) => current - 1)} disabled={busy}>{t('panel.import.export.m631bf5f93f')}</button>}{step < steps.length - 2 ? <button type="button" className="button-primary" onClick={() => setStep((current) => current + 1)} disabled={!canAdvance || busy}>{t('panel.import.export.m73136aa4bd')}</button> : step === steps.length - 2 ? <button type="button" className="button-primary" onClick={() => void run()} disabled={busy || !connection || (direction === 'export' ? !query.trim() : !table.trim() || !sourceFile)}>{busy ? 'Working…' : direction === 'export' ? 'Export' : 'Import'}</button> : <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setJobId(crypto.randomUUID()) }}>{t('panel.import.export.m1795ee1801')}</button>}{busy ? <button type="button" onClick={() => void window.dbforge.cancelImportExport(jobId)}>{t('common.cancel')}</button> : step < steps.length - 1 && <button type="button" onClick={() => { setStep(0); setReport(''); setMessage(''); setSourceFile(null); setJobId(crypto.randomUUID()) }}>{t('common.cancel')}</button>}</div></footer>
    {progress && busy && <p role="status">{progress.phase === 'reading' ? `Importing: ${progress.rows} rows processed` : progress.phase === 'writing' ? `Exporting: ${progress.rows} rows · ${progress.bytes ?? 0} bytes` : `${progress.phase}: ${progress.rows} rows`}</p>}
    {message && <p className="io-message" role="status">{message}</p>}
    <style>{`.io-wizard{max-width:980px}.io-stepper{display:flex;gap:4px;overflow:auto;margin:20px 0}.io-stepper button{border:0;background:transparent;color:var(--muted,#777);display:flex;align-items:center;gap:7px;padding:8px;white-space:nowrap}.io-stepper button span{border:1px solid currentColor;border-radius:50%;width:22px;height:22px;display:inline-grid;place-items:center}.io-stepper button.current{color:var(--accent,#3774d6);font-weight:700}.io-stepper button.complete{color:var(--success,#25834a);cursor:pointer}.io-toolbar,.io-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.io-toolbar{padding:10px 0;border-block:1px solid var(--border,#888)}.io-toolbar label,.io-page>label,.io-page label{display:flex;gap:8px;align-items:center;margin:12px 0}.io-page{min-height:260px;padding:16px 0}.io-format-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.io-format-grid button{text-align:left;padding:14px;border:1px solid var(--border,#888);border-radius:6px;background:var(--surface,#fff);color:inherit;cursor:pointer}.io-format-grid button.selected{outline:2px solid var(--accent,#3774d6)}.io-format-grid span{display:block;margin-top:6px;color:var(--muted,#777)}.io-wide{display:block}.io-wide textarea{display:block;width:100%;font-family:monospace}.io-mapping{width:100%;border-collapse:collapse}.io-mapping th,.io-mapping td{text-align:left;padding:8px;border-bottom:1px solid var(--border,#888)}.io-preview,.io-report{max-height:240px;overflow:auto;padding:12px;background:var(--surface-raised,#f2f3f5);white-space:pre-wrap}.io-message{color:var(--status-error,#a32)}.io-footer{border-top:1px solid var(--border,#888);padding-top:14px}.io-footer>div{display:flex;gap:8px}`}</style>
  </section>
}

function Options({ delimiter, setDelimiter, quote, setQuote, header, setHeader, encoding, setEncoding, csv }: { delimiter: string; setDelimiter: (value: string) => void; quote: string; setQuote: (value: string) => void; header: boolean; setHeader: (value: boolean) => void; encoding: 'utf8' | 'utf16le' | 'latin1'; setEncoding: (value: 'utf8' | 'utf16le' | 'latin1') => void; csv: boolean }): React.JSX.Element {
  const { t } = useI18n()
  return <div className="io-options">{csv && <><label>{t('panel.import.export.m765fd256a4')} <select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=",">,</option><option value=";">;</option><option value="\t">{t('panel.import.export.m07bccaade0')}</option><option value="|">|</option></select></label><label>{t('panel.import.export.mecfc0f1b07')} <input value={quote} maxLength={1} onChange={(event) => setQuote(event.target.value)} /></label><label><input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} /> {t('panel.import.export.ma6f498bdcd')}</label></>}<label>{t('panel.import.export.m3a81a30ecd')} <select value={encoding} onChange={(event) => setEncoding(event.target.value as 'utf8' | 'utf16le' | 'latin1')}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="latin1">{t('panel.import.export.mc8dac03d1f')}</option></select></label>{csv && <label>{t('panel.import.export.mbbbe242138')} <input value="" readOnly placeholder={t('panel.import.export.m5dc1f864c5')} /></label>}</div>
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
