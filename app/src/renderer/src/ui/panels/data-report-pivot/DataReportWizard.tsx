import { useEffect, useRef, useState } from 'react'
import { activeSessionForSavedProfile, validateWizardResult, type DataReportWizardResult, type WizardLayout, type WizardOrientation, type WizardReportType, type WizardStyle } from '../../../../../modules/data-report-pivot/wizard.js'
import { usePanelConnection } from '../registry.js'
import type { ConnectionRecord } from '../../../../../shared/contracts/connections.js'

type SourceKind = 'table' | 'query'
const steps = ['Report type', 'Data connection', 'Table or query', 'Columns', 'Grouping', 'Layout', 'Style', 'Title']
const quote = (identifier: string): string => `\`${identifier.replaceAll('`', '``')}\``

export default function DataReportWizard({ onFinish, onCancel }: { onFinish: (result: DataReportWizardResult) => void; onCancel: () => void }): React.JSX.Element {
  const activeConnection = usePanelConnection()
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [connectionRecordId, setConnectionRecordId] = useState('')
  const [step, setStep] = useState(0)
  const [connectionId, setConnectionId] = useState('')
  const [database, setDatabase] = useState('')
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [table, setTable] = useState('')
  const [sourceKind, setSourceKind] = useState<SourceKind>('table')
  const [query, setQuery] = useState('')
  const [available, setAvailable] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [selectedAvailable, setSelectedAvailable] = useState<string[]>([])
  const [grouping, setGrouping] = useState<string[]>([])
  const [reportType, setReportType] = useState<WizardReportType>('standard')
  const [layout, setLayout] = useState<WizardLayout>('columnar')
  const [orientation, setOrientation] = useState<WizardOrientation>('portrait')
  const [fitPage, setFitPage] = useState(true)
  const [style, setStyle] = useState<WizardStyle>('Aurora')
  const [title, setTitle] = useState('TuxSQL Report')
  const [message, setMessage] = useState('')
  const ownedSessionId = useRef('')
  const handoffSession = useRef(false)

  useEffect(() => () => { if (ownedSessionId.current && !handoffSession.current) void window.tuxsql.disconnect(ownedSessionId.current) }, [])

  useEffect(() => {
    let cancelled = false
    void window.tuxsql.getConnections().then((items) => {
      if (cancelled) return
      setConnections(items)
      const selected = items.find((item) => item.id === activeConnection?.recordId) ?? items[0]
      setConnectionRecordId(selected?.id ?? '')
      if (selected) setConnectionId(activeSessionForSavedProfile(selected.id, activeConnection))
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not load saved connections.') })
    return () => { cancelled = true }
  }, [activeConnection])
  useEffect(() => {
    const activeSession = activeSessionForSavedProfile(connectionRecordId, activeConnection)
    if (activeSession) {
      setConnectionId(activeSession)
      setDatabase(activeConnection?.database ?? '')
    } else {
      setConnectionId('')
      setDatabases([]); setTables([]); setDatabase(''); setTable('')
    }
  }, [connectionRecordId, activeConnection])
  useEffect(() => {
    if (!connectionId) { setDatabases([]); setDatabase(''); return }
    void window.tuxsql.listDatabases(connectionId).then((items) => { setDatabases(items); setDatabase((current) => items.includes(current) ? current : activeConnection?.database && items.includes(activeConnection.database) ? activeConnection.database : items[0] ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load databases.'))
  }, [connectionId, activeConnection?.database])
  useEffect(() => {
    if (!connectionId || !database) { setTables([]); return }
    void window.tuxsql.listTables(connectionId, database).then((items) => { setTables(items); setTable((current) => items.includes(current) ? current : items[0] ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load tables.'))
  }, [connectionId, database])
  useEffect(() => {
    if (step !== 3 || !connectionId || !query) return
    let cancelled = false
    void window.tuxsql.loadReportQuery(connectionId, query).then((loaded) => {
      if (cancelled) return
      setAvailable(loaded.columns)
      setSelectedColumns((current) => current.filter((field) => loaded.columns.includes(field)))
      setMessage('')
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not read source columns.') })
    return () => { cancelled = true }
  }, [step, connectionId, query])

  function move(direction: 'right' | 'all-right' | 'left' | 'all-left'): void {
    if (direction === 'right') { setSelectedColumns((current) => [...current, ...selectedAvailable.filter((item) => !current.includes(item))]); setSelectedAvailable([]) }
    if (direction === 'all-right') { setSelectedColumns((current) => [...current, ...available.filter((item) => !current.includes(item))]); setSelectedAvailable([]) }
    if (direction === 'left') { setSelectedColumns((current) => current.filter((item) => !selectedAvailable.includes(item))); setSelectedAvailable([]) }
    if (direction === 'all-left') { setSelectedColumns([]); setSelectedAvailable([]) }
  }
  function reorder(field: string, delta: number): void { setGrouping((current) => { const index = current.indexOf(field); const target = Math.max(0, Math.min(current.length - 1, index + delta)); if (index < 0 || target === index) return current; const next = [...current]; next.splice(index, 1); next.splice(target, 0, field); return next }) }
  function next(): void {
    setMessage('')
    if (step === 1 && reportType !== 'blank' && !connectionId) { setMessage('Choose a connection to continue.'); return }
    if (step === 2) {
      if (reportType === 'blank') { setQuery(''); setAvailable([]); setSelectedColumns([]) }
      else if (sourceKind === 'table') {
        if (!table) { setMessage('Choose a table or view.'); return }
        setQuery(`SELECT * FROM ${quote(database)}.${quote(table)}`)
      } else if (!/^\s*SELECT\b/i.test(query)) { setMessage('Enter one read-only SELECT query.'); return }
    }
    if (step < 7) setStep((current) => current + 1)
  }
  async function connectSelected(): Promise<void> {
    const record = connections.find((item) => item.id === connectionRecordId)
    if (!record) return
    setMessage('Connecting…')
    try {
      if (ownedSessionId.current) { await window.tuxsql.disconnect(ownedSessionId.current); ownedSessionId.current = '' }
      const connected = await window.tuxsql.connect(record)
      if (connected.id !== activeConnection?.id) ownedSessionId.current = connected.id
      setConnectionId(connected.id); setDatabase(connected.database ?? record.database ?? '')
      setMessage(`Connected to ${connected.name}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect to the selected profile.') }
  }
  function finish(): void {
    const sourceQuery = reportType === 'blank' ? '' : sourceKind === 'table' ? `SELECT ${selectedColumns.length ? selectedColumns.map(quote).join(', ') : '*'} FROM ${quote(database)}.${quote(table)}` : query
    try { const result = validateWizardResult({ reportType, connectionId, connectionRecordId, database, query: sourceQuery, columns: reportType === 'blank' ? [] : selectedColumns, grouping, layout, orientation, fitPage, style, title }); handoffSession.current = true; onFinish(result) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Check the report setup.') }
  }

  return <section className="rp-wizard" data-testid="data-report-wizard" aria-label="Data Report Wizard">
    <header><div><h2>Data Report Wizard</h2><p>Step {step + 1} of 8 · {steps[step]}</p></div><button onClick={() => { const sessionId = ownedSessionId.current; ownedSessionId.current = ''; if (sessionId) void window.tuxsql.disconnect(sessionId); onCancel() }}>Cancel</button></header>
    <nav aria-label="Wizard progress">{steps.map((label, index) => <span key={label} aria-current={index === step ? 'step' : undefined}>{index + 1}. {label}</span>)}</nav>
    <main>
      {step === 0 && <fieldset><legend>Choose a report type</legend>{([['standard', 'Standard'], ['label', 'Label'], ['blank', 'Blank']] as const).map(([value, label]) => <label key={value}><input type="radio" name="report-type" checked={reportType === value} onChange={() => setReportType(value)} />{label}</label>)}</fieldset>}
      {step === 1 && <fieldset><legend>Choose a data connection</legend><label>Saved connection <select aria-label="Saved connection" value={connectionRecordId} onChange={(event) => { setConnectionRecordId(event.target.value); setMessage('') }}><option value="">Choose a saved connection</option>{connections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.host}:{item.port}</option>)}</select></label>{connectionRecordId && connectionRecordId !== activeConnection?.recordId && !connectionId && <button onClick={() => void connectSelected()}>Connect selected connection</button>}<label>Database <select aria-label="Database" disabled={!connectionId} value={database} onChange={(event) => setDatabase(event.target.value)}>{databases.map((item) => <option key={item}>{item}</option>)}</select></label>{connectionId && <p>Connected session ready. Selecting a saved profile does not connect until you choose Connect.</p>}</fieldset>}
      {step === 2 && <fieldset><legend>Choose a table/view or custom query</legend><label><input type="radio" name="source" checked={sourceKind === 'table'} onChange={() => setSourceKind('table')} />Table or view</label><select aria-label="Table or view" value={table} onChange={(event) => setTable(event.target.value)}>{tables.map((item) => <option key={item}>{item}</option>)}</select><label><input type="radio" name="source" checked={sourceKind === 'query'} onChange={() => setSourceKind('query')} />Custom query</label><textarea aria-label="Custom SELECT query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SELECT ..." rows={5} /></fieldset>}
      {step === 3 && <fieldset><legend>Choose columns</legend><div className="rp-wizard-transfer"><select aria-label="Available columns" multiple value={selectedAvailable} onChange={(event) => setSelectedAvailable(Array.from(event.target.selectedOptions, (option) => option.value))}>{available.filter((field) => !selectedColumns.includes(field)).map((field) => <option key={field}>{field}</option>)}</select><div><button onClick={() => move('right')} aria-label="Add selected">&gt;</button><button onClick={() => move('all-right')} aria-label="Add all">&gt;&gt;</button><button onClick={() => move('left')} aria-label="Remove selected">&lt;</button><button onClick={() => move('all-left')} aria-label="Remove all">&lt;&lt;</button></div><select aria-label="Report columns" multiple value={selectedColumns} onChange={(event) => setSelectedColumns(Array.from(event.target.selectedOptions, (option) => option.value))}>{selectedColumns.map((field) => <option key={field}>{field}</option>)}</select></div><p>Columns are read from the selected source using a read-only query.</p></fieldset>}
      {step === 4 && <fieldset><legend>Set grouping priority</legend><p>Move selected report columns into the ordered grouping list.</p><select aria-label="Groupable columns" multiple value={selectedAvailable} onChange={(event) => setSelectedAvailable(Array.from(event.target.selectedOptions, (option) => option.value))}>{selectedColumns.map((field) => <option key={field}>{field}</option>)}</select><button onClick={() => setGrouping((current) => [...current, ...selectedAvailable.filter((field) => !current.includes(field))])}>Add grouping</button><ol>{grouping.map((field) => <li key={field}>{field}<button onClick={() => reorder(field, -1)} aria-label={`Move ${field} up`}>↑</button><button onClick={() => reorder(field, 1)} aria-label={`Move ${field} down`}>↓</button><button onClick={() => setGrouping((current) => current.filter((item) => item !== field))}>Remove</button></li>)}</ol></fieldset>}
      {step === 5 && <fieldset><legend>Layout and orientation</legend><label>Layout <select value={layout} onChange={(event) => setLayout(event.target.value as WizardLayout)}><option value="columnar">Columnar</option><option value="tabular">Tabular</option><option value="justified">Justified</option></select></label><label>Orientation <select value={orientation} onChange={(event) => setOrientation(event.target.value as WizardOrientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label><input type="checkbox" checked={fitPage} onChange={(event) => setFitPage(event.target.checked)} />Fit fields to page</label></fieldset>}
      {step === 6 && <fieldset><legend>Choose a style</legend>{(['Aurora', 'Slate', 'Cedar', 'Ocean', 'Ember'] as const).map((item) => <label key={item}><input type="radio" name="report-style" checked={style === item} onChange={() => setStyle(item)} />{item}</label>)}</fieldset>}
      {step === 7 && <fieldset><legend>Title and finish</legend><label>Report title <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label><p>The report opens in the designer after you finish.</p></fieldset>}
    </main>
    <p role="status">{message}</p><footer><button disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Back</button>{step < 7 ? <button disabled={step === 1 && reportType !== 'blank' && !connectionId} onClick={next}>Next</button> : <button onClick={finish}>Finish</button>}</footer>
    <style>{`.rp-wizard{display:flex;flex-direction:column;gap:14px;max-width:900px;margin:auto;padding:18px;color:var(--text)}.rp-wizard header,.rp-wizard footer{display:flex;justify-content:space-between;align-items:center}.rp-wizard h2{margin:0}.rp-wizard nav{display:flex;gap:8px;flex-wrap:wrap}.rp-wizard nav span{padding:5px 8px;border:1px solid var(--border);border-radius:14px}.rp-wizard nav [aria-current=step]{border-color:var(--accent);background:var(--accent-soft)}.rp-wizard main{min-height:260px}.rp-wizard fieldset{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:18px;border:1px solid var(--border);border-radius:6px}.rp-wizard legend{font-weight:600}.rp-wizard label{display:flex;align-items:center;gap:7px}.rp-wizard textarea{width:100%;background:var(--bg-surface);color:var(--text)}.rp-wizard-transfer{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;width:100%;min-height:160px}.rp-wizard-transfer select{min-height:150px}.rp-wizard-transfer div{display:flex;flex-direction:column;gap:5px;justify-content:center}.rp-wizard ol li{margin:8px 0}.rp-wizard ol button{margin-left:8px}`}</style>
  </section>
}
