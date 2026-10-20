import { useEffect, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { ExportFormat, ImportFormat, ImportMode } from '../../../../../modules/data-export-import/types.js'

export default function Panel(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [connection, setConnection] = useState('')
  const [query, setQuery] = useState('SELECT * FROM `table_name` LIMIT 1000'); const [table, setTable] = useState('')
  const [direction, setDirection] = useState<'export' | 'import'>('export'); const [exportFormat, setExportFormat] = useState<ExportFormat>('csv'); const [importFormat, setImportFormat] = useState<ImportFormat>('csv')
  const [mode, setMode] = useState<ImportMode>('append'); const [keys, setKeys] = useState('id'); const [delimiter, setDelimiter] = useState(','); const [header, setHeader] = useState(true)
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); setConnection(items[0]?.id ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [])
  async function run(): Promise<void> {
    const record = records.find((item) => item.id === connection); if (!record) { setMessage('Selecione uma conexão.'); return }
    if (direction === 'import' && !window.confirm(`Importação de dados\nAplicar arquivo selecionado em ${table || '(tabela não definida)'} usando o modo ${mode}?`)) return
    setBusy(true); setMessage(direction === 'export' ? 'Exporting…' : 'Importing…')
    let connectedId = ''
    try {
      const connected = await window.dbforge.connect(record); connectedId = connected.id
      if (direction === 'export') {
        const saved = await window.dbforge.exportData(connectedId, query, exportFormat, { delimiter, header })
        setMessage(`Data Export finished successfully. ${saved.report.rows} rows exported · ${saved.path}`)
      } else {
        const keyColumns = keys.split(',').map((value) => value.trim()).filter(Boolean)
        const report = await window.dbforge.importData(connectedId, table, importFormat, mode, keyColumns, { delimiter, header, onRowError: 'abort' })
        setMessage(`${report.inserted} inseridas · ${report.updated} atualizadas · ${report.deleted} excluídas · ${report.errors} erros.`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : direction === 'export' ? 'Data export failed.' : 'Data Import failed.') }
    finally { if (connectedId) void window.dbforge.disconnect(connectedId); setBusy(false) }
  }
  return <section className="tool-panel"><h2>⇧ Import / Export</h2><p>Wizards para importar ou exportar dados. Senhas não são incluídas em arquivos.</p>
    <label>Connection <select value={connection} onChange={(event) => setConnection(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}{item.environment === 'prod' ? ' · Prod' : ''}</option>)}</select></label>
    <label>Operation <select value={direction} onChange={(event) => setDirection(event.target.value as 'export' | 'import')}><option value="export">Data Export Wizard</option><option value="import">Data Import from</option></select></label>
    {direction === 'export' ? <>
      <label>Export format <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>{(['csv', 'json', 'xml', 'sql', 'xlsx', 'html'] as ExportFormat[]).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
      <label>Source query <textarea value={query} onChange={(event) => setQuery(event.target.value)} style={{ display: 'block', width: '100%', minHeight: 100, fontFamily: 'monospace' }} /></label>
      {exportFormat === 'csv' && <><label>Delimiter <select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=",">,</option><option value=";">;</option><option value="\t">Tab</option><option value="|">|</option></select></label><label><input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} /> Include column header</label></>}
    </> : <>
      <label>Import format <select value={importFormat} onChange={(event) => setImportFormat(event.target.value as ImportFormat)}>{(['csv', 'json', 'xlsx', 'sql'] as ImportFormat[]).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
      <label>Destination table <input value={table} onChange={(event) => setTable(event.target.value)} /></label>
      {importFormat === 'csv' && <><label>Delimiter <select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=",">,</option><option value=";">;</option><option value="\t">Tab</option><option value="|">|</option></select></label><label><input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} /> Header in first row</label></>}
      {importFormat !== 'sql' && <><p>Choose a destination table for import.</p><label>Import mode <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}><option value="append">Append</option><option value="update">Update</option><option value="upsert">Append/Update</option><option value="delete">Delete</option></select></label><p>Choose an import mode.</p>{mode !== 'append' && <label>Comparison Key <input value={keys} onChange={(event) => setKeys(event.target.value)} placeholder="id" /></label>}</>}
      {importFormat === 'sql' && <p role="note">Scripts SQL são restritos a INSERT ... VALUES. Execute apenas scripts confiáveis.</p>}
    </>}
    <button className="button-primary" onClick={() => void run()} disabled={busy || !records.length}>{direction === 'export' ? 'Export' : 'Import'}</button><p role="status">{message}</p>
  </section>
}
