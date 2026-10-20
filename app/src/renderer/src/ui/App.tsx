import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { ConnectionRecord, ConnectionSummary, ConnectionTestResult, QueryResult } from '../../../shared/contracts'
import { createDefaultConnection } from '../../../shared/connectionDefaults'
import { Button } from './components/Button'
import { ConnectionManager } from './components/ConnectionManager'
import { ConnectionPropertiesDialog, type ConnectionAction, type ConnectionSecrets } from './components/ConnectionPropertiesDialog'
import { DatabaseExplorer } from './components/DatabaseExplorer'

type ThemeMode = 'auto' | 'light' | 'dark'
type DocumentTab = { id: string; label: string; modified: boolean }
type OutputEntry = { timestamp: string; origin: string; message: string; tone: string }

export default function App(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [active, setActive] = useState<ConnectionSummary[]>([])
  const [databases, setDatabases] = useState<Record<string, string[]>>({})
  const [tables, setTables] = useState<Record<string, string[]>>({})
  const [connecting, setConnecting] = useState<string[]>([])
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({})
  const [dialogRecord, setDialogRecord] = useState<ConnectionRecord | null>(null)
  const [newDialog, setNewDialog] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('dbforge.theme') as ThemeMode | null) ?? 'auto')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [explorerVisible, setExplorerVisible] = useState(() => localStorage.getItem('dbforge.explorerVisible') !== 'false')
  const [panelVisible, setPanelVisible] = useState(() => localStorage.getItem('dbforge.panelVisible') !== 'false')
  const [explorerWidth, setExplorerWidth] = useState(() => Number(localStorage.getItem('dbforge.explorerWidth')) || 280)
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('dbforge.panelHeight')) || 200)
  const [panelTab, setPanelTab] = useState<'Output' | 'Error List'>('Output')
  const [documents, setDocuments] = useState<DocumentTab[]>(readStoredDocuments)
  const [selectedDocument, setSelectedDocument] = useState(() => localStorage.getItem('dbforge.selectedDocument') ?? 'start')
  const [sqlByDocument, setSqlByDocument] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('dbforge.sqlDrafts') ?? '{}') as Record<string, string> }
    catch { return {} }
  })
  const [results, setResults] = useState<QueryResult[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState('Ready')
  const [output, setOutput] = useState<OutputEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const theme = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode
  const currentConnection = active[0]
  const currentRecord = records.find((record) => record.id === currentConnection?.recordId)
  const activeSql = selectedDocument !== 'start'

  useEffect(() => {
    void loadConnections()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('dbforge.theme', themeMode)
  }, [theme, themeMode])

  useEffect(() => { localStorage.setItem('dbforge.explorerVisible', String(explorerVisible)) }, [explorerVisible])
  useEffect(() => { localStorage.setItem('dbforge.panelVisible', String(panelVisible)) }, [panelVisible])
  useEffect(() => { localStorage.setItem('dbforge.explorerWidth', String(explorerWidth)) }, [explorerWidth])
  useEffect(() => { localStorage.setItem('dbforge.panelHeight', String(panelHeight)) }, [panelHeight])
  useEffect(() => { localStorage.setItem('dbforge.documents', JSON.stringify(documents)) }, [documents])
  useEffect(() => { localStorage.setItem('dbforge.selectedDocument', selectedDocument) }, [selectedDocument])
  useEffect(() => { localStorage.setItem('dbforge.sqlDrafts', JSON.stringify(sqlByDocument)) }, [sqlByDocument])

  async function loadConnections(): Promise<void> {
    try { setRecords(await window.dbforge.getConnections()); setLoadError('') }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Não foi possível ler as conexões.') }
  }

  function log(origin: string, message: string, tone = 'info'): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setOutput((current) => [...current, { timestamp, origin, message: maskSecrets(message), tone }].slice(-500))
  }

  function openNewConnection(): void {
    setDialogRecord(createDefaultConnection(crypto.randomUUID(), 'root@localhost'))
    setNewDialog(true)
  }

  function openEdit(record: ConnectionRecord): void {
    setDialogRecord(structuredClone(record))
    setNewDialog(false)
  }

  function upsertRecord(record: ConnectionRecord): void {
    setRecords((current) => [...current.filter((item) => item.id !== record.id), record])
  }

  async function runConnectionAction(record: ConnectionRecord, secrets: ConnectionSecrets, remember: boolean, action: ConnectionAction): Promise<ConnectionTestResult | void> {
    const ephemeral: string[] = []
    const requestRecord = structuredClone(record)
    const storedRecord = structuredClone(record)
    try {
      const fields: Array<{ value: string; path: (value: string | undefined) => void }> = [
        { value: secrets.password, path: (ref) => { requestRecord.passwordRef = ref; if (remember) storedRecord.passwordRef = ref } },
        { value: secrets.sshPassword, path: (ref) => { requestRecord.ssh.passwordRef = ref; if (remember) storedRecord.ssh.passwordRef = ref } },
        { value: secrets.sshPassphrase, path: (ref) => { requestRecord.ssh.passphraseRef = ref; if (remember) storedRecord.ssh.passphraseRef = ref } },
        { value: secrets.httpPassword, path: (ref) => { requestRecord.http.passwordRef = ref; if (remember) storedRecord.http.passwordRef = ref } },
        { value: secrets.proxyPassword, path: (ref) => { requestRecord.http.proxyPasswordRef = ref; if (remember) storedRecord.http.proxyPasswordRef = ref } }
      ]
      for (const field of fields) {
        if (!field.value) continue
        if (action === 'save' && !remember) continue
        const persistSecret = remember && action !== 'test'
        const reference = persistSecret ? crypto.randomUUID() : `temporary-${crypto.randomUUID()}`
        await window.dbforge.savePassword(reference, field.value)
        field.path(reference)
        if (!persistSecret) ephemeral.push(reference)
      }
      if (action === 'save') {
        await window.dbforge.saveConnection(storedRecord)
        upsertRecord(storedRecord)
        log('Connections', `Conexão "${storedRecord.name}" salva.`, 'success')
        setDialogRecord(null)
        return
      }
      if (action === 'test') return await window.dbforge.testConnection(requestRecord)

      await window.dbforge.saveConnection(storedRecord)
      const connectingId = record.id
      setConnecting((current) => [...new Set([...current, connectingId])])
      setConnectionErrors((current) => ({ ...current, [record.id]: '' }))
      setStatus('Connecting…')
      try {
        const connected = await window.dbforge.connect(requestRecord)
        const updated = { ...storedRecord, lastUsedAt: new Date().toISOString() }
        await window.dbforge.saveConnection(updated)
        upsertRecord(updated)
        setActive((current) => [...current.filter((item) => item.recordId !== record.id), connected])
        const found = await window.dbforge.listDatabases(connected.id)
        setDatabases((current) => ({ ...current, [record.id]: found }))
        setConnectionErrors((current) => ({ ...current, [record.id]: '' }))
        setStatus('Ready')
        log('Connections', `Conectado a ${record.name} · ${record.type.toUpperCase()}.`, 'success')
        setDialogRecord(null)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha na conexão.'
        setConnectionErrors((current) => ({ ...current, [record.id]: message }))
        setErrors((current) => [...current, message])
        setStatus('Error')
        log('Connections', message, 'error')
        throw error
      } finally {
        setConnecting((current) => current.filter((id) => id !== connectingId))
      }
    } finally {
      for (const reference of ephemeral) await window.dbforge.deletePassword(reference)
    }
  }

  async function connectFromExplorer(record: ConnectionRecord): Promise<void> {
    const needsCredential = (!record.passwordRef && !record.ssh.passwordRef && record.ssh.enabled && record.ssh.authMethod === 'password') || (!record.passwordRef && !record.ssh.enabled)
    if (needsCredential) { openEdit(record); return }
    try { await runConnectionAction(record, emptySecrets(), true, 'connect') }
    catch { /* The Explorer displays the sanitized connection error. */ }
  }

  async function disconnect(connection: ConnectionSummary): Promise<void> {
    await window.dbforge.disconnect(connection.id)
    setActive((current) => current.filter((item) => item.id !== connection.id))
    setDatabases((current) => { const next = { ...current }; delete next[connection.recordId]; return next })
    setStatus('Ready')
    log('Connections', `Desconectado de ${connection.name}.`)
  }

  async function expandRecord(record: ConnectionRecord): Promise<void> {
    const connected = active.find((item) => item.recordId === record.id)
    if (!connected) return
    try {
      const found = await window.dbforge.listDatabases(connected.id)
      setDatabases((current) => ({ ...current, [record.id]: found }))
      for (const database of found) {
        const foundTables = await window.dbforge.listTables(connected.id, database)
        setTables((current) => ({ ...current, [`${record.id}:${database}`]: foundTables }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar o Explorer.'
      setConnectionErrors((current) => ({ ...current, [record.id]: message }))
      log('Connections', message, 'error')
    }
  }

  async function deleteRecords(selected: ConnectionRecord[]): Promise<void> {
    for (const record of selected) {
      const connected = active.find((item) => item.recordId === record.id)
      if (connected) await disconnect(connected)
      await window.dbforge.deleteConnection(record.id)
    }
    setRecords((current) => current.filter((record) => !selected.some((deleted) => deleted.id === record.id)))
    log('Connections', `${selected.length} conexão(ões) removida(s).`)
  }

  async function runSql(): Promise<void> {
    if (!currentConnection || !activeSql) return
    const sql = sqlByDocument[selectedDocument] ?? ''
    setStatus('Executing…')
    try {
      const next = await window.dbforge.executeSql(currentConnection.id, sql)
      setResults(next)
      setErrors([])
      setStatus('Ready')
      log('Execution', `Consulta concluída · ${next.reduce((sum, result) => sum + result.rows.length, 0)} rows.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha na consulta.'
      setErrors([message]); setPanelTab('Error List'); setPanelVisible(true); setStatus('Error'); log('Execution', message, 'error')
    }
  }

  function newSql(): void {
    const id = `sql-${crypto.randomUUID()}`
    const number = documents.filter((tab) => tab.id !== 'start').length + 1
    setDocuments((current) => [...current, { id, label: `SQL ${number}`, modified: false }])
    setSqlByDocument((current) => ({ ...current, [id]: '-- Novo documento SQL\n' }))
    setSelectedDocument(id)
  }

  function closeTab(id: string): void {
    if (id === 'start') return
    const tab = documents.find((item) => item.id === id)
    if (tab?.modified && !window.confirm(`Descartar alterações em ${tab.label}?`)) return
    const next = documents.filter((item) => item.id !== id)
    setDocuments(next)
    if (selectedDocument === id) setSelectedDocument(next.at(-1)?.id ?? 'start')
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); openNewConnection() }
      else if (ctrl && event.key.toLowerCase() === 'n') { event.preventDefault(); newSql() }
      else if (ctrl && event.altKey && event.key.toLowerCase() === 'e') setExplorerVisible((value) => !value)
      else if (ctrl && event.key.toLowerCase() === 'j') setPanelVisible((value) => !value)
      else if (ctrl && event.key === ',') setManagerOpen(true)
      else if (event.key === 'F5' || (ctrl && event.key === 'Enter')) { event.preventDefault(); void runSql() }
      else if (ctrl && event.key === 'Tab') {
        event.preventDefault()
        const index = documents.findIndex((tab) => tab.id === selectedDocument)
        setSelectedDocument(documents[(index + (event.shiftKey ? documents.length - 1 : 1)) % documents.length]?.id ?? 'start')
      } else if (ctrl && event.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(selectedDocument) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const activeTitle = useMemo(() => currentConnection?.name ?? 'Nenhuma conexão ativa', [currentConnection])

  function cycleDocument(direction: number): void {
    const index = documents.findIndex((tab) => tab.id === selectedDocument)
    setSelectedDocument(documents[(index + direction + documents.length) % documents.length]?.id ?? 'start')
  }

  return <main className="app-shell" aria-label="dbForgeLinux">
    <header className="app-menubar">
      <strong className="brand">dbForgeLinux</strong>
      <nav className="menu-row" aria-label="Menu principal">
        <details><summary>File</summary><div className="menu-popup"><MenuAction label="New SQL Document" shortcut="Ctrl+N" onClick={newSql} /><MenuAction label="Database Connection…" shortcut="Ctrl+Shift+N" onClick={openNewConnection} /><MenuAction label="Connection Manager…" onClick={() => setManagerOpen(true)} /><MenuAction label="Exit" shortcut="Ctrl+Q" onClick={() => window.close()} /></div></details>
        <details><summary>Edit</summary><div className="menu-popup"><MenuAction label="Undo" shortcut="Ctrl+Z" disabled /><MenuAction label="Redo" shortcut="Ctrl+Y" disabled /><MenuAction label="Find" shortcut="Ctrl+F" disabled={!activeSql} /></div></details>
        <details><summary>View</summary><div className="menu-popup"><MenuAction label="Database Explorer" shortcut="Ctrl+Alt+E" onClick={() => setExplorerVisible((value) => !value)} /><MenuAction label="Output / Error List" shortcut="Ctrl+J" onClick={() => setPanelVisible((value) => !value)} /><div className="menu-divider" /><span className="menu-caption">Theme</span>{(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => <MenuAction key={mode} label={mode[0].toUpperCase() + mode.slice(1)} checked={themeMode === mode} onClick={() => setThemeMode(mode)} />)}</div></details>
        <details><summary>Database</summary><div className="menu-popup"><MenuAction label="New Connection…" onClick={openNewConnection} /><MenuAction label="Connect" onClick={() => currentRecord && void connectFromExplorer(currentRecord)} disabled={!records.length || Boolean(currentConnection)} /><MenuAction label="Disconnect" onClick={() => currentConnection && void disconnect(currentConnection)} disabled={!currentConnection} /><MenuAction label="Refresh" shortcut="F5" onClick={() => currentRecord && void expandRecord(currentRecord)} disabled={!currentConnection} /></div></details>
        <details><summary>SQL</summary><div className="menu-popup"><MenuAction label="New SQL" shortcut="Ctrl+N" onClick={newSql} /><MenuAction label="Execute" shortcut="F5 / Ctrl+Enter" onClick={() => void runSql()} disabled={!activeSql || !currentConnection} /><MenuAction label="Cancel" shortcut="Shift+F5" disabled /></div></details>
        <details><summary>Data</summary><div className="menu-popup"><MenuAction label="Refresh Result" shortcut="F5" onClick={() => void runSql()} disabled={!activeSql || !currentConnection} /><MenuAction label="Export Data…" disabled /></div></details>
        <details><summary>Tools</summary><div className="menu-popup"><MenuAction label="Connection Manager…" onClick={() => setManagerOpen(true)} /><MenuAction label="Options…" shortcut="Ctrl+," disabled /></div></details>
        <details><summary>Window</summary><div className="menu-popup"><MenuAction label="Next Tab" shortcut="Ctrl+Tab" onClick={() => cycleDocument(1)} /><MenuAction label="Previous Tab" shortcut="Ctrl+Shift+Tab" onClick={() => cycleDocument(-1)} /><MenuAction label="Close Tab" shortcut="Ctrl+W" onClick={() => closeTab(selectedDocument)} disabled={!activeSql} /></div></details>
        <details><summary>Help</summary><div className="menu-popup"><MenuAction label="Keyboard Shortcuts" shortcut="Ctrl+K Ctrl+S" disabled /><MenuAction label="About dbForgeLinux" disabled /></div></details>
      </nav>
      <span className="menubar-status">{status}</span>
    </header>
    <div className="app-toolbar">
      <Button title="New SQL Document (Ctrl+N)" onClick={newSql}>＋ SQL</Button>
      <Button title="New Connection (Ctrl+Shift+N)" onClick={openNewConnection}>＋ Connection</Button>
      <Button onClick={() => setManagerOpen(true)}>Connection Manager</Button>
      <span className="toolbar-divider" />
      <select aria-label="Ativa conexão" value={currentConnection?.recordId ?? ''} onChange={(event) => { const record = records.find((item) => item.id === event.target.value); if (record) void connectFromExplorer(record) }}>
        <option value="">{currentConnection?.name ?? 'Connection'}</option>{records.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
      </select>
      <select aria-label="Database ativa" value={currentConnection?.database ?? ''} disabled={!currentConnection} onChange={() => undefined}><option value="">{currentConnection?.database ?? 'Database'}</option>{(databases[currentConnection?.recordId ?? ''] ?? []).map((name) => <option key={name}>{name}</option>)}</select>
      <Button variant="primary" onClick={() => void runSql()} disabled={!activeSql || !currentConnection}>▶ Execute</Button>
      <Button onClick={() => setPanelVisible((value) => !value)} title="Toggle Results">Results</Button>
      <span className="toolbar-spacer" />
      <Button className="icon-button" title="Auto theme" onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark')}>{theme === 'dark' ? '☾' : '☼'}</Button>
    </div>
    {loadError && <div className="storage-error" role="alert">{loadError}<Button onClick={() => void loadConnections()}>Tentar de novo</Button></div>}
    <div className={`workbench${explorerVisible ? '' : ' explorer-hidden'}${panelVisible ? '' : ' panel-hidden'}`} style={{ gridTemplateColumns: explorerVisible ? `${explorerWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}>
      {explorerVisible && <DatabaseExplorer records={records} active={active} databases={databases} tables={tables} connecting={connecting} errors={connectionErrors} onNew={openNewConnection} onManage={() => setManagerOpen(true)} onConnect={(record) => void connectFromExplorer(record)} onDisconnect={(connection) => void disconnect(connection)} onExpand={(record) => void expandRecord(record)} onEdit={openEdit} />}
      {explorerVisible && <div className="vertical-splitter" role="separator" aria-orientation="vertical" aria-label="Resize Database Explorer" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setExplorerWidth(Math.min(Math.floor(window.innerWidth * 0.5), Math.max(200, event.clientX))) }} />}
      <section className="document-workspace" style={{ gridTemplateRows: panelVisible ? `30px minmax(0, 1fr) 5px ${panelHeight}px` : '30px minmax(0, 1fr) 0 0' }}>
        <div className="document-tabs" role="tablist" aria-label="Documents">
          {documents.map((tab) => <div key={tab.id} role="tab" aria-selected={selectedDocument === tab.id} className={`document-tab${selectedDocument === tab.id ? ' selected' : ''}`} onClick={() => setSelectedDocument(tab.id)}>
            <button className="tab-label" onClick={() => setSelectedDocument(tab.id)}>{tab.modified ? '• ' : ''}{tab.label}</button>{tab.id !== 'start' && <button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }} aria-label={`Fechar ${tab.label}`}>×</button>}
          </div>)}
          <button className="tab-overflow" title="Todas as abas" onClick={() => window.alert(documents.map((tab) => tab.label).join('\n'))}>⌄</button>
        </div>
        {selectedDocument === 'start' ? <section className="start-page"><p className="eyebrow">MySQL & MariaDB</p><h1>Comece a trabalhar</h1><p>Abra um documento SQL ou conecte-se a um servidor.</p><div><Button variant="primary" onClick={newSql}>New SQL</Button><Button onClick={openNewConnection}>New Connection</Button><Button onClick={() => setManagerOpen(true)}>Connection Manager</Button></div><h2>Recent Connections</h2>{records.slice().sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 5).map((record) => <button key={record.id} className="recent-connection" onClick={() => void connectFromExplorer(record)}>{record.name} <span>{record.user}@{record.host}:{record.port}</span></button>)}</section> : <div className="document-main">
          <div className="sql-context-toolbar"><span>{documents.find((tab) => tab.id === selectedDocument)?.label}</span><span>{activeTitle}</span><Button variant="primary" onClick={() => void runSql()} disabled={!currentConnection}>▶ Execute</Button></div>
          <div className="editor-surface"><Editor height="100%" language="sql" theme={theme === 'dark' ? 'vs-dark' : 'vs'} value={sqlByDocument[selectedDocument] ?? ''} onChange={(value) => { setSqlByDocument((current) => ({ ...current, [selectedDocument]: value ?? '' })); setDocuments((current) => current.map((tab) => tab.id === selectedDocument ? { ...tab, modified: true } : tab)) }} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, fontLigatures: false, lineNumbers: 'on' }} /></div>
          <div className="result-view">{results.length === 0 ? <p>Execute uma consulta para ver os resultados.</p> : results.map((result, index) => <div className="result-set" key={index}>{result.columns.length ? <table><thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{result.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody></table> : <p>{result.affectedRows} linha(s) afetada(s) · ID {result.insertId}</p>}</div>)}</div>
        </div>}
        <div className="horizontal-splitter" role="separator" aria-orientation="horizontal" aria-label="Resize Output panel" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setPanelHeight(Math.min(480, Math.max(80, window.innerHeight - event.clientY))) }} />
        <section className="bottom-panel" aria-label="Output and errors">
          <div className="panel-tabs"><button className={panelTab === 'Output' ? 'selected' : ''} onClick={() => setPanelTab('Output')}>Output</button><button className={panelTab === 'Error List' ? 'selected' : ''} onClick={() => setPanelTab('Error List')}>Error List{errors.length ? ` (${errors.length})` : ''}</button><span className="toolbar-spacer" /><Button className="icon-button" onClick={() => setPanelVisible(false)} title="Hide panel">⌄</Button></div>
          {panelTab === 'Output' ? <div className="output-log" aria-live="polite">{output.length ? output.map((entry, index) => <div key={`${entry.timestamp}-${index}`} className={`output-${entry.tone}`}>[{entry.timestamp}] {entry.origin} {entry.message}</div>) : <p>Output de conexões e execução aparecerá aqui. Segredos nunca são registrados.</p>}</div> : <div className="error-list">{errors.length ? <table><thead><tr><th>Severity</th><th>#</th><th>Message</th><th>Document</th><th>Line</th><th>Column</th></tr></thead><tbody>{errors.map((error, index) => <tr key={index}><td className="field-error">● Error</td><td>{index + 1}</td><td>{error}</td><td>{documents.find((tab) => tab.id === selectedDocument)?.label}</td><td>—</td><td>—</td></tr>)}</tbody></table> : <p>Nenhum erro ou aviso.</p>}</div>}
        </section>
      </section>
    </div>
    <footer className="status-bar"><span>{status}</span><button onClick={() => currentRecord && setManagerOpen(true)}>{activeTitle}</button><span>{currentConnection?.database ?? ''}</span><span>Ln 1, Col 1</span><span>UTF-8</span><span>LF</span><span>{results.length ? `${results.reduce((sum, item) => sum + item.rows.length, 0)} rows` : ''}</span><span className="toolbar-spacer" />{themeMode.toUpperCase()}</footer>
    {dialogRecord && <ConnectionPropertiesDialog initial={dialogRecord} isNew={newDialog} names={records.filter((record) => record.id !== dialogRecord.id).map((record) => record.name)} onAction={runConnectionAction} onTrustHostKey={async (record) => { await window.dbforge.saveConnection(record); upsertRecord(record) }} onCancel={() => setDialogRecord(null)} />}
    {managerOpen && <ConnectionManager records={records} onNew={() => { setManagerOpen(false); openNewConnection() }} onEdit={(record) => { setManagerOpen(false); openEdit(record) }} onDuplicate={(record) => { setManagerOpen(false); setDialogRecord({ ...structuredClone(record), id: crypto.randomUUID(), name: `${record.name} copy`, lastUsedAt: undefined }); setNewDialog(true) }} onDelete={deleteRecords} onClose={() => setManagerOpen(false)} />}
  </main>

}

function MenuAction({ label, shortcut, onClick, disabled = false, checked }: { label: string; shortcut?: string; onClick?: () => void; disabled?: boolean; checked?: boolean }): React.JSX.Element {
  return <button className="menu-action" disabled={disabled} onClick={(event) => { onClick?.(); event.currentTarget.closest('details')?.removeAttribute('open') }}>
    <span>{checked === undefined ? '' : checked ? '✓' : '　'}{label}</span>{shortcut && <small>{shortcut}</small>}
  </button>
}

function emptySecrets(): ConnectionSecrets {
  return { password: '', sshPassword: '', sshPassphrase: '', httpPassword: '', proxyPassword: '' }
}

function maskSecrets(value: string): string {
  return value.replace(/(password|passphrase)(\s*[:=]\s*)\S+/gi, '$1$2****')
}

function formatCell(value: unknown): string {
  if (value === null) return 'NULL'
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function readStoredDocuments(): DocumentTab[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('dbforge.documents') ?? 'null')
    if (Array.isArray(stored) && stored.every((item) => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.modified === 'boolean')) {
      const documents = stored as DocumentTab[]
      return documents.some((item) => item.id === 'start') ? documents : [{ id: 'start', label: 'Start Page', modified: false }, ...documents]
    }
  } catch { /* discard malformed renderer state */ }
  return [{ id: 'start', label: 'Start Page', modified: false }]
}
