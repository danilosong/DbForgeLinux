import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor, IRange } from 'monaco-editor'
import type { ConnectionRecord, ConnectionSummary, ConnectionTestResult, DatabaseObject, DatabaseObjectKind, EditorMetadata, EditorObjectMetadata, ObjectEditorTarget, QueryResult, SqlExecutionHistoryEntry } from '../../../shared/contracts'
import type { CodeAnalysisFinding } from '../../../shared/contracts/code-analysis.js'
import type { UpdateStatus } from '../../../shared/contracts/updater.js'
import { splitSqlStatements, statementAtOffset } from '../../../shared/sqlStatements'
import { applyKeywordCaseAtOffset, buildSqlSuggestions } from '../../../modules/editor/completion.js'
import { formatSql } from '../../../modules/editor/formatter.js'
import { createDefaultConnection } from '../../../shared/connectionDefaults'
import { Button } from './components/Button'
import { ConnectionManager } from './components/ConnectionManager'
import { ConnectionPropertiesDialog, type ConnectionAction, type ConnectionSecrets } from './components/ConnectionPropertiesDialog'
import { DatabaseExplorer, type ExplorerContext } from './components/DatabaseExplorer'
import { buildExplorerSql, quoteExplorerIdentifier, type ScriptKind } from './components/explorerContextMenu.js'
import { AboutDialog } from './components/AboutDialog'
import { ResultGrid } from './components/ResultGrid'
import { PanelDialog } from './components/PanelDialog'
import { ObjectEditor } from './components/ObjectEditor'
import { StartPage } from './components/StartPage'
import { PanelConnectionContext, PanelEditorContext, PanelNavigationContext, panelRegistry, type SelectedExplorerObject } from './panels/registry'
import { findTextMatches, type TextMatch } from '../modules/navigation/search.js'
import { defaultSettings, normalizeShortcut, type AppSettings } from '../../../modules/options/types.js'
import { useI18n } from './i18n/useI18n.js'
import type { UserSnippet } from '../../../modules/editor/snippetStore.js'

type ThemeMode = 'auto' | 'light' | 'dark' | 'high-contrast'
type DocumentTab = { id: string; label: string; modified: boolean; filePath?: string; panelId?: string; objectEditor?: ObjectEditorTarget & { isNew: boolean } }
type OutputEntry = { timestamp: string; origin: string; message: string; tone: string }
type PageQuery = { database: string; table: string; offset: number }
const emptyEditorMetadata: EditorMetadata = { database: '', databases: [], objects: [], routines: [] }

export default function App(): React.JSX.Element {
  const { t } = useI18n()
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
  const [aboutOpen, setAboutOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateLogOpen, setUpdateLogOpen] = useState(false)
  const [updateState, setUpdateState] = useState<UpdateStatus>({ phase: 'idle', currentVersion: '0.1.0', summary: [], log: [] })
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('dbforge.theme') as ThemeMode | null) ?? 'auto')
  const [appSettings, setAppSettings] = useState<AppSettings>(structuredClone(defaultSettings))
  const appSettingsRef = useRef(appSettings)
  appSettingsRef.current = appSettings
  const [userSnippets, setUserSnippets] = useState<UserSnippet[]>([])
  const userSnippetsRef = useRef(userSnippets)
  userSnippetsRef.current = userSnippets
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [explorerVisible, setExplorerVisible] = useState(() => localStorage.getItem('dbforge.explorerVisible') !== 'false')
  const [panelVisible, setPanelVisible] = useState(() => localStorage.getItem('dbforge.panelVisible') !== 'false')
  const [explorerWidth, setExplorerWidth] = useState(() => Number(localStorage.getItem('dbforge.explorerWidth')) || 280)
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('dbforge.panelHeight')) || 200)
  const [panelTab, setPanelTab] = useState<'Output' | 'Error List' | 'Find Results'>('Output')
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
  const [serverVersion, setServerVersion] = useState('')
  const [editorPosition, setEditorPosition] = useState({ line: 1, column: 1 })
  const [completionDetails, setCompletionDetails] = useState<EditorObjectMetadata | undefined>()
  const [resultPresentation, setResultPresentation] = useState<'grid' | 'text'>('grid')
  const [queryProfilingMode, setQueryProfilingMode] = useState(false)
  const [autoCommit, setAutoCommit] = useState(true)
  const [transactionRevision, setTransactionRevision] = useState(0)
  const [transactionCommitted, setTransactionCommitted] = useState(true)
  const [history, setHistory] = useState<SqlExecutionHistoryEntry[]>([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editorMetadata, setEditorMetadata] = useState<EditorMetadata>(emptyEditorMetadata)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [pageQueries, setPageQueries] = useState<Record<string, PageQuery>>({})
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const shortcutChordRef = useRef('')
  const metadataRef = useRef<EditorMetadata>(emptyEditorMetadata)
  const completionProviderRef = useRef<{ dispose(): void } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [analysisFindings, setAnalysisFindings] = useState<CodeAnalysisFinding[]>([])
  const [findOpen, setFindOpen] = useState(false)
  const [findReplaceMode, setFindReplaceMode] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findRegex, setFindRegex] = useState(false)
  const [findCase, setFindCase] = useState(false)
  const [findScope, setFindScope] = useState<'document' | 'selection' | 'open'>('document')
  const [findInFiles, setFindInFiles] = useState(false)
  const [findMatches, setFindMatches] = useState<Array<TextMatch & { documentId: string; documentLabel: string }>>([])
  const [selectedExplorerObject, setSelectedExplorerObject] = useState<SelectedExplorerObject>()
  const [selectedExplorerIntent, setSelectedExplorerIntent] = useState<string>()
  const [selectedExplorerContext, setSelectedExplorerContext] = useState<ExplorerContext>()
  const [status, setStatus] = useState('Ready')
  const [output, setOutput] = useState<OutputEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const [vaultWarning, setVaultWarning] = useState('')
  const theme = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode
  const currentConnection = active[0]
  const currentRecord = records.find((record) => record.id === currentConnection?.recordId)
  useEffect(() => {
    if (!currentConnection) { setServerVersion(''); return }
    let cancelled = false
    const record = records.find((item) => item.id === currentConnection.recordId)
    if (!record) return
    void window.dbforge.testConnection(record).then((result) => {
      if (!cancelled) setServerVersion(result.serverVersion)
    }).catch(() => { if (!cancelled) setServerVersion('') })
    return () => { cancelled = true }
  }, [currentConnection, records])
  const activeObjectTab = documents.find((tab) => tab.id === selectedDocument)?.objectEditor
  const activePanelTab = documents.find((tab) => tab.id === selectedDocument)?.panelId
  const activeSql = selectedDocument !== 'start' && !activeObjectTab && !activePanelTab
  const activeSqlText = activeSql ? sqlByDocument[selectedDocument] ?? '' : ''
  const navigationSqlDocument = documents.find((tab) => tab.id === selectedDocument && !tab.objectEditor && !tab.panelId)
    ?? [...documents].reverse().find((tab) => !tab.objectEditor && !tab.panelId && tab.id !== 'start')
  const navigationSqlText = navigationSqlDocument ? sqlByDocument[navigationSqlDocument.id] ?? '' : ''
  const navigationMatches = useMemo(() => findMatches, [findMatches])

  useEffect(() => {
    void loadConnections()
    void window.dbforge.getVaultStatus().then((vault) => { setVaultWarning(vault.warning ?? ''); if (vault.warning) log('Security', vault.warning, 'warning') }).catch(() => {})
    const applySettings = (settings: AppSettings, initial = false): void => {
      setAppSettings(settings); setThemeMode(settings.appearance.theme); setAutoCommit(settings.execution.autoCommit)
      if (initial && settings.environment.showStartPage && settings.environment.startup === 'start-page') setSelectedDocument('start')
      document.documentElement.style.setProperty('--accent', settings.appearance.accent)
      document.documentElement.style.zoom = String(settings.appearance.uiZoom / 100)
      document.documentElement.style.setProperty('--grid-row-height', `${settings.grid.rowHeight}px`)
      document.documentElement.style.fontFamily = settings.editor.fontName === 'monospace' ? '' : settings.editor.fontName
      editorRef.current?.updateOptions({ fontFamily: settings.editor.fontName, fontSize: settings.editor.fontSize, lineNumbers: settings.editor.lineNumbers ? 'on' : 'off', minimap: { enabled: settings.editor.minimap }, wordWrap: settings.editor.wordWrap ? 'on' : 'off', tabSize: settings.editor.tabSize, insertSpaces: settings.editor.insertSpaces, folding: settings.editor.folding, renderLineHighlight: settings.editor.highlightCurrentLine ? 'line' : 'none', fontLigatures: settings.editor.ligatures, quickSuggestions: settings.editor.autoComplete, suggestOnTriggerCharacters: settings.editor.autoComplete, quickSuggestionsDelay: settings.editor.completionDelayMs })
    }
    const onSettingsChanged = (event: Event): void => applySettings((event as CustomEvent<AppSettings>).detail)
    const onClosePanel = (): void => setOpenPanel(null)
    window.addEventListener('dbforge:settings-changed', onSettingsChanged)
    window.addEventListener('dbforge:close-panel', onClosePanel)
    void window.dbforge.loadSettings().then((result) => applySettings(result.settings, true)).catch((error: unknown) => log('Options', error instanceof Error ? error.message : 'Settings unavailable.', 'warning'))
    void window.dbforge.listUserSnippets().then(setUserSnippets).catch(() => setUserSnippets([]))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => { media.removeEventListener('change', onChange); window.removeEventListener('dbforge:settings-changed', onSettingsChanged); window.removeEventListener('dbforge:close-panel', onClosePanel) }
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribe = window.dbforge.onUpdaterStatus((next) => {
      if (!active) return
      setUpdateState(next)
      if (next.phase === 'available') setUpdateDialogOpen(true)
    })
    void window.dbforge.updaterStatus().then((next) => { if (active) setUpdateState(next) }).catch(() => undefined)
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('dbforge.theme', themeMode)
  }, [theme, themeMode])

  useEffect(() => {
    const insertSql = (event: Event): void => {
      const sql = (event as CustomEvent<{ sql?: string }>).detail?.sql
      if (typeof sql !== 'string' || !sql.trim()) return
      const id = `sql-${crypto.randomUUID()}`
      setDocuments((current) => [...current, { id, label: 'AI Assistant SQL', modified: false }])
      setSqlByDocument((current) => ({ ...current, [id]: sql }))
      setSelectedDocument(id)
      setOpenPanel(null)
    }
    window.addEventListener('dbforge:insert-ai-sql', insertSql)
    const removeOpenSql = window.dbforge.onOpenSqlPath((path) => {
      void window.dbforge.openSqlPath(path).then((file) => {
        const id = `sql-${crypto.randomUUID()}`
        setDocuments((current) => [...current, { id, label: file.path.split('/').at(-1) ?? 'query.sql', filePath: file.path, modified: false }])
        setSqlByDocument((current) => ({ ...current, [id]: file.contents }))
        setSelectedDocument(id)
      }).catch((error: unknown) => log('File', error instanceof Error ? error.message : 'Não foi possível abrir o arquivo SQL.', 'error'))
    })
    return () => { window.removeEventListener('dbforge:insert-ai-sql', insertSql); removeOpenSql() }
  }, [])

  useEffect(() => { localStorage.setItem('dbforge.explorerVisible', String(explorerVisible)) }, [explorerVisible])
  useEffect(() => { localStorage.setItem('dbforge.panelVisible', String(panelVisible)) }, [panelVisible])
  useEffect(() => { localStorage.setItem('dbforge.explorerWidth', String(explorerWidth)) }, [explorerWidth])
  useEffect(() => { localStorage.setItem('dbforge.panelHeight', String(panelHeight)) }, [panelHeight])
  useEffect(() => { localStorage.setItem('dbforge.documents', JSON.stringify(documents)) }, [documents])
  useEffect(() => { localStorage.setItem('dbforge.selectedDocument', selectedDocument) }, [selectedDocument])
  useEffect(() => { localStorage.setItem('dbforge.sqlDrafts', JSON.stringify(sqlByDocument)) }, [sqlByDocument])
  useEffect(() => { metadataRef.current = editorMetadata }, [editorMetadata])

  useEffect(() => {
    let cancelled = false
    setHistoryLoading(true)
    void window.dbforge.listSqlExecutionHistory({ search: historySearch, limit: 200 }).then((entries) => { if (!cancelled) setHistory(entries) }).catch((error: unknown) => { if (!cancelled) log('History', error instanceof Error ? error.message : 'Não foi possível carregar o histórico.', 'error') }).finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [historySearch])

  useEffect(() => {
    let cancelled = false
    if (!currentConnection?.database) { setEditorMetadata(emptyEditorMetadata); setMetadataLoading(false); return }
    setMetadataLoading(true)
    void window.dbforge.getEditorMetadata(currentConnection.id, currentConnection.database).then((value) => { if (!cancelled) setEditorMetadata(value) }).catch((error: unknown) => { if (!cancelled) { setEditorMetadata({ ...emptyEditorMetadata, database: currentConnection.database ?? '' }); log('Editor', error instanceof Error ? error.message : 'Autocomplete contextual indisponível.', 'warning') } }).finally(() => { if (!cancelled) setMetadataLoading(false) })
    return () => { cancelled = true }
  }, [currentConnection?.id, currentConnection?.database])

  async function loadConnections(): Promise<void> {
    try { setRecords(await window.dbforge.getConnections()); setLoadError('') }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Não foi possível ler as conexões.') }
  }

  function log(origin: string, message: string, tone = 'info'): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setOutput((current) => [...current, { timestamp, origin, message: maskSecrets(message), tone }].slice(-500))
  }

  async function checkForUpdates(): Promise<void> {
    try {
      const next = await window.dbforge.updaterCheck()
      setUpdateState(next)
      if (next.phase === 'available' || next.phase === 'error') setUpdateDialogOpen(true)
    } catch (error) { setUpdateState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : 'Update check failed.' })); setUpdateDialogOpen(true) }
  }

  async function applyUpdate(): Promise<void> {
    try {
      let next = await window.dbforge.updaterApply(false)
      if (next.phase === 'blocked' && (queryBusy || (!autoCommit && !transactionCommitted))) {
        if (window.confirm(next.message ?? t('updates.busyConfirm'))) next = await window.dbforge.updaterApply(true)
      }
      setUpdateState(next)
    } catch (error) { setUpdateState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : 'Update failed.' })) }
  }

  async function ignoreUpdate(): Promise<void> {
    if (!updateState.newVersion) return
    try {
      const { settings } = await window.dbforge.loadSettings()
      const next = await window.dbforge.saveSettings({ ...settings, updater: { ...settings.updater, ignoredVersion: updateState.newVersion } })
      setAppSettings(next)
      setUpdateState((current) => ({ ...current, phase: 'up-to-date', message: undefined, summary: [] }))
      setUpdateDialogOpen(false)
    } catch (error) { log('Updater', error instanceof Error ? error.message : 'Could not ignore this version.', 'error') }
  }

  function openNewConnection(): void {
    setDialogRecord(createDefaultConnection(crypto.randomUUID(), 'localhost:3306'))
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
    if (action === 'connect' && !record.database?.trim() && !window.confirm(t('explorer.connect.noDefaultDatabase'))) return
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

  function openObjectEditor(connection: ConnectionSummary, database: string, kind: DatabaseObjectKind, name: string, isNew = false): void {
    const id = `object-${crypto.randomUUID()}`
    const objectEditor = { connectionId: connection.id, database, kind, name, isNew }
    setDocuments((current) => [...current, { id, label: `${kind === 'table' ? '▤' : '◇'} ${name}`, modified: false, objectEditor }])
    setSelectedDocument(id)
  }

  function formatEditor(target: 'document' | 'selection' | 'statement'): void {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const source = model.getValue()
    let range: IRange
    let text: string
    if (target === 'selection') {
      const selection = editor.getSelection()
      if (!selection || selection.isEmpty()) return
      range = selection
      text = model.getValueInRange(selection)
    } else if (target === 'statement') {
      const position = editor.getPosition()
      const statement = statementAtOffset(source, position ? model.getOffsetAt(position) : 0)
      if (!statement) return
      range = { ...model.getFullModelRange(), startLineNumber: model.getPositionAt(statement.start).lineNumber, startColumn: model.getPositionAt(statement.start).column, endLineNumber: model.getPositionAt(statement.end).lineNumber, endColumn: model.getPositionAt(statement.end).column }
      text = source.slice(statement.start, statement.end)
    } else {
      range = model.getFullModelRange()
      text = source
    }
    const formatted = formatSql(text)
    if (formatted === text) return
    editor.pushUndoStop()
    editor.executeEdits('dbforge.sql-format', [{ range, text: formatted, forceMoveMarkers: true }])
    editor.pushUndoStop()
    editor.focus()
  }

  async function runCodeAnalysis(): Promise<void> {
    if (!activeSqlText.trim()) return
    try {
      const findings = await window.dbforge.analyzeSql(activeSqlText)
      setAnalysisFindings(findings)
      setPanelTab('Error List')
      setPanelVisible(true)
      log('Code Analysis', findings.length ? `Analysis complete · ${findings.length} findings.` : 'Code analysis complete · No issues found.', findings.some((item) => item.severity === 'Error') ? 'error' : 'success')
    } catch (error) { log('Code Analysis', error instanceof Error ? error.message : 'Code Analysis Error', 'error') }
  }

  async function persistExecutionHistory(sql: string, startedAt: number, success: boolean, rowCount: number, error?: string): Promise<void> {
    if (!currentConnection) return
    const entry: SqlExecutionHistoryEntry = {
      id: crypto.randomUUID(), timestamp: new Date().toISOString(), connection: currentConnection.name,
      ...(currentConnection.database ? { database: currentConnection.database } : {}), sql,
      elapsedMs: Math.max(0, performance.now() - startedAt), success, rowCount, ...(error ? { error } : {})
    }
    try {
      await window.dbforge.recordSqlExecutionHistory(entry)
      setHistory(await window.dbforge.listSqlExecutionHistory({ search: historySearch, limit: 200 }))
    } catch (reason) { log('History', reason instanceof Error ? reason.message : 'Não foi possível registrar a consulta.', 'error') }
  }

  function replayHistory(entry: SqlExecutionHistoryEntry): void {
    openSqlDocument(`History · ${new Date(entry.timestamp).toLocaleString()}`, entry.sql)
    void runSql('auto', entry.sql)
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

  async function saveAllSql(): Promise<void> {
    for (const tab of documents.filter((item) => item.id !== 'start' && item.filePath)) {
      try {
        const path = await window.dbforge.saveSqlFile(tab.filePath, sqlByDocument[tab.id] ?? '')
        if (path) setDocuments((current) => current.map((item) => item.id === tab.id ? { ...item, label: path.split('/').at(-1) ?? item.label, filePath: path, modified: false } : item))
      } catch (error) { log('File', error instanceof Error ? error.message : `Could not save ${tab.label}.`, 'error') }
    }
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
      const next = await window.dbforge.executeSql(currentConnection.id, sql, crypto.randomUUID(), currentConnection.database)
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
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    const kind = object.kind.toUpperCase()
    try {
      await window.dbforge.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'drop')
      log('Explorer', `${kind} ${object.name} removido.`, 'success')
      await loadObjects(connection, database)
    } catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao remover ${object.name}.`, 'error') }
  }

  async function renameTable(connection: ConnectionSummary, database: string, object: DatabaseObject, newName: string): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    try { await window.dbforge.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'rename', newName); log('Explorer', `Tabela ${object.name} renomeada para ${newName}.`, 'success'); await loadObjects(connection, database) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao renomear ${object.name}.`, 'error') }
  }

  async function truncateTable(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    try { await window.dbforge.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'truncate'); log('Explorer', `Tabela ${object.name} truncada.`, 'success'); await loadObjects(connection, database) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao truncar ${object.name}.`, 'error') }
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

  async function runSql(mode: 'auto' | 'current' = 'auto', queryOverride?: string): Promise<void> {
    if (!currentConnection || (!activeSql && queryOverride === undefined)) return
    const source = sqlByDocument[selectedDocument] ?? ''
    const selection = editorRef.current?.getSelection()
    const selectedText = selection && !selection.isEmpty() ? editorRef.current?.getModel()?.getValueInRange(selection) : ''
    const model = editorRef.current?.getModel()
    const position = editorRef.current?.getPosition()
    const currentOffset = model && position ? model.getOffsetAt(position) : 0
    const current = mode === 'current' ? statementAtOffset(source, currentOffset)?.sql : undefined
    const sql = (queryOverride ?? (mode === 'current' ? current ?? '' : selectedText || source)).trim()
    if (!sql) return
    const statements = splitSqlStatements(sql)
    const destructive = statements.some(({ sql: statement }) => /\b(DROP|TRUNCATE)\b/i.test(statement) || (/\b(DELETE|UPDATE)\b/i.test(statement) && !/\bWHERE\b/i.test(statement)))
    if (destructive) {
      if (currentRecord?.environment === 'prod') {
        const databaseName = currentConnection.database ?? t('conn.database.none')
        if (window.prompt(t('security.prod.confirm', [databaseName])) !== databaseName) return
      } else if (!window.confirm(t('security.destructive.confirm'))) return
    }
    const token = crypto.randomUUID()
    const startedAt = performance.now()
    if (pageQueries[selectedDocument]) setPageQueries((current) => ({ ...current, [selectedDocument]: { ...current[selectedDocument], offset: 1000 } }))
    for (const result of results) if (result.resultStoreId) void window.dbforge.disposeResult(result.resultStoreId)
    setExecutionId(token); setQueryBusy(true); setQueryMessages([]); setResults([]); setResultIndex(-1)
    setStatus('Executing…')
    const next: QueryResult[] = []
    const messages: string[] = []
    try {
      const canBatchScript = statements.length >= 100 && currentRecord?.advanced.multipleStatements && statements.every(({ sql: statement }) => !/^\s*(SELECT|WITH)\b/i.test(statement))
      if (canBatchScript) {
        const requestId = `${token}:batch`; setExecutionId(requestId)
        next.push(...await window.dbforge.executeSql(currentConnection.id, statements.map(({ sql: statement }) => statement).join(';\n') + ';', requestId))
        const returnedRows = next.reduce((total, result) => total + (result.rowCount ?? result.rows.length), 0)
        messages.push(`OK · ${statements.length} statements · ${returnedRows} rows · ${((performance.now() - startedAt) / 1000).toFixed(3)} s`)
        setResults([...next]); setQueryMessages([...messages])
      } else {
        let ignoreAllErrors = false
        for (const [index, statement] of statements.entries()) {
          const requestId = `${token}:${index}`
          setExecutionId(requestId)
          let statementResults: QueryResult[]
          try { statementResults = await window.dbforge.executeSql(currentConnection.id, statement.sql, requestId, currentConnection.database) }
          catch (statementError) {
            const code = statementError && typeof statementError === 'object' ? String((statementError as { code?: unknown }).code ?? '') : ''
            if (code === 'ER_QUERY_INTERRUPTED' || code === '1317' || (statementError instanceof Error && statementError.name === 'AbortError')) throw statementError
            const reason = maskSecrets(statementError instanceof Error ? statementError.message : 'Statement failed.')
            if (!ignoreAllErrors) {
              const choice = window.prompt(t('utilities.errorDialog', [index + 1, reason]), 'Stop')?.trim().toLowerCase()
              if (choice === 'stop' || choice === 'parar' || choice !== 'continue' && choice !== 'continuar' && choice !== 'ignore all' && choice !== 'ignorar todos') throw statementError
              if (choice === 'ignore all' || choice === 'ignorar todos') ignoreAllErrors = true
            }
            messages.push(`ERROR · statement ${index + 1} · ${reason}`)
            setQueryMessages([...messages])
            continue
          }
          next.push(...statementResults)
          if (index % 50 === 0 || index === statements.length - 1) setResults([...next])
          const returnedRows = statementResults.reduce((total, result) => total + (result.rowCount ?? result.rows.length), 0)
          messages.push(`OK · ${returnedRows} rows · ${((performance.now() - startedAt) / 1000).toFixed(3)} s`)
          if (index % 50 === 0 || index === statements.length - 1) setQueryMessages([...messages])
        }
      }
      setResults(next); setQueryMessages(messages); setResultIndex(next.length ? 0 : -1)
      if (next.length) setPanelVisible(false)
      if (pageQueries[selectedDocument] && (next[0]?.rowCount ?? next[0]?.rows.length ?? 0) < 1000) setPageQueries((current) => { const updated = { ...current }; delete updated[selectedDocument]; return updated })
      setErrors([])
      setStatus(t('editor.query.success'))
      setQueryElapsed(performance.now() - startedAt)
      if (queryProfilingMode && statements.length === 1 && /^\s*(SELECT|WITH)\b/i.test(statements[0]!.sql)) {
        try {
          const profile = await window.dbforge.profile(currentConnection.id, statements[0]!.sql)
          openRegisteredPanel('profiler')
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('dbforge:profiler-profile', { detail: profile })), 100)
        } catch (error) { log('Profiler', error instanceof Error ? error.message : 'The query plan could not be collected.', 'warning') }
      }
      await persistExecutionHistory(sql, startedAt, true, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0))
      if (currentConnection.database && /\b(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i.test(sql)) {
        try { setEditorMetadata(await window.dbforge.getEditorMetadata(currentConnection.id, currentConnection.database, true)) }
        catch (error) { log('Editor', error instanceof Error ? error.message : 'O cache do esquema não foi atualizado.', 'warning') }
      }
      log('Execution', `Consulta concluída · ${next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0)} rows.`, 'success')
    } catch (error) {
      const code = typeof error === 'object' && error ? String((error as { code?: unknown }).code ?? '') : ''
      if (code === 'ER_QUERY_INTERRUPTED' || code === '1317' || (error instanceof Error && error.name === 'AbortError')) {
        setQueryMessages((current) => [...current, 'Execução cancelada.'])
        setResultIndex(next.length ? 0 : -1)
        setStatus('Ready')
        await persistExecutionHistory(sql, startedAt, false, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0), 'Execução cancelada.')
        return
      }
      const message = error instanceof Error ? error.message : 'Falha na consulta.'
      const detail = error && typeof error === 'object' ? error as { code?: string; errno?: number; lineNumber?: number; columnNumber?: number } : {}
      const match = /at (?:line )?(\d+)(?:,? column (\d+))?/i.exec(message)
      const line = detail.lineNumber ?? Number(match?.[1] ?? 0)
      const column = detail.columnNumber ?? Number(match?.[2] ?? 0)
      const lostConnection = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'].includes(detail.code ?? '')
      const safeMessage = maskSecrets(message)
      if (lostConnection && currentConnection && currentRecord?.advanced.autoReconnect) {
        try {
          await window.dbforge.disconnect(currentConnection.id)
          setActive((current) => current.filter((item) => item.id !== currentConnection.id))
          await runConnectionAction(currentRecord, emptySecrets(), true, 'connect')
          log('Connections', 'A conexão caiu durante a execução e foi restabelecida. A consulta com falha não foi repetida.', 'warning')
        } catch { log('Connections', 'A conexão caiu e a reconexão automática falhou. Reconecte pelo Explorer.', 'warning') }
      }
      const shownMessage = `${detail.code ? `${detail.code}${detail.errno ? ` ${detail.errno}` : ''}: ` : ''}${lostConnection ? `A conexão caiu durante a execução. Verifique a rede e reconecte antes de repetir a consulta. (${safeMessage})` : safeMessage}${line ? ` · line ${line}${column ? `, column ${column}` : ''}` : ''}`
      setErrors([shownMessage]); setQueryMessages([...messages, shownMessage]); setResultIndex(-1); setPanelTab('Error List'); setPanelVisible(true); setStatus('Error'); log('Execution', shownMessage, 'error')
      await persistExecutionHistory(sql, startedAt, false, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0), shownMessage)
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
      if (enabled) { setTransactionCommitted(true); setTransactionRevision((value) => value + 1) }
      setAutoCommit(enabled)
      log('Transaction', enabled ? 'Transação confirmada.' : 'Transação manual iniciada.')
    } catch (error) { log('Transaction', error instanceof Error ? error.message : 'Falha na transação.', 'error') }
  }

  async function finishTransaction(action: 'commit' | 'rollback'): Promise<void> {
    if (!currentConnection || autoCommit) return
    try {
      if (action === 'commit') await window.dbforge.commitTransaction(currentConnection.id)
      else await window.dbforge.rollbackTransaction(currentConnection.id)
      setTransactionCommitted(action === 'commit'); setTransactionRevision((value) => value + 1)
      setAutoCommit(true)
      log('Transaction', action === 'commit' ? 'Alterações confirmadas.' : 'Alterações desfeitas.')
    } catch (error) { log('Transaction', error instanceof Error ? error.message : 'Falha na transação.', 'error') }
  }

  function newSql(): void {
    const id = `sql-${crypto.randomUUID()}`
    const number = documents.filter((tab) => tab.id !== 'start').length + 1
    setDocuments((current) => [...current, { id, label: `SQL ${number}`, modified: false }])
    setSqlByDocument((current) => ({ ...current, [id]: '' }))
    setSelectedDocument(id)
  }

  function openRegisteredPanel(panelId: string): void {
    const entry = panelRegistry.find((item) => item.id === panelId)
    if (entry?.presentation === 'document') {
      const id = `panel-${panelId}-${crypto.randomUUID()}`
      const number = documents.filter((tab) => tab.panelId === panelId).length + 1
      setDocuments((current) => [...current, { id, label: `${t(entry.titleKey)} ${number}`, modified: false, panelId }])
      setSelectedDocument(id)
      return
    }
    setOpenPanel(panelId)
  }

  function openDatabaseToolTab(tab: string): void {
    openRegisteredPanel('database-tools')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('dbforge:database-tool-tab', { detail: tab })), 120)
  }

  function sendDebuggerCommand(command: string): void {
    openRegisteredPanel('routine-debugger')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('dbforge:shortcut-command', { detail: { command } })), 100)
  }

  function openFind(replace = false, files = false): void {
    setFindOpen(true); setFindInFiles(files); setFindScope(files ? 'open' : 'document')
    setFindReplaceMode(replace)
    setTimeout(() => document.querySelector<HTMLInputElement>('.find-toolbar input[type="search"]')?.focus(), 0)
  }

  function runFind(): void {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!findQuery || !model) { setFindMatches([]); return }
    const docs = findInFiles || findScope === 'open' ? documents.filter((tab) => tab.id !== 'start' && !tab.panelId && !tab.objectEditor) : [documents.find((tab) => tab.id === selectedDocument)].filter((tab): tab is DocumentTab => Boolean(tab))
    const found = docs.flatMap((tab) => {
      const sql = sqlByDocument[tab.id] ?? ''
      const selection = findScope === 'selection' && tab.id === selectedDocument ? editor?.getSelection() : null
      if (findScope === 'selection' && tab.id === selectedDocument && (!selection || selection.isEmpty())) return []
      const start = selection && editor ? model.getOffsetAt(selection.getStartPosition()) : undefined
      const end = selection && editor ? model.getOffsetAt(selection.getEndPosition()) : undefined
      const matches = findMatchesForScope(sql, findQuery, findRegex, findCase, start, end)
      return matches.map((match) => ({ ...match, documentId: tab.id, documentLabel: tab.label }))
    }).slice(0, 5000)
    setFindMatches(found)
    setPanelVisible(true); setPanelTab('Find Results')
  }

  function navigateToMatch(match: TextMatch & { documentId: string }): void {
    const documentId = match.documentId || navigationSqlDocument?.id || selectedDocument
    if (documentId !== selectedDocument) setSelectedDocument(documentId)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = editorRef.current
      const model = target?.getModel()
      if (!target || !model) return
      const start = model.getPositionAt(match.offset)
      const end = model.getPositionAt(match.offset + match.length)
      target.setSelection({ startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column })
      target.revealPositionInCenter(start); target.focus()
    }))
  }

  function replaceAllMatches(): void {
    if (!findQuery) return
    const docs = findInFiles || findScope === 'open' ? documents.filter((tab) => tab.id !== 'start' && !tab.panelId && !tab.objectEditor) : [documents.find((tab) => tab.id === selectedDocument)].filter((tab): tab is DocumentTab => Boolean(tab))
    const updates: Record<string, string> = {}
    for (const tab of docs) {
      const source = sqlByDocument[tab.id] ?? ''
      const editor = tab.id === selectedDocument ? editorRef.current : null
      const model = editor?.getModel()
      const selection = findScope === 'selection' && model ? editor?.getSelection() : null
      if (findScope === 'selection' && tab.id === selectedDocument && (!selection || selection.isEmpty())) continue
      const start = selection && model ? model.getOffsetAt(selection.getStartPosition()) : 0
      const end = selection && model ? model.getOffsetAt(selection.getEndPosition()) : source.length
      const region = source.slice(start, end)
      let expression: RegExp
      try { expression = new RegExp(findRegex ? findQuery : escapeRegExp(findQuery), `${findCase ? 'g' : 'gi'}m`) } catch { return }
      updates[tab.id] = source.slice(0, start) + region.replace(expression, replaceQuery) + source.slice(end)
    }
    setSqlByDocument((current) => ({ ...current, ...updates }))
    setDocuments((current) => current.map((tab) => updates[tab.id] === undefined ? tab : { ...tab, modified: true }))
  }

  function cycleFind(direction: 1 | -1): void {
    if (!findMatches.length) return
    const model = editorRef.current?.getModel()
    const position = editorRef.current?.getPosition()
    const offset = model && position ? model.getOffsetAt(position) : 0
    const currentIndex = direction > 0
      ? findMatches.findIndex((match) => match.documentId === selectedDocument && match.offset > offset)
      : [...findMatches].reverse().findIndex((match) => match.documentId === selectedDocument && match.offset < offset)
    const index = currentIndex < 0 ? (direction > 0 ? 0 : findMatches.length - 1) : direction > 0 ? currentIndex : findMatches.length - 1 - currentIndex
    navigateToMatch(findMatches[index]!)
  }

  function replaceCurrentMatch(): void {
    const match = findMatches.find((item) => item.documentId === selectedDocument) ?? findMatches[0]
    if (!match) return
    const source = sqlByDocument[match.documentId] ?? ''
    const matched = source.slice(match.offset, match.offset + match.length)
    let replacement = replaceQuery
    if (findRegex) {
      try { replacement = matched.replace(new RegExp(findQuery, findCase ? '' : 'i'), replaceQuery) } catch { return }
    }
    const updated = source.slice(0, match.offset) + replacement + source.slice(match.offset + match.length)
    setSqlByDocument((current) => ({ ...current, [match.documentId]: updated }))
    setDocuments((current) => current.map((tab) => tab.id === match.documentId ? { ...tab, modified: true } : tab))
  }

  function showObjectProperties(connection: ConnectionSummary, database: string, object: DatabaseObject): void {
    setSelectedExplorerObject({ connection, database, object })
    openRegisteredPanel('object-viewer')
  }

  async function handleExplorerContextAction(action: string, context: ExplorerContext): Promise<void> {
    const { connection, database, object } = context
    const db = database ?? connection.database ?? ''
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.advanced.readOnly && ['newTable', 'importData', 'generateData', 'truncateTable', 'duplicateObject', 'editPrivileges', 'rename', 'deleteObject'].includes(action)) {
      log('Explorer', t('explorer.readOnly'), 'warning')
      return
    }
    setSelectedExplorerContext(context)
    if (object) setSelectedExplorerObject({ connection, database: db, object })
    else setSelectedExplorerObject(undefined)
    if (context.target === 'database' && database) { try { await window.dbforge.setDatabase(connection.id, database) } catch { /* keep the selected database context for the panel */ } }
    setSelectedExplorerIntent(action)
    const openScript = (sql: string, label: string): void => { openSqlDocument(label, sql) }
    if (action.startsWith('sendTo.')) {
      const destination = action.slice('sendTo.'.length)
      if (destination === 'queryBuilder') openRegisteredPanel('query-builder')
      else if (destination === 'masterDetail') openRegisteredPanel('master-detail')
      else if (destination === 'databaseDiagram') openRegisteredPanel('er-diagram')
      else if (destination === 'dataReport' || destination === 'chartDesigner' || destination === 'pivotTable') openRegisteredPanel('data-report-pivot')
      return
    }
    const script = /^(create|drop|dropAndCreate|select|insert|update|delete|crud)\.(newSqlWindow|file|clipboard)$/.exec(action)
    if (script && object && db) {
      const operation = script[1] as ScriptKind
      let createSql = ''
      if (operation === 'create' || operation === 'dropAndCreate') {
        try { createSql = await window.dbforge.showCreateObject(connection.id, db, object) }
        catch (error) { log('Explorer', error instanceof Error ? error.message : 'Unable to load object definition.', 'error'); return }
      }
      const sql = buildExplorerSql(operation, object.kind, db, object.name, createSql)
      const destination = script[2]
      if (destination === 'newSqlWindow') openScript(sql, `${operation.toUpperCase()} ${object.name}`)
      else if (destination === 'clipboard') { try { await navigator.clipboard.writeText(sql) } catch { log('Explorer', 'Could not copy SQL to the clipboard.', 'warning') } }
      else {
        try { await window.dbforge.saveSqlFile(undefined, sql) }
        catch (error) { log('Explorer', error instanceof Error ? error.message : 'Could not save SQL file.', 'error') }
      }
      return
    }
    if (action === 'newTable' && db) { openObjectEditor(connection, db, 'table', 'new_table', true); return }
    if (action === 'newDatabase') { openScript('CREATE DATABASE `database_name`;', 'New Database'); return }
    if (action === 'newConnection') { openNewConnection(); return }
    if (action === 'openEditor' && object && db) { openObjectEditor(connection, db, object.kind, object.name); return }
    if (action === 'openData' && object && db) { selectTop(connection, db, object); return }
    if (action === 'selectAllRows' && object && db) { openScript(`SELECT * FROM ${quoteExplorerIdentifier(db)}.${quoteExplorerIdentifier(object.name)};`, `${object.name} · all rows`); return }
    if (action === 'exportData' || action === 'importData') { openRegisteredPanel('import-export'); return }
    if (action === 'generateData') { openRegisteredPanel('data-generator'); return }
    if (action === 'tableMaintenance' && !object) { openRegisteredPanel('database-tools'); return }
    if (action === 'tableMaintenance' && object && db) {
      const target = `${quoteExplorerIdentifier(db)}.${quoteExplorerIdentifier(object.name)}`
      openScript([`ANALYZE TABLE ${target};`, `CHECK TABLE ${target};`, `OPTIMIZE TABLE ${target};`, `REPAIR TABLE ${target};`].join('\n'), `Maintenance · ${object.name}`)
      return
    }
    if (action === 'flush') {
      const target = object && db ? ` ${quoteExplorerIdentifier(db)}.${quoteExplorerIdentifier(object.name)}` : ''
      openScript(`FLUSH TABLES${target};`, 'Flush Tables')
      return
    }
    if (action === 'truncateTable' && object && db) {
      if (!window.confirm(t('explorer.truncate.prompt', [object.name]))) return
      await truncateTable(connection, db, object)
      return
    }
    if (action === 'duplicateObject' && object && db) {
      const name = window.prompt(t('explorer.duplicate.prompt'), `${object.name}_copy`)?.trim()
      if (name) openScript(`CREATE TABLE ${quoteExplorerIdentifier(db)}.${quoteExplorerIdentifier(name)} LIKE ${quoteExplorerIdentifier(db)}.${quoteExplorerIdentifier(object.name)};`, `Duplicate ${object.name}`)
      return
    }
    if (action === 'editPrivileges') { openRegisteredPanel('security'); return }
    if ((action === 'showDetails' || action === 'properties') && object) { showObjectProperties(connection, db, object); return }
    if (action === 'showDetails' || action === 'properties') { openRegisteredPanel(context.target === 'server' ? 'sessions' : 'database-tools'); return }
    if (action === 'serverDetails') { openRegisteredPanel('sessions'); return }
    if (action === 'backup' && db) { try { await window.dbforge.backupDatabase(connection.id, db, true) } catch (error) { log('Explorer', error instanceof Error ? error.message : 'Backup failed.', 'error') }; return }
    if (action === 'rename' && object && db) {
      const next = window.prompt(t('explorer.rename.prompt', [object.name]), object.name)?.trim()
      if (next && next !== object.name) await renameTable(connection, db, object, next)
      return
    }
    if (action === 'deleteObject' && object && db) {
      if (!window.confirm(t('explorer.delete.prompt', [object.kind, object.name]))) return
      await dropObject(connection, db, object)
      return
    }
    if (action === 'refresh') {
      if (context.target === 'server') { const record = records.find((item) => item.id === connection.recordId); if (record) await expandRecord(record) }
      else if (database) await loadObjects(connection, database)
      else { const record = records.find((item) => item.id === connection.recordId); if (record) await expandRecord(record) }
      return
    }
  }

  const runFindRef = useRef(runFind)
  runFindRef.current = runFind
  useEffect(() => { if (findOpen) runFindRef.current() }, [findOpen, findQuery, findRegex, findCase, findScope, findInFiles, documents, sqlByDocument, selectedDocument])

  function panelContents(Component: React.ComponentType): React.JSX.Element {
    const editorContext = {
      sql: navigationSqlText,
      onFindings: setAnalysisFindings,
      insertText: (text: string, snippet = false): void => {
        const editor = editorRef.current
        if (!editor) return
        editor.trigger('toolbox', snippet ? 'editor.action.insertSnippet' : 'type', snippet ? { snippet: text } : { text })
      }
    }
    const panelConnection = selectedExplorerContext ? { ...selectedExplorerContext.connection, database: selectedExplorerContext.database ?? selectedExplorerContext.connection.database } : currentConnection
    const navigationContext = { matches: navigationMatches, onNavigate: navigateToMatch, selectedObject: selectedExplorerContext?.object && selectedExplorerContext.database ? { connection: selectedExplorerContext.connection, database: selectedExplorerContext.database, object: selectedExplorerContext.object } : selectedExplorerObject, selectedIntent: selectedExplorerIntent, onSelectSchemaObject: (object: DatabaseObject) => { if (currentConnection && editorMetadata.database) { setSelectedExplorerObject({ connection: currentConnection, database: editorMetadata.database, object }); openRegisteredPanel('object-viewer') } }, onOpenObjectViewer: () => openRegisteredPanel('object-viewer'), metadata: editorMetadata }
    return <PanelConnectionContext.Provider value={panelConnection}><PanelEditorContext.Provider value={editorContext}><PanelNavigationContext.Provider value={navigationContext}><Component /></PanelNavigationContext.Provider></PanelEditorContext.Provider></PanelConnectionContext.Provider>
  }

  function renderErrorList(): React.JSX.Element {
    if (!errors.length && !analysisFindings.length) return <div className="error-list"><p>{t('app.errors.empty')}</p></div>
    return <div className="error-list"><table><thead><tr><th>Severity</th><th># / Rule</th><th>Message</th><th>Document</th><th>Line</th><th>Column</th></tr></thead><tbody>
      {errors.map((error, index) => <tr key={`error-${index}`}><td className="field-error">● Error</td><td>{index + 1}</td><td>{error}</td><td>{documents.find((tab) => tab.id === selectedDocument)?.label}</td><td>—</td><td>—</td></tr>)}
      {analysisFindings.map((finding) => <tr key={`${finding.ruleId}:${finding.line}:${finding.column}`} onClick={() => { editorRef.current?.setPosition({ lineNumber: finding.line, column: finding.column }); editorRef.current?.focus() }} style={{ cursor: 'pointer' }}><td className={`analysis-${finding.severity.toLowerCase()}`}>{finding.severity}</td><td>{finding.ruleId}</td><td>{t(`analysis.rule.${finding.ruleId}`)}</td><td>{documents.find((tab) => tab.id === selectedDocument)?.label}</td><td>{finding.line}</td><td>{finding.column}</td></tr>)}
    </tbody></table></div>
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
      if (event.defaultPrevented) return
      const ctrl = event.ctrlKey || event.metaKey
      const pressed = [ctrl ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key) ? '' : event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+')
      const combined = shortcutChordRef.current ? `${shortcutChordRef.current} ${pressed}` : pressed
      const hasChordContinuation = appSettings.shortcuts.bindings.some((binding) => binding.shortcut && normalizeShortcut(binding.shortcut).startsWith(`${normalizeShortcut(combined)} `))
      if (hasChordContinuation) { shortcutChordRef.current = combined; event.preventDefault(); return }
      const customBinding = appSettings.shortcuts.bindings.find((binding) => binding.shortcut && normalizeShortcut(binding.shortcut) === normalizeShortcut(combined) && (binding.context === 'Global' || (binding.context === 'Editor' && activeSql) || (binding.context === 'Debugger' && openPanel === 'routine-debugger')))
      shortcutChordRef.current = ''
      if (customBinding) {
        event.preventDefault()
        if (customBinding.command === 'New SQL Document') newSql()
        else if (customBinding.command.startsWith('New Connection')) openNewConnection()
        else if (customBinding.command === 'Open SQL File') void openSqlFile()
        else if (customBinding.command === 'Save SQL') void saveCurrentSql()
        else if (customBinding.command === 'Save All') void saveAllSql()
        else if (customBinding.command === 'Close Tab') closeTab(selectedDocument)
        else if (customBinding.command === 'Exit') window.close()
        else if (customBinding.command.startsWith('Execute SQL')) void runSql()
        else if (customBinding.command.startsWith('Execute Current Statement')) void runSql('current')
        else if (customBinding.command === 'Format Document') formatEditor('document')
        else if (customBinding.command === 'Format Selection') formatEditor('selection')
        else if (customBinding.command === 'Format Current Statement') formatEditor('statement')
        else if (customBinding.command === 'Code Analysis') void runCodeAnalysis()
        else if (customBinding.command.startsWith('Stop Execution')) void cancelSql()
        else if (customBinding.command === 'Comment Selection') editorRef.current?.trigger('keyboard', 'editor.action.commentLine', null)
        else if (customBinding.command === 'Comment Selection (alternate)') editorRef.current?.trigger('keyboard', 'editor.action.commentLine', null)
        else if (customBinding.command === 'Show Database Explorer') setExplorerVisible((value) => !value)
        else if (customBinding.command === 'Show Output') { setPanelVisible(true); setPanelTab('Output') }
        else if (customBinding.command === 'Show Error List') { setPanelVisible(true); setPanelTab('Error List') }
        else if (customBinding.command === 'Show Security Manager') openRegisteredPanel('security')
        else if (customBinding.command === 'Show Session Manager') openRegisteredPanel('sessions')
        else if (customBinding.command === 'Show Server Variables') openRegisteredPanel('database-tools')
        else if (customBinding.command === 'Show Service Control') openRegisteredPanel('service-control')
        else if (customBinding.command === 'Show Schema View') openRegisteredPanel('schema-view')
        else if (customBinding.command === 'Show Data Viewer') openRegisteredPanel('object-viewer')
        else if (customBinding.command === 'Show Document Outline') openRegisteredPanel('document-outline')
        else if (customBinding.command === 'Show Code Snippets') openRegisteredPanel('snippets-manager')
        else if (customBinding.command === 'Show Project Explorer') setExplorerVisible(true)
        else if (customBinding.command === 'Show Properties' && selectedExplorerObject) showObjectProperties(selectedExplorerObject.connection, selectedExplorerObject.database, selectedExplorerObject.object)
        else if (customBinding.command === 'View Start Page') setSelectedDocument('start')
        else if (customBinding.command === 'Options') openRegisteredPanel('options')
        else if (customBinding.command === 'Source Control Manager') openRegisteredPanel('source-control')
        else if (customBinding.command === 'Find in Database') openRegisteredPanel('database-tools')
        else if (customBinding.command === 'Find Invalid Objects') openRegisteredPanel('database-tools')
        else if (customBinding.command === 'Find') openFind(false, false)
        else if (customBinding.command === 'Replace') openFind(true, false)
        else if (customBinding.command === 'Find in Files') openFind(false, true)
        else if (customBinding.command === 'Document Outline') openRegisteredPanel('document-outline')
        else if (customBinding.command === 'Go To Line') { editorRef.current?.focus(); editorRef.current?.trigger('keyboard', 'editor.action.gotoLine', null) }
        else if (customBinding.command === 'Complete') { editorRef.current?.focus(); editorRef.current?.trigger('keyboard', 'editor.action.triggerSuggest', null) }
        else if (customBinding.command === 'Show Find Object') openRegisteredPanel('database-tools')
        else if (customBinding.command === 'Show Command Palette') window.dispatchEvent(new CustomEvent('dbforge:shortcut-command', { detail: { command: customBinding.command } }))
        else if (customBinding.command === 'Show Help') void window.dbforge.openAboutLink('documentation')
        else window.dispatchEvent(new CustomEvent('dbforge:shortcut-command', { detail: { command: customBinding.command } }))
        return
      }
      const targetIsInput = event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)
      if (event.key === 'F2' && selectedExplorerObject?.object.kind === 'table' && !activeSql && !targetIsInput) { event.preventDefault(); const { connection, database, object } = selectedExplorerObject; const next = window.prompt(t('explorer.rename.prompt', [object.name]), object.name)?.trim(); if (next && next !== object.name) void renameTable(connection, database, object, next) }
      else if (event.key === 'F5' && selectedExplorerObject && !activeSql && !targetIsInput) { event.preventDefault(); void loadObjects(selectedExplorerObject.connection, selectedExplorerObject.database) }
      else if (event.key === 'Delete' && selectedExplorerObject && !activeSql && !targetIsInput) { event.preventDefault(); const { connection, database, object } = selectedExplorerObject; if (window.confirm(t('explorer.delete.prompt', [object.kind, object.name]))) void dropObject(connection, database, object) }
      else if (event.key === 'F4' && selectedExplorerObject) { event.preventDefault(); showObjectProperties(selectedExplorerObject.connection, selectedExplorerObject.database, selectedExplorerObject.object) }
      else if (ctrl && event.key.toLowerCase() === 'f' && activeSql) { event.preventDefault(); openFind(false, false) }
      else if (ctrl && event.key.toLowerCase() === 'h' && activeSql) { event.preventDefault(); openFind(true, false) }
      else if (ctrl && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); openFind(false, true) }
      else if (ctrl && event.altKey && event.key.toLowerCase() === 'u') { event.preventDefault(); openRegisteredPanel('document-outline') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const activeTitle = useMemo(() => currentConnection?.name ?? t('app.connection.none'), [currentConnection, t])
  const shortcutFor = (command: string): string | undefined => appSettings.shortcuts.bindings.find((binding) => binding.command === command)?.shortcut || undefined

  useEffect(() => () => completionProviderRef.current?.dispose(), [])

  return <main className="app-shell" aria-label="dbForgeLinux">
    <header className="app-menubar">
      <strong className="brand">dbForgeLinux</strong>
      <nav className="menu-row" aria-label="Menu principal">
        <details><summary>{t('menu.file')}</summary><div className="menu-popup"><MenuAction label={t('menu.newSql')} shortcut={shortcutFor('New SQL Document')} onClick={newSql} /><MenuAction label={t('menu.openFile')} shortcut={shortcutFor('Open SQL File')} onClick={() => void openSqlFile()} /><MenuAction label={t('menu.close')} shortcut={shortcutFor('Close Tab')} onClick={() => closeTab(selectedDocument)} disabled={!activeSql} /><MenuAction label={t('menu.openProject')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.save')} shortcut={shortcutFor('Save SQL')} onClick={() => void saveCurrentSql()} disabled={!activeSql} /><MenuAction label={t('menu.saveAs')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.saveAll')} shortcut={shortcutFor('Save All')} onClick={() => void saveAllSql()} /><MenuAction label={t('menu.print')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.recentFiles')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.exit')} shortcut={shortcutFor('Exit')} onClick={() => window.close()} /></div></details>
        <details><summary>{t('menu.edit')}</summary><div className="menu-popup"><MenuAction label={t('menu.undo')} shortcut="Ctrl+Z" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.redo')} shortcut="Ctrl+Y" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.cut')} shortcut="Ctrl+X" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.copy')} shortcut="Ctrl+C" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.paste')} shortcut="Ctrl+V" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.duplicate')} shortcut="Ctrl+D" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.delete')} shortcut="Delete" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.selectAll')} shortcut="Ctrl+A" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.goTo')} shortcut={shortcutFor('Go To Line')} onClick={() => editorRef.current?.trigger('keyboard', 'editor.action.gotoLine', null)} disabled={!activeSql} /><MenuAction label={t('menu.findReplace')} shortcut="Ctrl+H" onClick={() => openFind(true)} disabled={!activeSql} /><MenuAction label={t('nav.findInFiles')} shortcut="Ctrl+Shift+F" onClick={() => openFind(false, true)} /><MenuAction label={t('menu.advanced')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.bookmarks')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.outlining')} onClick={() => openRegisteredPanel('document-outline')} disabled={!activeSql} /><MenuAction label={t('menu.codeCompletion')} shortcut="Ctrl+Space" onClick={() => editorRef.current?.trigger('keyboard', 'editor.action.triggerSuggest', null)} disabled={!activeSql} /></div></details>
        <details><summary>{t('menu.view')}</summary><div className="menu-popup"><MenuAction label={t('menu.startPage')} shortcut="Ctrl+W, S" onClick={() => setSelectedDocument('start')} /><MenuAction label={t('menu.databaseExplorer')} shortcut={shortcutFor('Show Database Explorer')} onClick={() => setExplorerVisible((value) => !value)} /><MenuAction label={t('menu.projectExplorer')} shortcut="Ctrl+W, J" disabled title={t('menu.notAvailable')} /><MenuAction label={t('nav.objectViewer')} onClick={() => openRegisteredPanel('object-viewer')} /><MenuAction label={t('menu.aiAssistant')} shortcut="Ctrl+\\, C" onClick={() => setOpenPanel('ai-assistant')} /><MenuAction label={t('nav.schemaView')} shortcut="Ctrl+W, C" onClick={() => openRegisteredPanel('schema-view')} /><MenuAction label={t('menu.dataViewer')} shortcut="Ctrl+W, R" onClick={() => openRegisteredPanel('object-viewer')} /><MenuAction label={t('nav.documentOutline')} shortcut="Ctrl+W, U" onClick={() => openRegisteredPanel('document-outline')} disabled={!activeSql} /><MenuAction label={t('menu.snippets')} shortcut="Ctrl+W, T" onClick={() => openRegisteredPanel('snippets-manager')} /><MenuAction label={t('nav.output')} shortcut="Ctrl+W, O" onClick={() => { setPanelVisible(true); setPanelTab('Output') }} /><MenuAction label={t('nav.errorList')} shortcut="Ctrl+W, E" onClick={() => { setPanelVisible(true); setPanelTab('Error List') }} /><MenuAction label={t('nav.propertiesF4')} shortcut="Ctrl+W, P" onClick={() => selectedExplorerObject && showObjectProperties(selectedExplorerObject.connection, selectedExplorerObject.database, selectedExplorerObject.object)} disabled={!selectedExplorerObject} /><MenuAction label={t('menu.queryBuilder')} onClick={() => openRegisteredPanel('query-builder')} /><MenuAction label={t('menu.profiler')} onClick={() => openRegisteredPanel('profiler')} /><MenuAction label={t('menu.pivot')} onClick={() => openRegisteredPanel('data-report-pivot')} /><div className="menu-divider" /><MenuAction label={t('menu.themeAuto')} checked={themeMode === 'auto'} onClick={() => setThemeMode('auto')} /><MenuAction label={t('menu.themeLight')} checked={themeMode === 'light'} onClick={() => setThemeMode('light')} /><MenuAction label={t('menu.themeDark')} checked={themeMode === 'dark'} onClick={() => setThemeMode('dark')} /></div></details>
        <details><summary>{t('menu.database')}</summary><div className="menu-popup"><MenuAction label={t('menu.newConnection')} onClick={openNewConnection} /><MenuAction label={t('menu.newObject')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.newDatabase')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('documenter.title')} onClick={() => openRegisteredPanel('documenter')} /><MenuAction label={t('menu.backupRestore')} onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.copyDatabases')} onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.invalidObjects')} onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.diagram')} onClick={() => openRegisteredPanel('er-diagram')} /><MenuAction label={t('menu.masterDetail')} onClick={() => openRegisteredPanel('master-detail')} /><MenuAction label={t('menu.reportDesigner')} onClick={() => openRegisteredPanel('data-report-pivot')} /><MenuAction label={t('menu.pivot')} onClick={() => openRegisteredPanel('data-report-pivot')} /><MenuAction label={t('menu.security')} shortcut="Ctrl+D, Q" onClick={() => openRegisteredPanel('security')} /><MenuAction label={t('menu.sessions')} shortcut="Ctrl+D, S" onClick={() => openRegisteredPanel('sessions')} /><MenuAction label={t('menu.serverVariables')} shortcut="Ctrl+D, V" onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.serviceControl')} shortcut="Ctrl+D, R" onClick={() => openRegisteredPanel('service-control')} /><MenuAction label={t('menu.findObject')} shortcut="Ctrl+D, F" onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.largeScript')} onClick={() => openDatabaseToolTab('Large Script')} /><MenuAction label={t('menu.maintenance')} onClick={() => openDatabaseToolTab('Table Maintenance')} /><MenuAction label={t('menu.flush')} disabled title={t('menu.notAvailable')} /></div></details>
        <details><summary>{t('menu.comparison')}</summary><div className="menu-popup"><MenuAction label={t('menu.newSchemaCompare')} onClick={() => openRegisteredPanel('schema-compare')} /><MenuAction label={t('menu.newDataCompare')} onClick={() => openRegisteredPanel('data-compare')} /><MenuAction label={t('menu.editComparison')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'edit'}))} /><MenuAction label={t('panel.schema.compare.xObjectsFilter')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'filter'}))} /><MenuAction label={t('menu.refresh')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'refresh'}))} /><MenuAction label={t('menu.stop')} onClick={() => void cancelSql()} disabled={!queryBusy} /><MenuAction label={t('panel.schema.compare.xViewScript')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'script'}))} /><MenuAction label={t('panel.schema.compare.xReport')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'report'}))} /><MenuAction label={t('menu.synchronize')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'sync'}))} /></div></details>
        <details><summary>{t('menu.debug')}</summary><div className="menu-popup"><MenuAction label={t('menu.debugStart')} shortcut="Ctrl+F5" onClick={() => sendDebuggerCommand('Run Debugging (Ctrl+F5)')} /><MenuAction label={t('menu.debugContinue')} shortcut="Ctrl+F5" onClick={() => sendDebuggerCommand('Continue Debugging')} /><MenuAction label={t('menu.debugBreakAll')} shortcut="Ctrl+Alt+Pause" onClick={() => sendDebuggerCommand('Break All')} /><MenuAction label={t('menu.debugStop')} shortcut="Shift+F5" onClick={() => sendDebuggerCommand('Stop Debugging')} /><MenuAction label={t('menu.debugRestart')} shortcut="Ctrl+Shift+F5" onClick={() => sendDebuggerCommand('Restart Debugging')} /><MenuAction label={t('menu.debugStepInto')} shortcut="F11" onClick={() => sendDebuggerCommand('Step Into')} /><MenuAction label={t('menu.debugStepOver')} shortcut="F10" onClick={() => sendDebuggerCommand('Step Over')} /><MenuAction label={t('menu.debugStepOut')} shortcut="Shift+F11" onClick={() => sendDebuggerCommand('Step Out')} /></div></details>
        {activeSql && <details><summary>{t('menu.sql')}</summary><div className="menu-popup"><MenuAction label={t('menu.beginTransaction')} onClick={() => void toggleAutoCommit(false)} disabled={!currentConnection || !autoCommit} /><MenuAction label={t('menu.rollback')} onClick={() => void finishTransaction('rollback')} disabled={!currentConnection || transactionCommitted} /><MenuAction label={t('menu.commit')} onClick={() => void finishTransaction('commit')} disabled={!currentConnection || transactionCommitted} /><MenuAction label={t('menu.execute')} shortcut="F5" onClick={() => void runSql()} disabled={!currentConnection || queryBusy} /><MenuAction label={t('menu.executeCurrent')} shortcut="F8" onClick={() => void runSql('current')} disabled={!currentConnection || queryBusy} /><MenuAction label={t('menu.stopExecution')} shortcut={shortcutFor('Stop Execution (Alt+Pause)')} onClick={() => void cancelSql()} disabled={!queryBusy} /><MenuAction label={t('menu.editParameters')} shortcut="Ctrl+Shift+P" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.resultsText')} shortcut="Ctrl+T" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.resultsGrid')} shortcut="Ctrl+Shift+D" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.estimatedPlan')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.profiling')} checked={queryProfilingMode} onClick={() => setQueryProfilingMode((value) => !value)} /><MenuAction label={t('menu.sendReport')} disabled title={t('menu.notAvailable')} /></div></details>}
        <details><summary>{t('menu.tools')}</summary><div className="menu-popup"><MenuAction label={t('menu.formatter')} onClick={() => openDatabaseToolTab('SQL Formatter')} /><MenuAction label={t('menu.snippetsManager')} onClick={() => openRegisteredPanel('snippets-manager')} /><MenuAction label={t('menu.importExport')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.customize')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.resetToolbar')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.options')} shortcut={shortcutFor('Options')} onClick={() => openRegisteredPanel('options')} /></div></details>
        <details><summary>{t('menu.window')}</summary><div className="menu-popup"><MenuAction label={t('menu.float')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.pin')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.horizontal')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.vertical')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.closeAll')} onClick={() => documents.filter((tab) => tab.id !== 'start').forEach((tab) => closeTab(tab.id))} /><MenuAction label={t('menu.resetLayout')} onClick={() => { setExplorerVisible(true); setPanelVisible(true); setExplorerWidth(280); setPanelHeight(200) }} /><div className="menu-divider" />{documents.map((tab) => <MenuAction key={tab.id} label={`${tab.id === selectedDocument ? '✓ ' : ''}${tab.label}`} onClick={() => setSelectedDocument(tab.id)} />)}</div></details>
        <details><summary>{t('menu.help')}</summary><div className="menu-popup"><MenuAction label={t('menu.contents')} shortcut="F1" onClick={() => void window.dbforge.openAboutLink('documentation')} /><MenuAction label={t('menu.gettingStarted')} onClick={() => setSelectedDocument('start')} /><MenuAction label={t('updates.check')} onClick={() => void checkForUpdates()} /><MenuAction label={t('menu.about')} onClick={() => setAboutOpen(true)} /></div></details>
      </nav>
      <span className="menubar-status">{status}</span>
      <button className="menubar-ai" onClick={() => setOpenPanel('ai-assistant')}>{t('menu.aiAssistant')} <small>AI</small></button>
    </header>
    {vaultWarning && <div role="alert" className="vault-warning"><span>{vaultWarning}</span><button aria-label="Dismiss vault warning" onClick={() => setVaultWarning('')}>×</button></div>}
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
      <Button onClick={() => void toggleAutoCommit(false)} disabled={!currentConnection || !autoCommit}>{t('menu.beginTransaction')}</Button>
      <Button onClick={() => void finishTransaction('commit')} disabled={autoCommit}>Commit</Button>
      <Button onClick={() => void finishTransaction('rollback')} disabled={autoCommit}>Rollback</Button>
      <Button onClick={() => setPanelVisible((value) => !value)} title="Toggle Results">Results</Button>
      <span className="toolbar-spacer" />
      <Button className="icon-button" title="Auto theme" onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark')}>{theme === 'dark' ? '☾' : '☼'}</Button>
    </div>
    {loadError && <div className="storage-error" role="alert">{loadError}<Button onClick={() => void loadConnections()}>Tentar de novo</Button></div>}
    <div className={`workbench${explorerVisible ? '' : ' explorer-hidden'}${panelVisible ? '' : ' panel-hidden'}`} style={{ gridTemplateColumns: explorerVisible ? `${explorerWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}>
      {explorerVisible && <DatabaseExplorer records={records} active={active} databases={databases} objects={objects} loadingObjects={loadingObjects} connecting={connecting} errors={connectionErrors} onNew={openNewConnection} onManage={() => setManagerOpen(true)} onConnect={(record) => void connectFromExplorer(record)} onDisconnect={(connection) => void disconnect(connection)} onExpand={(record) => void expandRecord(record)} onLoadObjects={loadObjects} onSelectDatabase={(connection, database) => void selectDatabase(connection, database)} onSelectTop={selectTop} onGenerateScript={(connection, database, object) => void generateScript(connection, database, object)} onDropObject={(connection, database, object) => void dropObject(connection, database, object)} onOpenObject={(connection, database, object) => openObjectEditor(connection, database, object.kind, object.name)} onCreateObject={(connection, database, kind) => openObjectEditor(connection, database, kind, `new_${kind}`, true)} onRenameTable={(connection, database, object, name) => void renameTable(connection, database, object, name)} onTruncateTable={(connection, database, object) => void truncateTable(connection, database, object)} onSelectObject={(connection, database, object) => setSelectedExplorerObject({ connection, database, object })} onProperties={showObjectProperties} onEdit={openEdit} onContextAction={(action, context) => void handleExplorerContextAction(action, context)} />}
      {explorerVisible && <div className="vertical-splitter" role="separator" aria-orientation="vertical" aria-label="Resize Database Explorer" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setExplorerWidth(Math.min(Math.floor(window.innerWidth * 0.5), Math.max(200, event.clientX))) }} />}
      <section className="document-workspace" style={{ gridTemplateRows: panelVisible ? `30px minmax(0, 1fr) 5px ${panelHeight}px` : '30px minmax(0, 1fr) 0 0' }}>
        <div className="document-tabs" role="tablist" aria-label="Documents">
          {documents.map((tab) => <div key={tab.id} role="tab" aria-selected={selectedDocument === tab.id} className={`document-tab${selectedDocument === tab.id ? ' selected' : ''}`} onClick={() => setSelectedDocument(tab.id)}>
            <button className="tab-label" onClick={() => setSelectedDocument(tab.id)}>{tab.modified ? '• ' : ''}{tab.label}</button>{tab.id !== 'start' && <button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }} aria-label={`Fechar ${tab.label}`}>×</button>}
          </div>)}
          <button className="tab-overflow" title="Todas as abas" onClick={() => window.alert(documents.map((tab) => tab.label).join('\n'))}>⌄</button>
        </div>
        {selectedDocument === 'start' ? <StartPage files={documents.filter((tab) => tab.id !== 'start' && !tab.objectEditor && !tab.panelId && tab.filePath).slice(-10).reverse()} connections={records} onNewSql={newSql} onOpenSql={() => void openSqlFile()} onNewConnection={openNewConnection} onManageConnections={() => setManagerOpen(true)} onOpenFile={setSelectedDocument} onConnect={(record) => void connectFromExplorer(record)} /> : activeObjectTab ? <ObjectEditor key={selectedDocument} target={activeObjectTab} isNew={activeObjectTab.isNew} isProduction={currentConnection?.environment === 'prod'} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} onApplied={() => { const connection = active.find((item) => item.id === activeObjectTab.connectionId); if (connection) void loadObjects(connection, activeObjectTab.database) }} /> : activePanelTab ? (() => { const entry = panelRegistry.find((item) => item.id === activePanelTab); if (!entry) return <div className="tool-document-empty">Painel indisponível.</div>; const Panel = entry.component; return <div className="tool-document">{panelContents(Panel)}</div> })() : <div className="document-main">
          <div className="sql-context-toolbar"><span>{documents.find((tab) => tab.id === selectedDocument)?.label}</span><span>{activeTitle}</span><span className="metadata-state">{metadataLoading ? 'Loading schema…' : editorMetadata.objects.length ? `${editorMetadata.objects.length} schema objects` : ''}</span><Button onClick={() => formatEditor('document')}>Format</Button><Button onClick={() => formatEditor('statement')}>Format statement</Button><Button variant="primary" onClick={() => void runSql()} disabled={!currentConnection || queryBusy}>▶ Execute</Button><Button onClick={() => void runSql('current')} disabled={!currentConnection || queryBusy}>Current statement</Button></div>
          {findOpen && <div className="find-toolbar"><input type="search" aria-label={t('nav.find')} placeholder={t('nav.find')} value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') cycleFind(event.shiftKey ? -1 : 1) }} /><Button onClick={() => cycleFind(-1)} title={t('nav.previous')}>↑</Button><Button onClick={() => cycleFind(1)} title={t('nav.next')}>↓</Button><label><input type="checkbox" checked={findRegex} onChange={(event) => setFindRegex(event.target.checked)} />{t('nav.regex')}</label><label><input type="checkbox" checked={findCase} onChange={(event) => setFindCase(event.target.checked)} />{t('nav.caseSensitive')}</label><select aria-label={t('nav.scope')} value={findScope} onChange={(event) => setFindScope(event.target.value as typeof findScope)}><option value="document">{t('nav.document')}</option><option value="selection">{t('nav.selection')}</option><option value="open">{t('nav.openDocuments')}</option></select>{findReplaceMode && <><input aria-label={t('nav.replace')} placeholder={t('nav.replace')} value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} /><Button onClick={replaceCurrentMatch}>{t('nav.replaceOne')}</Button><Button onClick={replaceAllMatches}>{t('nav.replaceAll')}</Button></>}<span>{findMatches.length}</span><Button onClick={() => { setFindOpen(false); setFindReplaceMode(false) }} title={t('nav.close')}>×</Button></div>}
          <div className="editor-surface"><Editor height="100%" language="sql" theme={theme === 'dark' || theme === 'high-contrast' ? 'vs-dark' : 'vs'} value={sqlByDocument[selectedDocument] ?? ''} onMount={(editor, monaco) => {
            editorRef.current = editor
            editor.onDidChangeModelContent(() => { const model = editor.getModel(); const position = editor.getPosition(); if (!model || !position) return; const value = model.getValue(); const offset = model.getOffsetAt(position); const adjusted = applyKeywordCaseAtOffset(value, offset, appSettingsRef.current.editor.keywordCase); if (adjusted !== value) { let start = 0; while (start < value.length && value[start] === adjusted[start]) start++; let suffix = 0; while (suffix < value.length - start && value[value.length - suffix - 1] === adjusted[adjusted.length - suffix - 1]) suffix++; const from = model.getPositionAt(start); const to = model.getPositionAt(value.length - suffix); const range = new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column); editor.executeEdits('keyword-case', [{ range, text: adjusted.slice(start, adjusted.length - suffix) }]) } const current = model.getValue(); const caret = model.getPositionAt(Math.min(offset, current.length)); const suggestions = buildSqlSuggestions(current, Math.min(offset, current.length), metadataRef.current, userSnippetsRef.current); const match = suggestions.find((item) => item.kind === 'table' && metadataRef.current.objects.some((object) => object.name.toLowerCase() === item.label.toLowerCase())); const detail = match && metadataRef.current.objects.find((object) => object.name.toLowerCase() === match.label.toLowerCase()); setCompletionDetails(detail); setEditorPosition({ line: caret.lineNumber, column: caret.column }) })
            editor.onKeyDown((event) => { if (event.keyCode === monaco.KeyCode.Escape) setCompletionDetails(undefined) })
            editor.onDidBlurEditorText(() => setCompletionDetails(undefined))
            completionProviderRef.current?.dispose()
            completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
              triggerCharacters: ['.'],
              provideCompletionItems: (model, position) => {
                const source = model.getValue()
                const offset = model.getOffsetAt(position)
                const word = model.getWordUntilPosition(position)
                const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column)
                const kinds = { database: monaco.languages.CompletionItemKind.Module, table: monaco.languages.CompletionItemKind.Struct, column: monaco.languages.CompletionItemKind.Field, routine: monaco.languages.CompletionItemKind.Function, keyword: monaco.languages.CompletionItemKind.Keyword, snippet: monaco.languages.CompletionItemKind.Snippet }
                return { suggestions: buildSqlSuggestions(source, offset, metadataRef.current, userSnippetsRef.current).map((item) => ({ label: item.schema ? { label: item.label, description: item.schema, detail: item.detail } : item.label, kind: kinds[item.kind], detail: item.detail, documentation: { value: completionDocumentation(item, metadataRef.current) }, insertText: item.insertText, filterText: item.kind === 'snippet' ? item.detail.split(' · ')[0] : item.label, insertTextRules: item.kind === 'snippet' ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : monaco.languages.CompletionItemInsertTextRule.None, range })) }
              }
            })
            editor.onDidChangeCursorPosition(({ position }) => setEditorPosition({ line: position.lineNumber, column: position.column }))
            const formatAction = (id: string, label: string, target: 'document' | 'selection' | 'statement', keybindings?: number[]): void => { editor.addAction({ id, label, ...(keybindings ? { keybindings } : {}), run: () => formatEditor(target) }) }
            formatAction('dbforge.format-document', 'Format Document', 'document')
            formatAction('dbforge.format-selection', 'Format Selection', 'selection')
            formatAction('dbforge.format-statement', 'Format Statement', 'statement')
          }} onChange={(value) => { const nextValue = value ?? ''; setSqlByDocument((current) => ({ ...current, [selectedDocument]: nextValue })); setDocuments((current) => current.map((tab) => tab.id === selectedDocument ? { ...tab, modified: true } : tab)) }} options={{ minimap: { enabled: appSettings.editor.minimap }, fontFamily: appSettings.editor.fontName, fontSize: appSettings.editor.fontSize, automaticLayout: true, fontLigatures: appSettings.editor.ligatures, lineNumbers: appSettings.editor.lineNumbers ? 'on' : 'off', tabCompletion: 'on', suggestOnTriggerCharacters: appSettings.editor.autoComplete, quickSuggestions: appSettings.editor.autoComplete, quickSuggestionsDelay: appSettings.editor.completionDelayMs, wordWrap: appSettings.editor.wordWrap ? 'on' : 'off', tabSize: appSettings.editor.tabSize, insertSpaces: appSettings.editor.insertSpaces, folding: appSettings.editor.folding, renderLineHighlight: appSettings.editor.highlightCurrentLine ? 'line' : 'none' }} />{completionDetails && <aside className="editor-completion-details" aria-label={t('editor.completion.details')}><strong>{completionDetails.name}</strong><small>{completionDetails.kind} · {editorMetadata.database} · {completionDetails.engine || t('editor.completion.engineUnknown')}</small><table><thead><tr><th>{t('editor.completion.column')}</th><th>{t('editor.completion.type')}</th><th>{t('editor.completion.null')}</th></tr></thead><tbody>{completionDetails.columns.map((column) => <tr key={column.name}><td>{column.name}</td><td>{column.type}</td><td>{column.nullable === false ? 'NOT NULL' : 'NULL'}</td></tr>)}</tbody></table></aside>}</div>
          <div className="result-view">
            <div className="result-tabs" role="tablist"><span className="result-presentation">{t('editor.results.as')} <button className={resultPresentation === 'text' ? 'selected' : ''} onClick={() => setResultPresentation('text')}>{t('editor.results.text')}</button><button className={resultPresentation === 'grid' ? 'selected' : ''} onClick={() => setResultPresentation('grid')}>{t('editor.results.grid')}</button></span>{results.map((result, index) => <button key={index} role="tab" aria-selected={resultIndex === index} className={resultIndex === index ? 'selected' : ''} onClick={() => setResultIndex(index)}>Result {index + 1} ({result.rowCount ?? result.rows.length})</button>)}<button role="tab" aria-selected={resultIndex === -1} className={resultIndex === -1 ? 'selected' : ''} onClick={() => setResultIndex(-1)}>Messages</button><button role="tab" aria-selected={resultIndex === -2} className={resultIndex === -2 ? 'selected' : ''} onClick={() => setResultIndex(-2)}>Query History</button></div>
            {resultIndex >= 0 && results[resultIndex] ? resultPresentation === 'text' ? <pre className="result-text">{JSON.stringify(results[resultIndex].rows, null, 2)}</pre> : <ResultGrid result={results[resultIndex]} index={resultIndex} currentConnection={currentConnection ?? undefined} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} fetchRows={(offset, limit) => window.dbforge.readResultRows(results[resultIndex].resultStoreId!, offset, limit)} onLoadMore={pageQueries[selectedDocument] ? () => loadMorePage(resultIndex) : undefined} /> : resultIndex === -2 ? <div className="query-history"><div className="history-toolbar"><input aria-label="Search Query History" placeholder="Search SQL, connection, database…" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} /><span>{historyLoading ? 'Loading…' : `${history.length} entries`}</span></div><div className="query-messages">{history.length ? history.map((entry) => <article className="history-row" key={entry.id}><button className="history-entry" onClick={() => openSqlDocument('History query', entry.sql)}><span>{new Date(entry.timestamp).toLocaleString()} · {entry.connection}{entry.database ? ` · ${entry.database}` : ''} · {(entry.elapsedMs / 1000).toFixed(3)} s · {entry.success ? 'Success' : 'Failed'}</span><code>{entry.sql}</code></button><Button onClick={() => replayHistory(entry)}>Re-run</Button></article>) : <p>{historyLoading ? 'Loading…' : 'Histórico vazio.'}</p>}</div></div> : <div className="query-messages" aria-live="polite">{queryBusy && <p>Executando…</p>}{queryMessages.map((message, index) => <p key={index}>{message}</p>)}{!queryBusy && !queryMessages.length && <p>Messages de execução aparecerão aqui.</p>}{results.filter((result) => !result.columns.length).map((result, index) => <p key={`affected-${index}`}>Affected rows: {result.affectedRows} · Last insert id: {result.insertId}</p>)}{queryElapsed > 0 && <small>{(queryElapsed / 1000).toFixed(3)} s</small>}</div>}
          </div>
        </div>}
        <div className="horizontal-splitter" role="separator" aria-orientation="horizontal" aria-label="Resize Output panel" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setPanelHeight(Math.min(480, Math.max(80, window.innerHeight - event.clientY))) }} />
        <section className="bottom-panel" aria-label="Output and errors">
          {panelTab === 'Output' ? <div className="output-log" aria-live="polite">{output.length ? output.map((entry, index) => <div key={`${entry.timestamp}-${index}`} className={`output-${entry.tone}`}>[{entry.timestamp}] {entry.origin} {entry.message}</div>) : <p>{t('app.output.empty')} {t('app.output.secretNote')}</p>}</div> : panelTab === 'Find Results' ? panelContents(panelRegistry.find((entry) => entry.id === 'find-results')!.component) : renderErrorList()}
        </section>
      </section>
    </div>
    {appSettings.environment.showStatusBar && <footer className="status-bar"><span>{currentConnection ? t('editor.connection.connected') : status}</span><button onClick={() => currentRecord && setManagerOpen(true)}>{currentConnection ? `${currentConnection.host} (${serverVersion || currentRecord?.type || 'MySQL'}) · ${currentConnection.user}` : activeTitle}</button>{currentConnection && currentRecord?.environment !== 'none' && <span className={`environment-badge env-${currentRecord?.environment ?? 'none'}`} style={{ '--environment-color': currentRecord?.color ?? (currentRecord?.environment === 'prod' ? '#c62828' : currentRecord?.environment === 'test' ? '#ed6c02' : '#2e7d32') } as React.CSSProperties}>{t(`conn.environment.${currentRecord?.environment ?? 'none'}`)}</span>}{currentRecord?.category && <span className="connection-category">{currentRecord.category}</span>}<span>{currentConnection?.database ?? ''}</span>{status === t('editor.query.success') && <span>{status} · {(queryElapsed / 1000).toFixed(3)} s</span>}<span>Ln {editorPosition.line}, Col {editorPosition.column}, Ch {editorPosition.column - 1}</span><span>UTF-8</span><span>LF</span><span>{results.length ? `${results.reduce((sum, item) => sum + (item.rowCount ?? item.rows.length), 0)} rows` : ''}</span><span className="toolbar-spacer" />{updateState.phase === 'checking' ? <button className="update-status" onClick={() => void checkForUpdates()}>{t('updates.checking')}</button> : updateState.phase === 'available' ? <button className="update-status available" onClick={() => setUpdateDialogOpen(true)}>{t('updates.available', [updateState.newVersion ?? ''])}</button> : updateState.phase === 'up-to-date' ? <span className="update-status">{t('updates.updated')}</span> : null}{themeMode.toUpperCase()}</footer>}
    {dialogRecord && <ConnectionPropertiesDialog initial={dialogRecord} isNew={newDialog} names={records.filter((record) => record.id !== dialogRecord.id).map((record) => record.name)} onAction={runConnectionAction} onTrustHostKey={async (record) => { await window.dbforge.saveConnection(record); upsertRecord(record) }} onCancel={() => setDialogRecord(null)} />}
    {openPanel && (() => { const entry = panelRegistry.find((item) => item.id === openPanel); if (!entry) return null; const contents = panelContents(entry.component); return entry.presentation === 'dock' ? <aside className="right-dock" aria-label={t(entry.titleKey)}><header><strong>{t(entry.titleKey)}</strong><button onClick={() => setOpenPanel(null)} aria-label={`Close ${t(entry.titleKey)}`}>×</button></header>{contents}</aside> : <PanelDialog title={t(entry.titleKey)} onClose={() => setOpenPanel(null)}>{contents}</PanelDialog> })()}
    {managerOpen && <ConnectionManager records={records} onNew={() => { setManagerOpen(false); openNewConnection() }} onEdit={(record) => { setManagerOpen(false); openEdit(record) }} onDuplicate={(record) => { setManagerOpen(false); setDialogRecord({ ...structuredClone(record), id: crypto.randomUUID(), name: `${record.name} copy`, lastUsedAt: undefined }); setNewDialog(true) }} onDelete={deleteRecords} onClose={() => setManagerOpen(false)} />}
    {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    {updateDialogOpen && <PanelDialog title={t('updates.dialogTitle')} onClose={() => setUpdateDialogOpen(false)}><section className="update-dialog"><h2>{t('updates.dialogTitle')}</h2><p>{t('updates.version', [updateState.currentVersion, updateState.newVersion ?? updateState.currentVersion])}</p><p>{t('updates.channel', [t(updateState.channel === 'dev' ? 'updates.dev' : 'updates.release')])}</p>{updateState.message && <p role="status">{updateState.message}</p>}{updateState.summary.length > 0 && <><h3>{t('updates.summary')}</h3><ul>{updateState.summary.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}</ul></>}{updateState.progress !== undefined && <label>{t('updates.progress', [updateState.progress])}<progress max={100} value={updateState.progress} /></label>}<details open={updateLogOpen} onToggle={(event) => setUpdateLogOpen(event.currentTarget.open)}><summary>{t('updates.log')}</summary><pre>{updateState.log.join('\n')}</pre></details><footer><Button onClick={() => setUpdateDialogOpen(false)}>{t('updates.later')}</Button>{['checking', 'building', 'downloading'].includes(updateState.phase) && <Button onClick={() => void window.dbforge.updaterCancel().then(setUpdateState)}>{t('updates.cancel')}</Button>}{updateState.phase === 'available' && <><Button onClick={() => void ignoreUpdate()}>{t('updates.ignore')}</Button><Button variant="primary" onClick={() => void applyUpdate()}>{t('updates.apply')}</Button></>}</footer></section></PanelDialog>}
  </main>

}

function MenuAction({ label, shortcut, onClick, disabled = false, checked, title }: { label: string; shortcut?: string; onClick?: () => void; disabled?: boolean; checked?: boolean; title?: string }): React.JSX.Element {
  return <button className="menu-action" disabled={disabled} title={title} onClick={(event) => { onClick?.(); event.currentTarget.closest('details')?.removeAttribute('open') }}>
    <span>{checked === undefined ? '' : checked ? '✓' : '　'}{label}</span>{shortcut && <small>{shortcut}</small>}
  </button>
}

function emptySecrets(): ConnectionSecrets {
  return { password: '', sshPassword: '', sshPassphrase: '', httpPassword: '', proxyPassword: '' }
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function findMatchesForScope(source: string, query: string, regex: boolean, caseSensitive: boolean, start?: number, end?: number): TextMatch[] {
  const from = start ?? 0
  const to = end ?? source.length
  return findTextMatches(source.slice(from, to), query, { regex, caseSensitive }).map((match) => {
    const offset = from + match.offset
    const before = source.slice(0, offset)
    return { ...match, offset, line: before.split('\n').length, column: offset - before.lastIndexOf('\n') }
  })
}

function maskSecrets(value: string): string {
  return value.replace(/(password|passphrase)(\s*[:=]\s*)\S+/gi, '$1$2****')
}

function readStoredDocuments(): DocumentTab[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('dbforge.documents') ?? 'null')
    if (Array.isArray(stored) && stored.every((item) => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.modified === 'boolean' && (item.panelId === undefined || typeof item.panelId === 'string'))) {
      const documents = stored as DocumentTab[]
      return documents.some((item) => item.id === 'start') ? documents : [{ id: 'start', label: 'Start Page', modified: false }, ...documents]
    }
  } catch { /* discard malformed renderer state */ }
  return [{ id: 'start', label: 'Start Page', modified: false }]
}

function completionDocumentation(item: ReturnType<typeof buildSqlSuggestions>[number], metadata: EditorMetadata): string {
  const object = metadata.objects.find((candidate) => candidate.name.toLowerCase() === item.label.toLowerCase())
  if (!object) return `**${item.label}**\n\n${item.kind}${item.schema ? ` · ${item.schema}` : ''}\n\n${item.detail}`
  const columns = object.columns.map((column) => `| ${column.name} | ${column.type} | ${column.nullable === false ? 'NOT NULL' : 'NULL'} |`).join('\n')
  return `**${object.name}**\n\n${object.kind} · ${metadata.database} · ${object.engine || 'engine unknown'}\n\n| Column | Type | Nullability |\n| --- | --- | --- |\n${columns}`
}
