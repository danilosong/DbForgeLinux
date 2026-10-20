import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type { ConnectionRecord, ConnectionSummary, ConnectionTestResult, DatabaseObject, QueryResult } from '../../../shared/contracts'
import { splitSqlStatements, statementAtOffset } from '../../../shared/sqlStatements'
import { createDefaultConnection } from '../../../shared/connectionDefaults'
import { Button } from './components/Button'
import { ConnectionManager } from './components/ConnectionManager'
import { ConnectionPropertiesDialog, type ConnectionAction, type ConnectionSecrets } from './components/ConnectionPropertiesDialog'
import { DatabaseExplorer } from './components/DatabaseExplorer'
import { ResultGrid } from './components/ResultGrid'
import { PanelDialog } from './components/PanelDialog'
import { PanelConnectionContext, panelRegistry } from './panels/registry'

type ThemeMode = 'auto' | 'light' | 'dark'
type DocumentTab = { id: string; label: string; modified: boolean; filePath?: string }
type OutputEntry = { timestamp: string; origin: string; message: string; tone: string }
type HistoryEntry = { timestamp: string; connection: string; sql: string; elapsedMs: number }
type PageQuery = { database: string; table: string; offset: number }

export default function App(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [active, setActive] = useState<ConnectionSummary[]>([])
  const [databases, setDatabases] = useState<Record<string, string[]>>({})
  const [objects, setObjects] = useState<Record<string, DatabaseObject[]>>({})
  const [loadingObjects, setLoadingObjects] = useState<string[]>([])
  const [connecting, setConnecting] = useState<string[]>([])
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({})
  const [dialogRecord, setDialogRecord] = useState<ConnectionRecord | null>(null)
  const [newDialog, setNewDialog] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [openPanel, setOpenPanel] = useState<string | null>(null)
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
  const [queryMessages, setQueryMessages] = useState<string[]>([])
  const [queryBusy, setQueryBusy] = useState(false)
  const [executionId, setExecutionId] = useState('')
  const [resultIndex, setResultIndex] = useState(-1)
  const [queryElapsed, setQueryElapsed] = useState(0)
  const [autoCommit, setAutoCommit] = useState(true)
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem('dbforge.queryHistory') ?? '[]'); return Array.isArray(saved) ? saved as HistoryEntry[] : [] }
    catch { return [] }
  })
  const [pageQueries, setPageQueries] = useState<Record<string, PageQuery>>({})
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
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
  useEffect(() => { localStorage.setItem('dbforge.queryHistory', JSON.stringify(history.slice(0, 100))) }, [history])
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
    catch (error) {
      const fingerprint = error instanceof Error ? /SSH host key não confiável: (SHA256:\S+)/.exec(error.message)?.[1] : undefined
      if (fingerprint && window.confirm(`Fingerprint SSH ${fingerprint}\n\nConfiar nesta chave e salvar?`)) {
        const trusted = { ...record, ssh: { ...record.ssh, hostFingerprint: fingerprint } }
        await window.dbforge.saveConnection(trusted)
        upsertRecord(trusted)
        try { await runConnectionAction(trusted, emptySecrets(), true, 'connect') } catch { /* Explorer shows the retry error. */ }
      }
    }
  }

  async function disconnect(connection: ConnectionSummary): Promise<void> {
    await window.dbforge.disconnect(connection.id)
    setAutoCommit(true)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar o Explorer.'
      setConnectionErrors((current) => ({ ...current, [record.id]: message }))
      log('Connections', message, 'error')
    }
  }

  async function loadObjects(connection: ConnectionSummary, database: string): Promise<void> {
    const key = `${connection.recordId}:${database}`
    setLoadingObjects((current) => [...new Set([...current, key])])
    try { const loaded = await window.dbforge.listDatabaseObjects(connection.id, database); setObjects((current) => ({ ...current, [key]: loaded })) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : 'Falha ao carregar objetos.', 'error') }
    finally { setLoadingObjects((current) => current.filter((item) => item !== key)) }
  }

  async function selectDatabase(connection: ConnectionSummary, database: string): Promise<void> {
    try {
      await window.dbforge.setDatabase(connection.id, database)
      setActive((current) => current.map((item) => item.id === connection.id ? { ...item, database } : item))
      log('Database', `Database ativa: ${database}.`)
    } catch (error) { log('Database', error instanceof Error ? error.message : 'Falha ao selecionar database.', 'error') }
  }

  function openSqlDocument(label: string, sql: string): string {
    const id = `sql-${crypto.randomUUID()}`
    setDocuments((current) => [...current, { id, label, modified: false }])
    setSqlByDocument((current) => ({ ...current, [id]: sql }))
    setSelectedDocument(id)
    return id
  }

  async function openSqlFile(): Promise<void> {
    try {
      const file = await window.dbforge.openSqlFile()
      if (!file) return
      const id = `sql-${crypto.randomUUID()}`
      setDocuments((current) => [...current, { id, label: file.path.split('/').at(-1) ?? 'query.sql', filePath: file.path, modified: false }])
      setSqlByDocument((current) => ({ ...current, [id]: file.contents }))
      setSelectedDocument(id)
    } catch (error) { log('File', error instanceof Error ? error.message : 'Não foi possível abrir o arquivo SQL.', 'error') }
  }

  async function saveCurrentSql(): Promise<void> {
    const tab = documents.find((item) => item.id === selectedDocument)
    if (!tab || tab.id === 'start') return
    try {
      const path = await window.dbforge.saveSqlFile(tab.filePath, sqlByDocument[selectedDocument] ?? '')
      if (path) setDocuments((current) => current.map((item) => item.id === selectedDocument ? { ...item, label: path.split('/').at(-1) ?? item.label, filePath: path, modified: false } : item))
    } catch (error) { log('File', error instanceof Error ? error.message : 'Não foi possível salvar o arquivo SQL.', 'error') }
  }

  function selectTop(connection: ConnectionSummary, database: string, object: DatabaseObject): void {
    const id = openSqlDocument(`${connection.name} · ${object.name} data`, `SELECT * FROM \`${database.replace(/`/g, '``')}\`.\`${object.name.replace(/`/g, '``')}\` LIMIT 1000;`)
    setPageQueries((current) => ({ ...current, [id]: { database, table: object.name, offset: 1000 } }))
  }

  async function loadMorePage(resultTab: number): Promise<void> {
    const page = pageQueries[selectedDocument]
    if (!page || !currentConnection) return
    const quote = (value: string): string => String.fromCharCode(96) + value.replaceAll(String.fromCharCode(96), String.fromCharCode(96).repeat(2)) + String.fromCharCode(96)
    const sql = `SELECT * FROM ${quote(page.database)}.${quote(page.table)} LIMIT 1000 OFFSET ${page.offset}`
    try {
      const next = await window.dbforge.executeSql(currentConnection.id, sql, crypto.randomUUID())
      const rows = next[0]?.rows ?? []
      setResults((current) => current.map((result, index) => index === resultTab ? { ...result, rows: [...result.rows, ...rows] } : result))
      if (rows.length < 1000) setPageQueries((current) => { const updated = { ...current }; delete updated[selectedDocument]; return updated })
      else setPageQueries((current) => ({ ...current, [selectedDocument]: { ...page, offset: page.offset + rows.length } }))
    } catch (error) { log('Execution', error instanceof Error ? error.message : 'Falha ao carregar mais linhas.', 'error') }
  }

  async function generateScript(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    try { openSqlDocument(`Create ${object.name}`, await window.dbforge.showCreateObject(connection.id, database, object)) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : 'Não foi possível gerar o script.', 'error') }
  }

  async function dropObject(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(`Database de produção: digite ${database} para confirmar.`) !== database) return
    const kind = object.kind.toUpperCase()
    const quote = (value: string): string => String.fromCharCode(96) + value.replaceAll(String.fromCharCode(96), String.fromCharCode(96).repeat(2)) + String.fromCharCode(96)
    try {
      await window.dbforge.executeSql(connection.id, `DROP ${kind} ${quote(database)}.${quote(object.name)}`)
      log('Explorer', `${kind} ${object.name} removido.`, 'success')
      await loadObjects(connection, database)
    } catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao remover ${object.name}.`, 'error') }
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

  async function runSql(mode: 'auto' | 'current' = 'auto'): Promise<void> {
    if (!currentConnection || !activeSql) return
    const source = sqlByDocument[selectedDocument] ?? ''
    const selection = editorRef.current?.getSelection()
    const selectedText = selection && !selection.isEmpty() ? editorRef.current?.getModel()?.getValueInRange(selection) : ''
    const model = editorRef.current?.getModel()
    const position = editorRef.current?.getPosition()
    const currentOffset = model && position ? model.getOffsetAt(position) : 0
    const current = mode === 'current' ? statementAtOffset(source, currentOffset)?.sql : undefined
    const sql = (mode === 'current' ? current ?? '' : selectedText || source).trim()
    if (!sql) return
    const statements = splitSqlStatements(sql)
    const destructive = statements.some(({ sql: statement }) => /\b(DROP|TRUNCATE)\b/i.test(statement) || (/\b(DELETE|UPDATE)\b/i.test(statement) && !/\bWHERE\b/i.test(statement)))
    if (destructive) {
      if (currentRecord?.environment === 'prod') {
        if (window.prompt(`Conexão de produção. Digite ${currentConnection.database ?? 'sem database'} para confirmar.`) !== (currentConnection.database ?? 'sem database')) return
      } else if (!window.confirm('Este script pode alterar ou remover dados. Executar mesmo assim?')) return
    }
    const token = crypto.randomUUID()
    const startedAt = performance.now()
    if (pageQueries[selectedDocument]) setPageQueries((current) => ({ ...current, [selectedDocument]: { ...current[selectedDocument], offset: 1000 } }))
    setExecutionId(token); setQueryBusy(true); setQueryMessages([]); setResults([]); setResultIndex(-1)
    setStatus('Executing…')
    const next: QueryResult[] = []
    const messages: string[] = []
    try {
      for (const [index, statement] of statements.entries()) {
        const requestId = `${token}:${index}`
        setExecutionId(requestId)
        const statementResults = await window.dbforge.executeSql(currentConnection.id, statement.sql, requestId)
        next.push(...statementResults)
        setResults([...next])
        const returnedRows = statementResults.reduce((total, result) => total + result.rows.length, 0)
        messages.push(`OK · ${returnedRows} rows · ${((performance.now() - startedAt) / 1000).toFixed(3)} s`)
        setQueryMessages([...messages])
      }
      setResults(next); setQueryMessages(messages); setResultIndex(next.length ? 0 : -1)
      if (pageQueries[selectedDocument] && (next[0]?.rows.length ?? 0) < 1000) setPageQueries((current) => { const updated = { ...current }; delete updated[selectedDocument]; return updated })
      setErrors([])
      setStatus('Ready')
      setQueryElapsed(performance.now() - startedAt)
      setHistory((current) => [{ timestamp: new Date().toISOString(), connection: currentConnection.name, sql: redactHistorySql(sql), elapsedMs: performance.now() - startedAt }, ...current].slice(0, 100))
      log('Execution', `Consulta concluída · ${next.reduce((sum, result) => sum + result.rows.length, 0)} rows.`, 'success')
    } catch (error) {
      const code = typeof error === 'object' && error ? String((error as { code?: unknown }).code ?? '') : ''
      if (code === 'ER_QUERY_INTERRUPTED' || code === '1317') {
        setQueryMessages((current) => [...current, 'Execução cancelada.'])
        setResultIndex(next.length ? 0 : -1)
        setStatus('Ready')
        return
      }
      const message = error instanceof Error ? error.message : 'Falha na consulta.'
      const detail = error && typeof error === 'object' ? error as { code?: string; errno?: number; lineNumber?: number; columnNumber?: number } : {}
      const match = /at (?:line )?(\d+)(?:,? column (\d+))?/i.exec(message)
      const line = detail.lineNumber ?? Number(match?.[1] ?? 0)
      const column = detail.columnNumber ?? Number(match?.[2] ?? 0)
      const shownMessage = `${detail.code ? `${detail.code}${detail.errno ? ` ${detail.errno}` : ''}: ` : ''}${message}${line ? ` · line ${line}${column ? `, column ${column}` : ''}` : ''}`
      setErrors([shownMessage]); setQueryMessages([...messages, shownMessage]); setResultIndex(-1); setPanelTab('Error List'); setPanelVisible(true); setStatus('Error'); log('Execution', shownMessage, 'error')
      if (line && editorRef.current) editorRef.current.revealLineInCenter(line)
    } finally { setQueryBusy(false); setExecutionId('') }
  }

  async function cancelSql(): Promise<void> {
    if (!currentConnection || !queryBusy || !executionId) return
    setStatus('Canceling…')
    try { await window.dbforge.cancelQuery(currentConnection.id, executionId); setQueryMessages((current) => [...current, 'Execução cancelada.']); setStatus('Ready') }
    catch (error) { log('Execution', error instanceof Error ? error.message : 'Falha ao cancelar consulta.', 'error') }
  }

  async function toggleAutoCommit(enabled: boolean): Promise<void> {
    if (!currentConnection) return
    try {
      if (enabled) await window.dbforge.commitTransaction(currentConnection.id)
      else await window.dbforge.beginTransaction(currentConnection.id)
      setAutoCommit(enabled)
      log('Transaction', enabled ? 'Transação confirmada.' : 'Transação manual iniciada.')
    } catch (error) { log('Transaction', error instanceof Error ? error.message : 'Falha na transação.', 'error') }
  }

  async function finishTransaction(action: 'commit' | 'rollback'): Promise<void> {
    if (!currentConnection || autoCommit) return
    try {
      if (action === 'commit') await window.dbforge.commitTransaction(currentConnection.id)
      else await window.dbforge.rollbackTransaction(currentConnection.id)
      setAutoCommit(true)
      log('Transaction', action === 'commit' ? 'Alterações confirmadas.' : 'Alterações desfeitas.')
    } catch (error) { log('Transaction', error instanceof Error ? error.message : 'Falha na transação.', 'error') }
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
      else if (ctrl && event.key.toLowerCase() === 'o') { event.preventDefault(); void openSqlFile() }
      else if (ctrl && event.key.toLowerCase() === 's') { event.preventDefault(); void saveCurrentSql() }
      else if (ctrl && event.altKey && event.key.toLowerCase() === 'e') setExplorerVisible((value) => !value)
      else if (ctrl && event.key.toLowerCase() === 'j') setPanelVisible((value) => !value)
      else if (ctrl && event.key === ',') setManagerOpen(true)
      else if (event.shiftKey && event.key === 'F5') { event.preventDefault(); void cancelSql() }
      else if (ctrl && event.shiftKey && event.key === 'Enter') { event.preventDefault(); void runSql('current') }
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
        <details><summary>File</summary><div className="menu-popup"><MenuAction label="New SQL Document" shortcut="Ctrl+N" onClick={newSql} /><MenuAction label="Open SQL File…" shortcut="Ctrl+O" onClick={() => void openSqlFile()} /><MenuAction label="Save SQL" shortcut="Ctrl+S" onClick={() => void saveCurrentSql()} disabled={!activeSql} /><MenuAction label="Database Connection…" shortcut="Ctrl+Shift+N" onClick={openNewConnection} /><MenuAction label="Connection Manager…" onClick={() => setManagerOpen(true)} /><MenuAction label="Exit" shortcut="Ctrl+Q" onClick={() => window.close()} /></div></details>
        <details><summary>Edit</summary><div className="menu-popup"><MenuAction label="Undo" shortcut="Ctrl+Z" disabled /><MenuAction label="Redo" shortcut="Ctrl+Y" disabled /><MenuAction label="Find" shortcut="Ctrl+F" disabled={!activeSql} /></div></details>
        <details><summary>View</summary><div className="menu-popup"><MenuAction label="Database Explorer" shortcut="Ctrl+Alt+E" onClick={() => setExplorerVisible((value) => !value)} /><MenuAction label="Output / Error List" shortcut="Ctrl+J" onClick={() => setPanelVisible((value) => !value)} /><div className="menu-divider" /><span className="menu-caption">Theme</span>{(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => <MenuAction key={mode} label={mode[0].toUpperCase() + mode.slice(1)} checked={themeMode === mode} onClick={() => setThemeMode(mode)} />)}</div></details>
        <details><summary>Database</summary><div className="menu-popup">{panelRegistry.filter((item) => item.id === 'schema-compare' || item.id === 'documenter').map((item) => <MenuAction key={item.id} label={`${item.icon} ${item.titleKey.split('.').at(-1)}`} onClick={() => setOpenPanel(item.id)} />)}<MenuAction label="New Connection…" onClick={openNewConnection} /><MenuAction label="Connect" onClick={() => currentRecord && void connectFromExplorer(currentRecord)} disabled={!records.length || Boolean(currentConnection)} /><MenuAction label="Disconnect" onClick={() => currentConnection && void disconnect(currentConnection)} disabled={!currentConnection} /><MenuAction label="Refresh" shortcut="F5" onClick={() => currentRecord && void expandRecord(currentRecord)} disabled={!currentConnection} /></div></details>
        <details><summary>SQL</summary><div className="menu-popup"><MenuAction label="New SQL" shortcut="Ctrl+N" onClick={newSql} /><MenuAction label="Execute" shortcut="F5 / Ctrl+Enter" onClick={() => void runSql()} disabled={!activeSql || !currentConnection || queryBusy} /><MenuAction label="Execute Current Statement" shortcut="Ctrl+Shift+Enter" onClick={() => void runSql('current')} disabled={!activeSql || !currentConnection || queryBusy} /><MenuAction label={queryBusy ? 'Cancel' : 'Cancel'} shortcut="Shift+F5" onClick={() => void cancelSql()} disabled={!queryBusy} /></div></details>
        <details><summary>Data</summary><div className="menu-popup"><MenuAction label="Refresh Result" shortcut="F5" onClick={() => void runSql()} disabled={!activeSql || !currentConnection} /><MenuAction label="Export Data…" disabled /></div></details>
        <details><summary>Tools</summary><div className="menu-popup">{panelRegistry.filter((item) => !['schema-compare','documenter'].includes(item.id)).map((item) => <MenuAction key={item.id} label={`${item.icon} ${item.titleKey.split('.').at(-1)}`} onClick={() => setOpenPanel(item.id)} />)}<div className="menu-divider" /><MenuAction label="Connection Manager…" onClick={() => setManagerOpen(true)} /><MenuAction label="Options…" shortcut="Ctrl+," disabled /></div></details>
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
      <select aria-label="Database ativa" value={currentConnection?.database ?? ''} disabled={!currentConnection} onChange={(event) => { if (currentConnection) void selectDatabase(currentConnection, event.target.value) }}><option value="">{currentConnection?.database ?? 'Database'}</option>{(databases[currentConnection?.recordId ?? ''] ?? []).map((name) => <option key={name}>{name}</option>)}</select>
      <Button variant="primary" onClick={() => void runSql()} disabled={!activeSql || !currentConnection || queryBusy}>▶ Execute</Button>
      <Button variant="danger" onClick={() => void cancelSql()} disabled={!queryBusy}>■ Stop</Button>
      <label className="autocommit-toggle"><input type="checkbox" checked={autoCommit} disabled={!currentConnection} onChange={(event) => void toggleAutoCommit(event.target.checked)} />Auto-commit</label>
      <Button onClick={() => void finishTransaction('commit')} disabled={autoCommit}>Commit</Button>
      <Button onClick={() => void finishTransaction('rollback')} disabled={autoCommit}>Rollback</Button>
      <Button onClick={() => setPanelVisible((value) => !value)} title="Toggle Results">Results</Button>
      <span className="toolbar-spacer" />
      <Button className="icon-button" title="Auto theme" onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark')}>{theme === 'dark' ? '☾' : '☼'}</Button>
    </div>
    {loadError && <div className="storage-error" role="alert">{loadError}<Button onClick={() => void loadConnections()}>Tentar de novo</Button></div>}
    <div className={`workbench${explorerVisible ? '' : ' explorer-hidden'}${panelVisible ? '' : ' panel-hidden'}`} style={{ gridTemplateColumns: explorerVisible ? `${explorerWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}>
      {explorerVisible && <DatabaseExplorer records={records} active={active} databases={databases} objects={objects} loadingObjects={loadingObjects} connecting={connecting} errors={connectionErrors} onNew={openNewConnection} onManage={() => setManagerOpen(true)} onConnect={(record) => void connectFromExplorer(record)} onDisconnect={(connection) => void disconnect(connection)} onExpand={(record) => void expandRecord(record)} onLoadObjects={loadObjects} onSelectDatabase={(connection, database) => void selectDatabase(connection, database)} onSelectTop={selectTop} onGenerateScript={(connection, database, object) => void generateScript(connection, database, object)} onDropObject={(connection, database, object) => void dropObject(connection, database, object)} onEdit={openEdit} />}
      {explorerVisible && <div className="vertical-splitter" role="separator" aria-orientation="vertical" aria-label="Resize Database Explorer" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setExplorerWidth(Math.min(Math.floor(window.innerWidth * 0.5), Math.max(200, event.clientX))) }} />}
      <section className="document-workspace" style={{ gridTemplateRows: panelVisible ? `30px minmax(0, 1fr) 5px ${panelHeight}px` : '30px minmax(0, 1fr) 0 0' }}>
        <div className="document-tabs" role="tablist" aria-label="Documents">
          {documents.map((tab) => <div key={tab.id} role="tab" aria-selected={selectedDocument === tab.id} className={`document-tab${selectedDocument === tab.id ? ' selected' : ''}`} onClick={() => setSelectedDocument(tab.id)}>
            <button className="tab-label" onClick={() => setSelectedDocument(tab.id)}>{tab.modified ? '• ' : ''}{tab.label}</button>{tab.id !== 'start' && <button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }} aria-label={`Fechar ${tab.label}`}>×</button>}
          </div>)}
          <button className="tab-overflow" title="Todas as abas" onClick={() => window.alert(documents.map((tab) => tab.label).join('\n'))}>⌄</button>
        </div>
        {selectedDocument === 'start' ? <section className="start-page"><p className="eyebrow">MySQL & MariaDB</p><h1>Comece a trabalhar</h1><p>Abra um documento SQL ou conecte-se a um servidor.</p><div><Button variant="primary" onClick={newSql}>New SQL</Button><Button onClick={openNewConnection}>New Connection</Button><Button onClick={() => setManagerOpen(true)}>Connection Manager</Button></div><h2>Recent Connections</h2>{records.slice().sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 5).map((record) => <button key={record.id} className="recent-connection" onClick={() => void connectFromExplorer(record)}>{record.name} <span>{record.user}@{record.host}:{record.port}</span></button>)}</section> : <div className="document-main">
          <div className="sql-context-toolbar"><span>{documents.find((tab) => tab.id === selectedDocument)?.label}</span><span>{activeTitle}</span><Button variant="primary" onClick={() => void runSql()} disabled={!currentConnection || queryBusy}>▶ Execute</Button><Button onClick={() => void runSql('current')} disabled={!currentConnection || queryBusy}>Current statement</Button></div>
          <div className="editor-surface"><Editor height="100%" language="sql" theme={theme === 'dark' ? 'vs-dark' : 'vs'} value={sqlByDocument[selectedDocument] ?? ''} onMount={(editor) => { editorRef.current = editor }} onChange={(value) => { setSqlByDocument((current) => ({ ...current, [selectedDocument]: value ?? '' })); setDocuments((current) => current.map((tab) => tab.id === selectedDocument ? { ...tab, modified: true } : tab)) }} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, fontLigatures: false, lineNumbers: 'on' }} /></div>
          <div className="result-view">
            <div className="result-tabs" role="tablist">{results.map((result, index) => <button key={index} role="tab" aria-selected={resultIndex === index} className={resultIndex === index ? 'selected' : ''} onClick={() => setResultIndex(index)}>Result {index + 1} ({result.rows.length})</button>)}<button role="tab" aria-selected={resultIndex === -1} className={resultIndex === -1 ? 'selected' : ''} onClick={() => setResultIndex(-1)}>Messages</button><button role="tab" aria-selected={resultIndex === -2} className={resultIndex === -2 ? 'selected' : ''} onClick={() => setResultIndex(-2)}>History</button></div>
            {resultIndex >= 0 && results[resultIndex] ? <ResultGrid result={results[resultIndex]} index={resultIndex} onLoadMore={pageQueries[selectedDocument] ? () => loadMorePage(resultIndex) : undefined} /> : resultIndex === -2 ? <div className="query-messages">{history.length ? history.map((entry, index) => <button className="history-entry" key={`${entry.timestamp}-${index}`} onClick={() => openSqlDocument('History query', entry.sql)}><span>{new Date(entry.timestamp).toLocaleString()} · {entry.connection} · {(entry.elapsedMs / 1000).toFixed(3)} s</span><code>{entry.sql}</code></button>) : <p>Histórico vazio.</p>}</div> : <div className="query-messages" aria-live="polite">{queryBusy && <p>Executando…</p>}{queryMessages.map((message, index) => <p key={index}>{message}</p>)}{!queryBusy && !queryMessages.length && <p>Messages de execução aparecerão aqui.</p>}{results.filter((result) => !result.columns.length).map((result, index) => <p key={`affected-${index}`}>Affected rows: {result.affectedRows} · Last insert id: {result.insertId}</p>)}{queryElapsed > 0 && <small>{(queryElapsed / 1000).toFixed(3)} s</small>}</div>}
          </div>
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
    {openPanel && (() => { const entry = panelRegistry.find((item) => item.id === openPanel); if (!entry) return null; const Panel = entry.component; return <PanelDialog title={entry.titleKey.split('.').at(-1) ?? entry.id} onClose={() => setOpenPanel(null)}><PanelConnectionContext.Provider value={currentConnection}><Panel /></PanelConnectionContext.Provider></PanelDialog> })()}
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

function redactHistorySql(sql: string): string {
  return sql.replace(/(IDENTIFIED\s+BY\s+)('[^']*'|"[^"]*"|\S+)/gi, '$1****')
    .replace(/(PASSWORD\s*=\s*)('[^']*'|"[^"]*"|\S+)/gi, '$1****')
    .replace(/(SET\s+PASSWORD\s*=\s*)('[^']*'|"[^"]*"|\S+)/gi, '$1****')
}
