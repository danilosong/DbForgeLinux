import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor, IRange } from 'monaco-editor'
import type * as MonacoApi from 'monaco-editor'
import type { ConnectionRecord, ConnectionSummary, ConnectionTestResult, DatabaseObject, DatabaseObjectKind, EditorMetadata, EditorObjectMetadata, ObjectEditorTarget, QueryResult, SqlExecutionHistoryEntry } from '../../../shared/contracts'
import type { CodeAnalysisFinding } from '../../../shared/contracts/code-analysis.js'
import type { UpdateStatus } from '../../../shared/contracts/updater.js'
import { splitSqlStatements, statementAtOffset } from '../../../shared/sqlStatements'
import { formatServerWarnings } from '../../../modules/sql/serverWarnings.js'
import { findDangerousStatements, isDestructiveStatement } from '../../../modules/options/executionWarnings.js'
import { effectiveCommandTimeoutSeconds } from '../../../modules/options/sqlExecution.js'
import { applyKeywordCaseAtOffset, buildSqlSuggestions } from '../../../modules/editor/completion.js'
import { getActiveSqlSignature } from '../../../modules/editor/signatureHelp.js'
import { formatSql } from '../../../modules/editor/formatter.js'
import { findFormatProfile } from '../../../modules/editor/formatProfiles.js'
import { decideBatchError } from '../../../modules/editor/batchErrorPolicy.js'
import { findBeginEndPair } from '../../../modules/editor/blockPairs.js'
import { normalizeQuery } from '../../../modules/profiler/index.js'
import { createDocumentLayout, dockDirectionClass, findDocumentGroup, mergeDocumentIntoGroup, normalizeDockDirection, parseDocumentLayout, serializeDocumentLayout, setGroupRatio, splitDocumentGroup, type DockDirection, type DocumentLayout } from '../../../modules/dock-layout.js'
import { expandSqlWildcards, qualifyObjectNames, transformIdentifiers } from '../../../modules/editor/refactoring.js'
import { findBookmark, toggleBookmark, toggleOutlining } from '../../../modules/editor-navigation.js'
import { createDefaultConnection } from '../../../shared/connectionDefaults'
import { redactSqlSecrets } from '../../../shared/redactSqlSecrets.js'
import { Button } from './components/Button'
import { ConnectionManager } from './components/ConnectionManager'
import { ConnectionPropertiesDialog, type ConnectionAction, type ConnectionSecrets } from './components/ConnectionPropertiesDialog'
import { DatabaseExplorer, type ExplorerContext } from './components/DatabaseExplorer'
import { buildExplorerSql, quoteExplorerIdentifier, type ScriptKind } from './components/explorerContextMenu.js'
import { buildCreateDatabaseDdl, validateCreateDatabaseDdl } from '../../../modules/object-editors/database.js'
import { AboutDialog } from './components/AboutDialog'
import { ResultGrid } from './components/ResultGrid'
import { PanelDialog } from './components/PanelDialog'
import { ExecutionErrorDialog } from './components/ExecutionErrorDialog.js'
import { SshKeyboardInteractiveDialog } from './components/SshKeyboardInteractiveDialog.js'
import type { ScriptErrorAction } from '../../../modules/database-tools/largeScript.js'
import { StartPage } from './components/StartPage'
import { PanelConnectionContext, PanelEditorContext, PanelNavigationContext, panelRegistry, type SelectedExplorerObject } from './panels/registry'
import { findTextMatches, type TextMatch } from '../modules/navigation/search.js'
import { defaultSettings, normalizeShortcut, type AppSettings } from '../../../modules/options/types.js'
import { useI18n } from './i18n/useI18n.js'
import type { UserSnippet } from '../../../modules/editor/snippetStore.js'

const Editor = lazy(() => import('./components/MonacoEditor'))
const ObjectEditor = lazy(() => import('./components/ObjectEditor').then((module) => ({ default: module.ObjectEditor })))
const SourceControlPanel = lazy(() => import('./panels/source-control/Panel.js'))

type ThemeMode = 'auto' | 'light' | 'dark' | 'high-contrast' | 'blue' | 'office'
type DocumentTab = { id: string; label: string; modified: boolean; filePath?: string; panelId?: string; objectEditor?: ObjectEditorTarget & { isNew: boolean }; databaseEditor?: { recordId: string } }
type DatabaseDraft = { name: string; charset: string; collation: string; sql: string; page: 'General' | 'SQL' }
type OutputEntry = { timestamp: string; origin: string; message: string; tone: string }
type OutputView = 'General' | 'SQL Log' | 'Debug'
type PageQuery = { database: string; table: string; offset: number }
const emptyEditorMetadata: EditorMetadata = { database: '', databases: [], objects: [], routines: [] }
const editorCommands = new Set(['Make Uppercase', 'Make Lowercase', 'Toggle Block Comment', 'Uncomment Selection', 'Move Selected Lines Up', 'Move Selected Lines Down', 'Join Lines', 'Join Lines (alternate)', 'Remove Line', 'Increase Line Indent', 'Decrease Line Indent', 'Select Current Statement', 'Add Backticks to All Identifiers', 'Remove Unnecessary Backticks', 'Qualify object names', 'Expand wildcards', 'Incremental Search', 'View White Space', 'Word Wrap', 'Show Line Numbers', 'Execute To Cursor', 'Run To Cursor', 'Insert Breakpoint', 'Rename', 'Go To Definition', 'Jump Between Syntax Pairs', 'Insert Snippet', 'List Members', 'Parameter Info', 'Quick Info', 'Complete Word', 'Refresh Suggestions', 'Disable Code Completion', 'Toggle Bookmark', 'Previous Bookmark', 'Next Bookmark', 'Clear Bookmarks', 'Toggle Outline Expansion', 'Toggle All Outlining', 'Stop Outlining', 'Start Automatic Outlining', 'Format Document', 'Format Selection', 'Format Current Statement'])

export default function App(): React.JSX.Element {
  const floatParams = window.location.hash.startsWith('#float-sql?') ? new URLSearchParams(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : undefined
  const floatedDocument = floatParams?.get('doc')
  const floatPanelParams = window.location.hash.startsWith('#float-panel?') ? new URLSearchParams(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : undefined
  const floatedPanelId = floatPanelParams?.get('panel')
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
  const [nonCriticalReady, setNonCriticalReady] = useState(false)
  const [updateState, setUpdateState] = useState<UpdateStatus>({ phase: 'idle', currentVersion: '0.1.0', summary: [], log: [] })
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [panelDockDirection, setPanelDockDirection] = useState<DockDirection>(() => normalizeDockDirection(localStorage.getItem('tuxsql.panelDockDirection')))
  const [dockGuidesOpen, setDockGuidesOpen] = useState(false)
  const dockDragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | undefined>(undefined)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('tuxsql.theme') as ThemeMode | null) ?? 'auto')
  const toolbarActions = ['newSql', 'newConnection', 'connectionManager', 'execute', 'stop', 'results'] as const
  const [toolbarHidden, setToolbarHidden] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('tuxsql.toolbarHidden') ?? '[]') as unknown; return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && ['newSql', 'newConnection', 'connectionManager', 'execute', 'stop', 'results'].includes(item)) : [] } catch { return [] } })
  const [toolbarCustomizeOpen, setToolbarCustomizeOpen] = useState(false)
  const [toolbarCustomizeTab, setToolbarCustomizeTab] = useState<'toolbars' | 'commands'>('toolbars')
  const [toolbarCommandSearch, setToolbarCommandSearch] = useState('')
  const [appSettings, setAppSettings] = useState<AppSettings>(structuredClone(defaultSettings))
  const appSettingsRef = useRef(appSettings)
  const monacoApiRef = useRef<typeof MonacoApi | undefined>(undefined)
  const [editorTheme, setEditorTheme] = useState('vs')
  const reopenPanelRef = useRef<(panelId: string) => void>(() => undefined)
  const openDataReportRef = useRef<(mode: 'report' | 'pivot') => void>(() => undefined)
  const menuRowRef = useRef<HTMLElement>(null)
  appSettingsRef.current = appSettings
  const [userSnippets, setUserSnippets] = useState<UserSnippet[]>([])
  const userSnippetsRef = useRef(userSnippets)
  userSnippetsRef.current = userSnippets
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [explorerVisible, setExplorerVisible] = useState(() => localStorage.getItem('tuxsql.explorerVisible') !== 'false')
  const [projectExplorerVisible, setProjectExplorerVisible] = useState(() => localStorage.getItem('tuxsql.projectExplorerVisible') === 'true')
  const [projectExplorerPinned, setProjectExplorerPinned] = useState(() => localStorage.getItem('tuxsql.projectExplorerPinned') === 'true')
  const [panelVisible, setPanelVisible] = useState(() => localStorage.getItem('tuxsql.panelVisible') !== 'false')
  const [explorerWidth, setExplorerWidth] = useState(() => Number(localStorage.getItem('tuxsql.explorerWidth')) || 280)
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('tuxsql.panelHeight')) || 200)
  const [panelTab, setPanelTab] = useState<'Output' | 'Error List' | 'Find Results'>('Output')
  const [documents, setDocuments] = useState<DocumentTab[]>(readStoredDocuments)
  const [documentLayout, setDocumentLayout] = useState<DocumentLayout>(() => {
    const ids = readStoredDocuments().map((item) => item.id)
    try { return parseDocumentLayout(JSON.parse(localStorage.getItem('tuxsql.documentLayout') ?? 'null'), ids) ?? createDocumentLayout(ids) }
    catch { return createDocumentLayout(ids) }
  })
  const [documentDropGuides, setDocumentDropGuides] = useState(false)
  const [databaseDrafts, setDatabaseDrafts] = useState<Record<string, DatabaseDraft>>({})
  const [databaseEditorStatus, setDatabaseEditorStatus] = useState('')
  const [pinnedTabs, setPinnedTabs] = useState<string[]>([])
  const [tabGroups, setTabGroups] = useState<Record<string, 'horizontal' | 'vertical'>>({})
  const [splitDocument, setSplitDocument] = useState<string | undefined>()
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>('vertical')
  const draggedTabRef = useRef<string | undefined>(undefined)
  const [documentDropTarget, setDocumentDropTarget] = useState<{ documentId: string; direction: DockDirection | 'center' }>()
  const [tabContext, setTabContext] = useState<{ x: number; y: number; tabId: string }>()
  const tabContextMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tabContext) return
    tabContextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent): void => { if (!(event.target instanceof Element) || !event.target.closest('.tab-context-menu')) setTabContext(undefined) }
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') setTabContext(undefined) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [tabContext])
  const [selectedDocument, setSelectedDocument] = useState(() => localStorage.getItem('tuxsql.selectedDocument') ?? 'start')
  const [sqlByDocument, setSqlByDocument] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tuxsql.sqlDrafts') ?? '{}') as Record<string, string> }
    catch { return {} }
  })
  useEffect(() => {
    const unsubscribe = window.tuxsql.onFloatSqlUpdate((documentId, contents) => {
      setSqlByDocument((current) => current[documentId] === contents ? current : { ...current, [documentId]: contents })
      setDocuments((current) => current.map((tab) => tab.id === documentId ? { ...tab, modified: true } : tab))
    })
    return unsubscribe
  }, [])
  useEffect(() => {
    if (floatedDocument) return
    for (const [documentId, contents] of Object.entries(sqlByDocument)) void window.tuxsql.floatSqlChange(documentId, contents)
  }, [sqlByDocument, floatedDocument])
  useEffect(() => {
    const ids = documents.map((item) => item.id)
    setDocumentLayout((current) => parseDocumentLayout(current, ids) ?? createDocumentLayout(ids))
  }, [documents])
  useEffect(() => { localStorage.setItem('tuxsql.documentLayout', serializeDocumentLayout(documentLayout)) }, [documentLayout])
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
  const [longQueryNotice, setLongQueryNotice] = useState(false)
  const [transactionNotice, setTransactionNotice] = useState(false)
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
  const signatureHelpProviderRef = useRef<{ dispose(): void } | null>(null)
  const formattingRef = useRef(false)
  const analysisTimerRef = useRef<number | undefined>(undefined)
  const bookmarkDecorationsRef = useRef<Map<string, string[]>>(new Map())
  const outliningStateRef = useRef<Map<string, boolean>>(new Map())
  const completionEnabledRef = useRef(true)
  const snippetPickerRef = useRef(false)
  const [errors, setErrors] = useState<string[]>([])
  const [executionError, setExecutionError] = useState<{ message: string; resolve: (action: ScriptErrorAction) => void } | null>(null)
  const [analysisFindings, setAnalysisFindings] = useState<CodeAnalysisFinding[]>([])
  const [findOpen, setFindOpen] = useState(false)
  const [findReplaceMode, setFindReplaceMode] = useState(false)
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null)
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
  const [sqlLog, setSqlLog] = useState<OutputEntry[]>([])
  const [outputView, setOutputView] = useState<OutputView>('General')
  const [errorSeverity, setErrorSeverity] = useState<'all' | 'Error' | 'Warning' | 'Message'>('all')
  const [activeDocumentOnly, setActiveDocumentOnly] = useState(false)
  const [errorDocumentId, setErrorDocumentId] = useState('')
  const [analysisDocumentId, setAnalysisDocumentId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [vaultWarning, setVaultWarning] = useState('')
  const [backupScheduleWarning, setBackupScheduleWarning] = useState(false)
  const theme = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode === 'blue' || themeMode === 'office' ? 'light' : themeMode
  useEffect(() => {
    const handleModuleErrors = (event: Event): void => {
      const items = (event as CustomEvent<unknown>).detail
      if (!Array.isArray(items)) return
      const messages = items.filter((item): item is string => typeof item === 'string').slice(0, 500)
      if (!messages.length) return
      setErrors(messages); setErrorDocumentId(''); setActiveDocumentOnly(false); setPanelTab('Error List'); setPanelVisible(true)
    }
    window.addEventListener('tuxsql:module-errors', handleModuleErrors)
    return () => window.removeEventListener('tuxsql:module-errors', handleModuleErrors)
  }, [])
  function applyEditorTheme(api: typeof MonacoApi, settings: AppSettings, mode: ThemeMode): void {
    api.editor.defineTheme('tuxsql-user-colors', {
      base: mode === 'dark' || mode === 'high-contrast' ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [{ token: 'keyword', foreground: settings.appearance.keywordColor.slice(1) }],
      colors: { 'editor.foreground': settings.appearance.editorForeground, 'editor.background': settings.appearance.editorBackground, 'editor.lineHighlightBackground': settings.appearance.currentLineColor }
    })
    setEditorTheme('tuxsql-user-colors')
  }
  useEffect(() => { if (monacoApiRef.current) applyEditorTheme(monacoApiRef.current, appSettings, themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode) }, [appSettings, themeMode, systemDark])
  const currentConnection = active[0]
  const currentRecord = records.find((record) => record.id === currentConnection?.recordId)
  useEffect(() => {
    if (!currentConnection || autoCommit || appSettings.notifications.openTransactionSeconds === 0) { setTransactionNotice(false); return }
    const timer = window.setTimeout(() => setTransactionNotice(true), appSettings.notifications.openTransactionSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [appSettings.notifications.openTransactionSeconds, autoCommit, currentConnection])
  useEffect(() => {
    if (!longQueryNotice && !transactionNotice) return
    const timer = window.setTimeout(() => { setLongQueryNotice(false); setTransactionNotice(false) }, appSettings.notifications.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [appSettings.notifications.durationSeconds, longQueryNotice, transactionNotice])
  useEffect(() => {
    let cancelled = false
    void window.tuxsql.getFailedBackupSchedules().then((ids) => { if (!cancelled && ids.length) setBackupScheduleWarning(true) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!currentConnection) { setServerVersion(''); return }
    let cancelled = false
    const record = records.find((item) => item.id === currentConnection.recordId)
    if (!record) return
    void window.tuxsql.testConnection(record).then((result) => {
      if (!cancelled) setServerVersion(result.serverVersion)
    }).catch(() => { if (!cancelled) setServerVersion('') })
    return () => { cancelled = true }
  }, [currentConnection, records])
  const activeObjectTab = documents.find((tab) => tab.id === selectedDocument)?.objectEditor
  const activeDatabaseTab = documents.find((tab) => tab.id === selectedDocument)?.databaseEditor
  const activePanelTab = documents.find((tab) => tab.id === selectedDocument)?.panelId
  const primaryGroupTabs = findDocumentGroup(documentLayout.root, selectedDocument)?.tabs ?? documents.map((tab) => tab.id)
  const activeSql = selectedDocument !== 'start' && !activeObjectTab && !activeDatabaseTab && !activePanelTab
  const activeSqlText = activeSql ? sqlByDocument[selectedDocument] ?? '' : ''
  const navigationSqlDocument = documents.find((tab) => tab.id === selectedDocument && !tab.objectEditor && !tab.databaseEditor && !tab.panelId)
    ?? [...documents].reverse().find((tab) => !tab.objectEditor && !tab.databaseEditor && !tab.panelId && tab.id !== 'start')
  const navigationSqlText = navigationSqlDocument ? sqlByDocument[navigationSqlDocument.id] ?? '' : ''
  const navigationMatches = useMemo(() => findMatches, [findMatches])
  const loadConnections = useCallback(async (): Promise<void> => {
    try { setRecords(await window.tuxsql.getConnections()); setLoadError('') }
    catch (error) { setLoadError(error instanceof Error ? error.message : t('ui.app.msg.d584912ffc')) }
  }, [t])

  useEffect(() => {
    log('Startup', `Renderer ready · ${performance.now().toFixed(0)} ms since navigation.`)
    void loadConnections()
    void window.tuxsql.getVaultStatus().then((vault) => { setVaultWarning(vault.warning ?? ''); if (vault.warning) log('Security', vault.warning, 'warning') }).catch(() => {})
    const applySettings = (settings: AppSettings, initial = false): void => {
      setAppSettings(settings); setThemeMode(settings.appearance.theme); setAutoCommit(settings.execution.autoCommit)
      if (initial) setDocuments((current) => {
        if (!settings.environment.restoreSession || settings.environment.startup === 'empty') return [{ id: 'start', label: 'Start Page', modified: false }]
        return current.filter((tab) => tab.id === 'start' || (settings.documents.restoreSqlDocuments && !tab.panelId && !tab.objectEditor && !tab.databaseEditor) || (settings.documents.restoreOtherDocuments && (Boolean(tab.panelId) || Boolean(tab.objectEditor) || Boolean(tab.databaseEditor))))
      })
      completionEnabledRef.current = settings.editor.autoComplete
      if (initial && settings.environment.showStartPage && settings.environment.startup === 'start-page') setSelectedDocument('start')
      document.documentElement.style.setProperty('--accent', settings.appearance.accent)
      document.documentElement.style.zoom = String(settings.appearance.uiZoom / 100)
      document.documentElement.style.setProperty('--grid-row-height', `${settings.grid.rowHeight}px`)
      document.documentElement.style.fontFamily = settings.editor.fontName === 'monospace' ? '' : settings.editor.fontName
      editorRef.current?.updateOptions({ fontFamily: settings.editor.fontName, fontSize: settings.editor.fontSize, lineNumbers: settings.editor.lineNumbers ? 'on' : 'off', glyphMargin: settings.editor.glyphMargin, minimap: { enabled: settings.editor.minimap }, wordWrap: settings.editor.wordWrap ? 'on' : 'off', tabSize: settings.editor.tabSize, insertSpaces: settings.editor.insertSpaces, autoIndent: settings.editor.indentStyle === 'none' ? 'none' : settings.editor.indentStyle === 'smart' ? 'advanced' : 'keep', rulers: settings.editor.rightMargin > 0 ? [{ column: settings.editor.rightMargin, color: settings.appearance.editorForeground }] : [], folding: settings.editor.folding, renderLineHighlight: settings.editor.highlightCurrentLine ? 'line' : 'none', fontLigatures: settings.editor.ligatures, quickSuggestions: settings.editor.autoComplete, suggestOnTriggerCharacters: settings.editor.autoComplete, quickSuggestionsDelay: settings.editor.completionDelayMs, matchBrackets: settings.editor.matchBrackets ? 'always' : 'never', occurrencesHighlight: settings.editor.highlightOccurrences ? 'singleFile' : 'off', autoClosingBrackets: settings.editor.autoCloseBrackets ? 'always' : 'never', autoClosingQuotes: settings.editor.autoCloseQuotes ? 'always' : 'never', suggestSelection: settings.editor.completionCyclic ? 'first' : 'recentlyUsedByPrefix', acceptSuggestionOnEnter: 'off', acceptSuggestionOnCommitCharacter: settings.editor.completionConfirmCharacters.length > 0, wordBasedSuggestions: settings.editor.completionSortKeywords ? 'currentDocument' : 'off' })
    }
    const onSettingsChanged = (event: Event): void => applySettings((event as CustomEvent<AppSettings>).detail)
    const onClosePanel = (): void => setOpenPanel(null)
    const onReopenTask = (event: Event): void => {
      const task = (event as CustomEvent<{ panel: string; kind: string }>).detail
      if (!task || !['database-tools', 'import-export', 'schema-compare', 'data-compare'].includes(task.panel)) return
      reopenPanelRef.current(task.panel)
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('tuxsql:task:restore', { detail: task })), 350)
    }
    const onGridSendToPanel = (event: Event): void => {
      const destination = (event as CustomEvent<{ destination: string }>).detail?.destination
      if (destination === 'query-builder') reopenPanelRef.current('query-builder')
      else if (destination === 'report') openDataReportRef.current('report')
      else if (destination === 'pivot') openDataReportRef.current('pivot')
    }
    window.addEventListener('tuxsql:settings-changed', onSettingsChanged)
    window.addEventListener('tuxsql:close-panel', onClosePanel)
    window.addEventListener('tuxsql:task:reopen', onReopenTask)
    window.addEventListener('tuxsql:grid:send-to-panel', onGridSendToPanel)
    void window.tuxsql.loadSettings().then((result) => applySettings(result.settings, true)).catch((error: unknown) => log('Options', error instanceof Error ? error.message : 'Settings unavailable.', 'warning'))
    let readyActive = true
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      void window.tuxsql.initializeNonCriticalIpc().then(() => { if (readyActive) setNonCriticalReady(true) }).catch((error: unknown) => log('Startup', error instanceof Error ? error.message : 'Optional tools are unavailable.', 'warning'))
    }))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => { readyActive = false; window.cancelAnimationFrame(frame); media.removeEventListener('change', onChange); window.removeEventListener('tuxsql:settings-changed', onSettingsChanged); window.removeEventListener('tuxsql:close-panel', onClosePanel); window.removeEventListener('tuxsql:task:reopen', onReopenTask); window.removeEventListener('tuxsql:grid:send-to-panel', onGridSendToPanel) }
  }, [loadConnections])

  useEffect(() => {
    if (!nonCriticalReady) return
    void window.tuxsql.listUserSnippets().then(setUserSnippets).catch(() => setUserSnippets([]))
  }, [nonCriticalReady])

  useEffect(() => {
    if (!nonCriticalReady) return
    let active = true
    const unsubscribe = window.tuxsql.onUpdaterStatus((next) => {
      if (!active) return
      setUpdateState(next)
    })
    void window.tuxsql.updaterStatus().then((next) => { if (active) setUpdateState(next) }).catch(() => undefined)
    return () => { active = false; unsubscribe() }
  }, [nonCriticalReady])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.skin = themeMode === 'blue' || themeMode === 'office' ? themeMode : ''
    localStorage.setItem('tuxsql.theme', themeMode)
  }, [theme, themeMode])
  useEffect(() => {
    performance.mark('tuxsql:renderer-mounted')
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => performance.mark('tuxsql:first-paint-settled')) })
    const observer = typeof PerformanceObserver === 'undefined' ? undefined : new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) if (entry.duration >= 200) console.warn(`[startup-trace] long task ${Math.round(entry.duration)} ms at ${Math.round(entry.startTime)} ms`)
    })
    try { observer?.observe({ type: 'longtask', buffered: true }) } catch { /* longtask is unavailable in some Electron builds */ }
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); observer?.disconnect() }
  }, [])
  useEffect(() => { localStorage.setItem('tuxsql.toolbarHidden', JSON.stringify(toolbarHidden)) }, [toolbarHidden])

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
    window.addEventListener('tuxsql:insert-ai-sql', insertSql)
    const removeOpenSql = window.tuxsql.onOpenSqlPath((path) => {
      void window.tuxsql.openSqlPath(path).then((file) => {
        const id = `sql-${crypto.randomUUID()}`
        setDocuments((current) => [...current, { id, label: file.path.split('/').at(-1) ?? 'query.sql', filePath: file.path, modified: false }])
        setSqlByDocument((current) => ({ ...current, [id]: file.contents }))
        setSelectedDocument(id)
      }).catch((error: unknown) => log('File', error instanceof Error ? error.message : t('ui.app.msg.1451c57c9a'), 'error'))
    })
    return () => { window.removeEventListener('tuxsql:insert-ai-sql', insertSql); removeOpenSql() }
  }, [t])

  useEffect(() => { localStorage.setItem('tuxsql.explorerVisible', String(explorerVisible)) }, [explorerVisible])
  useEffect(() => { localStorage.setItem('tuxsql.projectExplorerVisible', String(projectExplorerVisible)) }, [projectExplorerVisible])
  useEffect(() => { localStorage.setItem('tuxsql.projectExplorerPinned', String(projectExplorerPinned)) }, [projectExplorerPinned])
  useEffect(() => { localStorage.setItem('tuxsql.panelVisible', String(panelVisible)) }, [panelVisible])
  useEffect(() => { localStorage.setItem('tuxsql.explorerWidth', String(explorerWidth)) }, [explorerWidth])
  useEffect(() => { localStorage.setItem('tuxsql.panelHeight', String(panelHeight)) }, [panelHeight])
  useEffect(() => { localStorage.setItem('tuxsql.panelDockDirection', panelDockDirection) }, [panelDockDirection])
  useEffect(() => { localStorage.setItem('tuxsql.documents', JSON.stringify(documents)) }, [documents])
  useEffect(() => { localStorage.setItem('tuxsql.selectedDocument', selectedDocument) }, [selectedDocument])
  useEffect(() => { localStorage.setItem('tuxsql.sqlDrafts', JSON.stringify(sqlByDocument)) }, [sqlByDocument])
  useEffect(() => { metadataRef.current = editorMetadata }, [editorMetadata])

  useEffect(() => {
    if (!nonCriticalReady) { setHistoryLoading(false); return }
    let cancelled = false
    setHistoryLoading(true)
    void window.tuxsql.listSqlExecutionHistory({ search: historySearch, limit: 200 }).then((entries) => { if (!cancelled) setHistory(entries) }).catch((error: unknown) => { if (!cancelled) log('History', error instanceof Error ? error.message : t('ui.app.msg.b0912de8a4'), 'error') }).finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [historySearch, nonCriticalReady, t])

  useEffect(() => {
    let cancelled = false
    if (!currentConnection?.database) { setEditorMetadata(emptyEditorMetadata); setMetadataLoading(false); return }
    setMetadataLoading(true)
    void window.tuxsql.getEditorMetadata(currentConnection.id, currentConnection.database).then((value) => { if (!cancelled) setEditorMetadata(value) }).catch((error: unknown) => { if (!cancelled) { setEditorMetadata({ ...emptyEditorMetadata, database: currentConnection.database ?? '' }); log('Editor', error instanceof Error ? error.message : t('ui.app.msg.fb04dcc335'), 'warning') } }).finally(() => { if (!cancelled) setMetadataLoading(false) })
    return () => { cancelled = true }
  }, [currentConnection?.id, currentConnection?.database, t])

  function log(origin: string, message: string, tone = 'info'): void {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setOutput((current) => [...current, { timestamp, origin, message: maskSecrets(redactSqlSecrets(message)), tone }].slice(-500))
  }

  function logSql(sql: string, results: QueryResult[], elapsedMs: number, failed = false): void {
    if (!appSettingsRef.current.output.sqlLogEnabled) return
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    const executionMs = results.reduce((sum, item) => sum + (item.executionTimeMs ?? 0), 0)
    const fetchMs = results.reduce((sum, item) => sum + (item.fetchTimeMs ?? 0), 0)
    const rows = results.reduce((sum, item) => sum + (item.rowCount ?? item.rows.length), 0)
    const message = `${normalizeQuery(redactSqlSecrets(sql)).slice(0, 2000)} · total ${elapsedMs.toFixed(2)} ms · execution ${executionMs.toFixed(2)} ms · fetch ${fetchMs.toFixed(2)} ms · ${rows} rows${failed ? ' · failed' : ''}`
    setSqlLog((current) => [...current, { timestamp, origin: documents.find((tab) => tab.id === selectedDocument)?.label ?? 'SQL', message, tone: failed ? 'error' : 'info' }].slice(-500))
    log('Execution', `${documents.find((tab) => tab.id === selectedDocument)?.label ?? 'SQL'} · total ${elapsedMs.toFixed(2)} ms · execution ${executionMs.toFixed(2)} ms · fetch ${fetchMs.toFixed(2)} ms · ${rows} rows${failed ? ' · failed' : ''}`, failed ? 'error' : 'success')
  }

  async function checkForUpdates(): Promise<void> {
    try {
      const next = await window.tuxsql.updaterCheck()
      setUpdateState(next)
      if (next.phase === 'available' || next.phase === 'error') setUpdateDialogOpen(true)
    } catch (error) { setUpdateState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : 'Update check failed.' })); setUpdateDialogOpen(true) }
  }

  async function applyUpdate(): Promise<void> {
    try {
      let next = await window.tuxsql.updaterApply(false)
      if (next.phase === 'blocked' && (queryBusy || (!autoCommit && !transactionCommitted))) {
        if (window.confirm(next.message ?? t('updates.busyConfirm'))) next = await window.tuxsql.updaterApply(true)
      }
      setUpdateState(next)
    } catch (error) { setUpdateState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : 'Update failed.' })) }
  }

  async function ignoreUpdate(): Promise<void> {
    if (!updateState.newVersion) return
    try {
      const { settings } = await window.tuxsql.loadSettings()
      const next = await window.tuxsql.saveSettings({ ...settings, updater: { ...settings.updater, ignoredVersion: updateState.newVersion } })
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
        await window.tuxsql.savePassword(reference, field.value)
        field.path(reference)
        if (!persistSecret) ephemeral.push(reference)
      }
      if (action === 'save') {
        await window.tuxsql.saveConnection(storedRecord)
        upsertRecord(storedRecord)
        log('Connections', t('ui.app.connectionSaved', [storedRecord.name]), 'success')
        setDialogRecord(null)
        return
      }
      if (action === 'test') return await window.tuxsql.testConnection(requestRecord)

      await window.tuxsql.saveConnection(storedRecord)
      const connectingId = record.id
      setConnecting((current) => [...new Set([...current, connectingId])])
      setConnectionErrors((current) => ({ ...current, [record.id]: '' }))
      setStatus('Connecting…')
      try {
        const connected = await window.tuxsql.connect(requestRecord)
        const updated = { ...storedRecord, lastUsedAt: new Date().toISOString() }
        await window.tuxsql.saveConnection(updated)
        upsertRecord(updated)
        setActive((current) => [...current.filter((item) => item.recordId !== record.id), connected])
        const found = await window.tuxsql.listDatabases(connected.id)
        setDatabases((current) => ({ ...current, [record.id]: found }))
        setConnectionErrors((current) => ({ ...current, [record.id]: '' }))
        setStatus('Ready')
        log('Connections', `Conectado a ${record.name} · ${record.type.toUpperCase()}.`, 'success')
        setDialogRecord(null)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : t('ui.app.msg.4b8425c313')
        setConnectionErrors((current) => ({ ...current, [record.id]: message }))
        setErrors((current) => [...current, message])
        setStatus('Error')
        log('Connections', message, 'error')
        throw error
      } finally {
        setConnecting((current) => current.filter((id) => id !== connectingId))
      }
    } finally {
      for (const reference of ephemeral) await window.tuxsql.deletePassword(reference)
    }
  }

  async function connectFromExplorer(record: ConnectionRecord): Promise<void> {
    const needsCredential = (!record.passwordRef && !record.ssh.passwordRef && record.ssh.enabled && record.ssh.authMethod === 'password') || (!record.passwordRef && !record.ssh.enabled)
    if (needsCredential) { openEdit(record); return }
    try { await runConnectionAction(record, emptySecrets(), true, 'connect') }
    catch (error) {
      const fingerprint = error instanceof Error ? /SSH host key não confiável: (SHA256:\S+)/.exec(error.message)?.[1] : undefined
      if (fingerprint && window.confirm(`SSH fingerprint ${fingerprint}\n\n${t('ui.app.trustHostKey')}`)) {
        const trusted = { ...record, ssh: { ...record.ssh, hostFingerprint: fingerprint } }
        await window.tuxsql.saveConnection(trusted)
        upsertRecord(trusted)
        try { await runConnectionAction(trusted, emptySecrets(), true, 'connect') } catch { /* Explorer shows the retry error. */ }
      }
    }
  }

  async function disconnect(connection: ConnectionSummary): Promise<void> {
    await window.tuxsql.disconnect(connection.id)
    setAutoCommit(true)
    setActive((current) => current.filter((item) => item.id !== connection.id))
    setDatabases((current) => { const next = { ...current }; delete next[connection.recordId]; return next })
    setStatus('Ready')
    log('Connections', t('ui.app.disconnected', [connection.name]))
  }

  async function expandRecord(record: ConnectionRecord): Promise<void> {
    const connected = active.find((item) => item.recordId === record.id)
    if (!connected) return
    try {
      const found = await window.tuxsql.listDatabases(connected.id)
      setDatabases((current) => ({ ...current, [record.id]: found }))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('ui.app.msg.dcb9e42c07')
      setConnectionErrors((current) => ({ ...current, [record.id]: message }))
      log('Connections', message, 'error')
    }
  }

  async function loadObjects(connection: ConnectionSummary, database: string): Promise<void> {
    const key = `${connection.recordId}:${database}`
    setLoadingObjects((current) => [...new Set([...current, key])])
    try { const loaded = await window.tuxsql.listDatabaseObjects(connection.id, database); setObjects((current) => ({ ...current, [key]: loaded })) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : t('ui.app.msg.6d9bdf2d2a'), 'error') }
    finally { setLoadingObjects((current) => current.filter((item) => item !== key)) }
  }


  async function selectDatabase(connection: ConnectionSummary, database: string): Promise<void> {
    try {
      await window.tuxsql.setDatabase(connection.id, database)
      setActive((current) => current.map((item) => item.id === connection.id ? { ...item, database } : item))
      log('Database', t('ui.app.databaseSelected', [database]))
    } catch (error) { log('Database', error instanceof Error ? error.message : t('ui.app.msg.fa3a44b014'), 'error') }
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

  function openDatabaseEditor(recordId: string): void {
    const id = `database-${crypto.randomUUID()}`
    const name = 'database_name'
    const databaseEditor = { recordId }
    setDocuments((current) => [...current, { id, label: 'New Database', modified: false, databaseEditor }])
    setDatabaseDrafts((current) => ({ ...current, [id]: { name, charset: 'utf8mb4', collation: '', sql: buildCreateDatabaseDdl(name), page: 'General' } }))
    setSelectedDocument(id)
  }

  function updateDatabaseDraft(change: Partial<DatabaseDraft>, regenerate = false): void {
    setDatabaseEditorStatus('')
    setDatabaseDrafts((current) => {
      const draft = current[selectedDocument]
      if (!draft) return current
      const next = { ...draft, ...change }
      if (regenerate) {
        try { next.sql = buildCreateDatabaseDdl(next.name, next.charset, next.collation) }
        catch { /* Keep the last valid preview while the form is being edited. */ }
      }
      return { ...current, [selectedDocument]: next }
    })
    setDocuments((current) => current.map((tab) => tab.id === selectedDocument ? { ...tab, modified: true } : tab))
  }

  async function applyDatabaseDraft(): Promise<void> {
    const tab = documents.find((item) => item.id === selectedDocument)
    const draft = databaseDrafts[selectedDocument]
    if (!tab?.databaseEditor || !draft) return
    let safeSql: string
    try { safeSql = validateCreateDatabaseDdl(draft.sql, draft.name) }
    catch (error) { setDatabaseEditorStatus(error instanceof Error ? error.message : t('database.editor.mustCreate')); return }
    if (!window.confirm(t('database.editor.confirm', [draft.name]))) return
    const record = records.find((item) => item.id === tab.databaseEditor!.recordId)
    if (!record) { setDatabaseEditorStatus(t('database.editor.connectionMissing')); return }
    if (record.advanced.readOnly) { setDatabaseEditorStatus(t('explorer.readOnly')); return }
    let connected: ConnectionSummary | undefined
    try {
      connected = await window.tuxsql.connect(record)
      await window.tuxsql.executeSql(connected.id, safeSql)
      const found = await window.tuxsql.listDatabases(connected.id)
      setDatabases((current) => ({ ...current, [record.id]: found }))
      setDatabaseEditorStatus(t('database.editor.created', [draft.name]))
      setDocuments((current) => current.map((item) => item.id === selectedDocument ? { ...item, label: draft.name, modified: false } : item))
    } catch (error) { setDatabaseEditorStatus(error instanceof Error ? error.message : t('database.editor.failed')) }
    finally { if (connected) await window.tuxsql.disconnect(connected.id).catch(() => {}) }
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
    const selectedProfile = appSettingsRef.current.editor.formatProfiles.find((profile) => profile.name === appSettingsRef.current.editor.activeFormatProfile)
    const formatted = formatSql(text, { profile: findFormatProfile(appSettingsRef.current.editor.formatProfiles, appSettingsRef.current.editor.activeFormatProfile), keywordCase: appSettingsRef.current.editor.keywordCase === 'lower' ? 'lower' : selectedProfile?.keywordCase ?? 'upper', indentSize: selectedProfile?.indentSize ?? 2 })
    if (formatted === text) return
    editor.pushUndoStop()
    formattingRef.current = true
    try { editor.executeEdits('tuxsql.sql-format', [{ range, text: formatted, forceMoveMarkers: true }]) }
    finally { formattingRef.current = false }
    editor.pushUndoStop()
    editor.focus()
  }

  function runEditorCommand(command: string): void {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const actionIds: Record<string, string> = {
      'Toggle Block Comment': 'editor.action.blockComment', 'Comment Selection': 'editor.action.commentLine',
      'Uncomment Selection': 'editor.action.removeCommentLine', 'Move Selected Lines Up': 'editor.action.moveLinesUpAction',
      'Move Selected Lines Down': 'editor.action.moveLinesDownAction', 'Join Lines': 'editor.action.joinLines', 'Join Lines (alternate)': 'editor.action.joinLines',
      'Remove Line': 'editor.action.deleteLines', 'Increase Line Indent': 'editor.action.indentLines',
      'Decrease Line Indent': 'editor.action.outdentLines', 'Jump Between Syntax Pairs': 'editor.action.jumpToBracket',
      'List Members': 'editor.action.triggerSuggest', 'Parameter Info': 'editor.action.triggerParameterHints',
      'Quick Info': 'editor.action.showHover', 'Complete Word': 'editor.action.triggerSuggest',
      'Refresh Suggestions': 'editor.action.triggerSuggest', 'Toggle Outline Expansion': 'editor.toggleFold',
      'Stop Outlining': 'editor.unfoldAll', 'Start Automatic Outlining': 'editor.foldAll',
      'Cut': 'editor.action.clipboardCutAction', 'Copy': 'editor.action.clipboardCopyAction', 'Paste': 'editor.action.clipboardPasteAction'
    }
    const actionId = actionIds[command]
    if (actionId) { editor.focus(); editor.trigger('tuxsql-command', actionId, null); return }
    if (command === 'Toggle All Outlining' || command === 'Stop Outlining' || command === 'Start Automatic Outlining') {
      const key = model.uri.toString()
      const collapsed = command === 'Stop Outlining' ? false : command === 'Start Automatic Outlining' ? true : toggleOutlining(outliningStateRef.current.get(key) ?? false)
      outliningStateRef.current.set(key, collapsed)
      editor.focus()
      editor.trigger('tuxsql-outlining', collapsed ? 'editor.foldAll' : 'editor.unfoldAll', null)
      return
    }
    if (command === 'Format Document') return formatEditor('document')
    if (command === 'Format Selection') return formatEditor('selection')
    if (command === 'Format Current Statement') return formatEditor('statement')
    if (command === 'Select Current Statement') {
      const position = editor.getPosition(); if (!position) return
      const range = statementAtOffset(model.getValue(), model.getOffsetAt(position)); if (!range) return
      editor.setSelection({ startLineNumber: model.getPositionAt(range.start).lineNumber, startColumn: model.getPositionAt(range.start).column, endLineNumber: model.getPositionAt(range.end).lineNumber, endColumn: model.getPositionAt(range.end).column }); editor.focus(); return
    }
    if (command === 'Make Uppercase' || command === 'Make Lowercase') {
      const selection = editor.getSelection() ?? model.getFullModelRange(); const value = model.getValueInRange(selection)
      editor.executeEdits('tuxsql-case', [{ range: selection, text: command === 'Make Uppercase' ? value.toUpperCase() : value.toLowerCase() }]); editor.focus(); return
    }
    if (command === 'Add Backticks to All Identifiers' || command === 'Remove Unnecessary Backticks') {
      const range = model.getFullModelRange(); const sql = model.getValue(); const mode = command.startsWith('Add') ? 'add-backticks' : 'remove-backticks'
      const transformed = transformIdentifiers(sql, mode); if (transformed !== sql) editor.executeEdits('tuxsql-backticks', [{ range, text: transformed }]); editor.focus(); return
    }
    if (command === 'Expand wildcards' || command === 'Qualify object names') {
      const range = model.getFullModelRange(); const sql = model.getValue()
      const transformed = command === 'Expand wildcards' ? expandSqlWildcards(sql, metadataRef.current) : qualifyObjectNames(sql, metadataRef.current)
      if (transformed !== sql) editor.executeEdits('tuxsql-refactor', [{ range, text: transformed }]); editor.focus(); return
    }
    if (command === 'Incremental Search') { openFind(false); return }
    if (command === 'View White Space') { editor.updateOptions({ renderWhitespace: editor.getRawOptions().renderWhitespace === 'none' ? 'all' : 'none' }); editor.focus(); return }
    if (command === 'Word Wrap') { editor.updateOptions({ wordWrap: editor.getRawOptions().wordWrap === 'on' ? 'off' : 'on' }); editor.focus(); return }
    if (command === 'Show Line Numbers') { editor.updateOptions({ lineNumbers: editor.getRawOptions().lineNumbers === 'off' ? 'on' : 'off' }); editor.focus(); return }
    if (command === 'Execute To Cursor') { const position = editor.getPosition(); if (position) void runSql('auto', model.getValue().slice(0, model.getOffsetAt(position))); return }
    if (command === 'Run To Cursor') { window.dispatchEvent(new CustomEvent('tuxsql:debugger-command', { detail: { command } })); return }
    if (command === 'Insert Breakpoint') { log('Debugger', `Breakpoint requested at line ${editor.getPosition()?.lineNumber ?? 1}; start a routine debug session to attach it.`); return }
    if (command === 'Insert Snippet') { snippetPickerRef.current = true; editor.focus(); editor.trigger('keyboard', 'editor.action.triggerSuggest', null); return }
    if (command === 'Execute SQL') { void runSql(); return }
    if (command === 'Execute Current Statement') { void runSql('current'); return }
    if (command === 'Go To Definition') {
      const word = model.getWordAtPosition(editor.getPosition() ?? { lineNumber: 1, column: 1 })?.word
      const object = editorMetadata.objects.find((item) => item.name.toLowerCase() === word?.toLowerCase())
      if (object && currentConnection) { setSelectedExplorerObject({ connection: currentConnection, database: editorMetadata.database, object: { name: object.name, kind: object.kind } }); openRegisteredPanel('object-viewer') }
      else editor.trigger('keyboard', 'editor.action.goToDefinition', null)
      return
    }
    if (command === 'Rename') {
      const position = editor.getPosition(); const word = position && model.getWordAtPosition(position)?.word; if (!word) return
      const replacement = window.prompt(`Rename '${word}' to:`, word); if (!replacement || replacement === word) return
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const preview = model.getValue().replace(new RegExp(`\\b${escaped}\\b`, 'g'), replacement)
      if (window.confirm(`Preview rename in this document?\n\n${preview.slice(0, 1200)}`)) editor.executeEdits('tuxsql-rename', [{ range: model.getFullModelRange(), text: preview }])
      return
    }
    if (command === 'Toggle Bookmark' || command === 'Previous Bookmark' || command === 'Next Bookmark' || command === 'Clear Bookmarks') {
      const line = editor.getPosition()?.lineNumber ?? 1
      const key = model.uri.toString()
      const decorationIds = bookmarkDecorationsRef.current.get(key) ?? []
      const lines = new Set(decorationIds.flatMap((id) => { const range = model.getDecorationRange(id); return range ? [range.startLineNumber] : [] }))
      if (command === 'Clear Bookmarks') lines.clear()
      else if (command === 'Toggle Bookmark') { const updated = toggleBookmark(lines, line); lines.clear(); for (const bookmarkedLine of updated) lines.add(bookmarkedLine) }
      else {
        const next = findBookmark(lines, line, command === 'Next Bookmark' ? 'next' : 'previous')
        if (next) { editor.setPosition({ lineNumber: next, column: 1 }); editor.revealLineInCenter(next); editor.focus() }
      }
      editor.updateOptions({ glyphMargin: true })
      bookmarkDecorationsRef.current.set(key, model.deltaDecorations(decorationIds, [...lines].map((lineNumber) => ({ range: { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 }, options: { glyphMarginClassName: 'sql-bookmark-glyph' } }))))
      return
    }
    if (command === 'Disable Code Completion') { completionEnabledRef.current = !completionEnabledRef.current; editor.updateOptions({ quickSuggestions: completionEnabledRef.current, suggestOnTriggerCharacters: completionEnabledRef.current }); return }
    editor.focus()
  }

  async function runCodeAnalysis(): Promise<void> {
    if (!activeSqlText.trim()) return
    try {
      const findings = await window.tuxsql.analyzeSql(activeSqlText)
      setAnalysisFindings(findings)
      setAnalysisDocumentId(selectedDocument)
      setPanelTab('Error List')
      setPanelVisible(true)
      log('Code Analysis', findings.length ? `Analysis complete · ${findings.length} findings.` : 'Code analysis complete · No issues found.', findings.some((item) => item.severity === 'Error') ? 'error' : 'success')
    } catch (error) { log('Code Analysis', error instanceof Error ? error.message : 'Code Analysis Error', 'error') }
  }

  async function persistExecutionHistory(sql: string, startedAt: number, success: boolean, rowCount: number, error?: string): Promise<void> {
    if (!currentConnection || !appSettingsRef.current.documents.queryHistoryEnabled || new TextEncoder().encode(sql).length > appSettingsRef.current.documents.queryHistoryMaxKb * 1024) return
    const entry: SqlExecutionHistoryEntry = {
      id: crypto.randomUUID(), timestamp: new Date().toISOString(), connection: currentConnection.name,
      ...(currentConnection.database ? { database: currentConnection.database } : {}), sql,
      elapsedMs: Math.max(0, performance.now() - startedAt), success, rowCount, ...(error ? { error } : {})
    }
    try {
      await window.tuxsql.recordSqlExecutionHistory(entry)
      setHistory(await window.tuxsql.listSqlExecutionHistory({ search: historySearch, limit: 200 }))
    } catch (reason) { log('History', reason instanceof Error ? reason.message : t('ui.app.msg.56f63ff8f0'), 'error') }
  }

  function replayHistory(entry: SqlExecutionHistoryEntry): void {
    openSqlDocument(`History · ${new Date(entry.timestamp).toLocaleString()}`, entry.sql)
    void runSql('auto', entry.sql)
  }

  async function openSqlFile(): Promise<void> {
    try {
      const file = await window.tuxsql.openSqlFile()
      if (!file) return
      const id = `sql-${crypto.randomUUID()}`
      setDocuments((current) => [...current, { id, label: file.path.split('/').at(-1) ?? 'query.sql', filePath: file.path, modified: false }])
      setSqlByDocument((current) => ({ ...current, [id]: file.contents }))
      setSelectedDocument(id)
    } catch (error) { log('File', error instanceof Error ? error.message : t('ui.app.msg.1451c57c9a'), 'error') }
  }

  async function saveCurrentSql(): Promise<void> {
    const tab = documents.find((item) => item.id === selectedDocument)
    if (!tab || tab.id === 'start') return
    try {
      const path = await window.tuxsql.saveSqlFile(tab.filePath, sqlByDocument[selectedDocument] ?? '')
      if (path) setDocuments((current) => current.map((item) => item.id === selectedDocument ? { ...item, label: path.split('/').at(-1) ?? item.label, filePath: path, modified: false } : item))
    } catch (error) { log('File', error instanceof Error ? error.message : t('ui.app.msg.fe4b17d0ae'), 'error') }
  }

  async function saveAllSql(): Promise<void> {
    for (const tab of documents.filter((item) => item.id !== 'start' && item.filePath)) {
      try {
        const path = await window.tuxsql.saveSqlFile(tab.filePath, sqlByDocument[tab.id] ?? '')
        if (path) setDocuments((current) => current.map((item) => item.id === tab.id ? { ...item, label: path.split('/').at(-1) ?? item.label, filePath: path, modified: false } : item))
      } catch (error) { log('File', error instanceof Error ? error.message : `Could not save ${tab.label}.`, 'error') }
    }
  }

  function selectTop(connection: ConnectionSummary, database: string, object: DatabaseObject, limit: number | undefined = 1000): void {
    const boundedLimit = limit === undefined ? undefined : Number.isFinite(limit) ? Math.max(1, Math.min(1_000_000, Math.trunc(limit))) : 1000
    const limitClause = boundedLimit === undefined ? '' : ` LIMIT ${boundedLimit}`
    const id = openSqlDocument(`${connection.name} · ${object.name} data`, `SELECT * FROM \`${database.replace(/`/g, '``')}\`.\`${object.name.replace(/`/g, '``')}\`${limitClause};`)
    if (boundedLimit !== undefined) setPageQueries((current) => ({ ...current, [id]: { database, table: object.name, offset: boundedLimit } }))
  }

  async function loadMorePage(resultTab: number): Promise<void> {
    const page = pageQueries[selectedDocument]
    if (!page || !currentConnection) return
    const quote = (value: string): string => String.fromCharCode(96) + value.replaceAll(String.fromCharCode(96), String.fromCharCode(96).repeat(2)) + String.fromCharCode(96)
    const sql = `SELECT * FROM ${quote(page.database)}.${quote(page.table)} LIMIT 1000 OFFSET ${page.offset}`
    try {
      const next = await window.tuxsql.executeSql(currentConnection.id, sql, crypto.randomUUID(), currentConnection.database)
      const rows = next[0]?.rows ?? []
      setResults((current) => current.map((result, index) => index === resultTab ? { ...result, rows: [...result.rows, ...rows] } : result))
      if (rows.length < 1000) setPageQueries((current) => { const updated = { ...current }; delete updated[selectedDocument]; return updated })
      else setPageQueries((current) => ({ ...current, [selectedDocument]: { ...page, offset: page.offset + rows.length } }))
    } catch (error) { log('Execution', error instanceof Error ? error.message : t('ui.app.msg.d3c2951741'), 'error') }
  }

  async function generateScript(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    try { openSqlDocument(`Create ${object.name}`, await window.tuxsql.showCreateObject(connection.id, database, object)) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : t('ui.app.msg.f491ece97a'), 'error') }
  }

  async function dropObject(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    const kind = object.kind.toUpperCase()
    try {
      await window.tuxsql.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'drop')
      log('Explorer', t('ui.app.objectRemoved', [kind, object.name]), 'success')
      await loadObjects(connection, database)
    } catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao remover ${object.name}.`, 'error') }
  }

  async function renameTable(connection: ConnectionSummary, database: string, object: DatabaseObject, newName: string): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    try { await window.tuxsql.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'rename', newName); log('Explorer', t('ui.app.tableRenamed', [object.name, newName]), 'success'); await loadObjects(connection, database) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao renomear ${object.name}.`, 'error') }
  }

  async function truncateTable(connection: ConnectionSummary, database: string, object: DatabaseObject): Promise<void> {
    const record = records.find((item) => item.id === connection.recordId)
    if (record?.environment === 'prod' && window.prompt(t('security.prod.confirm', [database])) !== database) return
    try { await window.tuxsql.mutateDatabaseObject({ connectionId: connection.id, database, kind: object.kind, name: object.name }, 'truncate'); log('Explorer', t('ui.app.tableTruncated', [object.name]), 'success'); await loadObjects(connection, database) }
    catch (error) { log('Explorer', error instanceof Error ? error.message : `Falha ao truncar ${object.name}.`, 'error') }
  }

  async function deleteRecords(selected: ConnectionRecord[]): Promise<void> {
    for (const record of selected) {
      const connected = active.find((item) => item.recordId === record.id)
      if (connected) await disconnect(connected)
      await window.tuxsql.deleteConnection(record.id)
    }
    setRecords((current) => current.filter((record) => !selected.some((deleted) => deleted.id === record.id)))
    log('Connections', t('ui.app.connectionsRemoved', [selected.length]))
  }

  async function runSql(mode: 'auto' | 'current' = 'auto', queryOverride?: string): Promise<void> {
    if (!currentConnection || (!activeSql && queryOverride === undefined)) return
    const displaySqlError = (error: unknown): string => {
      const message = error instanceof Error ? error.message : ''
      const timeout = /^Query cancelled after (\d+) s \(command timeout\)$/.exec(message)
      return timeout ? t('execution.commandTimeoutCancelled', [timeout[1] ?? '']) : message || t('ui.app.queryFailed')
    }
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
    const splitterCompatible = /\\['"`]/.test(sql)
    const settingsForWarnings = appSettingsRef.current
    const executionOptions = {
      commandTimeoutSeconds: effectiveCommandTimeoutSeconds(settingsForWarnings.execution.commandTimeoutSeconds, settingsForWarnings.connections.commandTimeoutSeconds),
      profileCommandTimeoutSeconds: currentRecord?.advanced.commandTimeoutSeconds ?? 0,
      resultRowLimit: settingsForWarnings.execution.resultRowLimit || (currentRecord?.environment === 'prod' ? 100000 : 0)
    }
    const warningCategory = settingsForWarnings.execution.warningCategories[currentRecord?.environment ?? 'none']
    const categoryWarnings = settingsForWarnings.execution.showWarnings ? findDangerousStatements(sql, settingsForWarnings.execution.warningScriptLimitKb).filter(({ kind }) => warningCategory[kind]) : []
    const destructive = statements.some(({ sql: statement }) => isDestructiveStatement(statement))
    if (destructive) {
      if (currentRecord?.environment === 'prod') {
        const databaseName = currentConnection.database ?? t('conn.database.none')
        if (window.prompt(t('security.prod.confirm', [databaseName])) !== databaseName) return
      } else if (!window.confirm(categoryWarnings.length ? t('execution.warning.confirm', [categoryWarnings.map(({ kind }) => t(`execution.warning.${kind}`)).join(', ')]) : t('security.destructive.confirm'))) return
    }
    const token = crypto.randomUUID()
    const startedAt = performance.now()
    log('Execution', 'Execution started')
    setLongQueryNotice(false)
    const notificationSettings = appSettingsRef.current.notifications
    const longQueryTimer = notificationSettings.longQuerySeconds > 0 ? window.setTimeout(() => setLongQueryNotice(true), notificationSettings.longQuerySeconds * 1000) : undefined
    if (pageQueries[selectedDocument]) setPageQueries((current) => ({ ...current, [selectedDocument]: { ...current[selectedDocument], offset: 1000 } }))
    for (const result of results) if (result.resultStoreId) void window.tuxsql.disposeResult(result.resultStoreId)
    setExecutionId(token); setQueryBusy(true); setQueryMessages([]); setResults([]); setResultIndex(-1)
    setStatus('Executing…')
    const next: QueryResult[] = []
    const messages: string[] = []
    const serverWarnings: string[] = []
    const collectWarnings = async (results: QueryResult[], statementNumber: number, requestId: string): Promise<void> => {
      if (!appSettingsRef.current.execution.showWarnings || !results.some((result) => result.warningStatus > 0)) return
      try {
        const warningResults = await window.tuxsql.executeSql(currentConnection.id, 'SHOW WARNINGS', `${requestId}:warnings`, currentConnection.database, false, executionOptions)
        serverWarnings.push(...formatServerWarnings(warningResults.flatMap((result) => result.rows), statementNumber))
      } catch (warningError) {
        log('Execution', warningError instanceof Error ? `Could not read server warnings: ${warningError.message}` : 'Could not read server warnings.', 'warning')
      }
    }
    try {
      const canBatchScript = statements.length >= 100 && currentRecord?.advanced.multipleStatements && statements.every(({ sql: statement }) => !/^\s*(SELECT|WITH)\b/i.test(statement))
      if (canBatchScript) {
        const requestId = `${token}:batch`; setExecutionId(requestId)
        const batchResults = await window.tuxsql.executeSql(currentConnection.id, statements.map(({ sql: statement }) => statement).join(';\n') + ';', requestId, currentConnection.database, splitterCompatible, executionOptions)
        logSql(sql, batchResults, performance.now() - startedAt)
        next.push(...batchResults)
        await collectWarnings(batchResults, statements.length, requestId)
        const returnedRows = next.reduce((total, result) => total + (result.rowCount ?? result.rows.length), 0)
        messages.push(`OK · ${statements.length} statements · ${returnedRows} rows · ${((performance.now() - startedAt) / 1000).toFixed(3)} s`)
        setResults([...next]); setQueryMessages([...messages])
      } else {
        let ignoreAllErrors = false
        for (const [index, statement] of statements.entries()) {
          const requestId = `${token}:${index}`
          setExecutionId(requestId)
          const statementStartedAt = performance.now()
          let statementResults: QueryResult[]
          try { statementResults = await window.tuxsql.executeSql(currentConnection.id, statement.sql, requestId, currentConnection.database, splitterCompatible, executionOptions) }
          catch (statementError) {
            const code = statementError && typeof statementError === 'object' ? String((statementError as { code?: unknown }).code ?? '') : ''
            if (code === 'TUXSQL_COMMAND_TIMEOUT' || /^Query cancelled after \d+ s \(command timeout\)$/.test(statementError instanceof Error ? statementError.message : '') || code === 'ER_QUERY_INTERRUPTED' || code === '1317' || (statementError instanceof Error && statementError.name === 'AbortError')) throw statementError
            const reason = maskSecrets(displaySqlError(statementError))
            logSql(statement.sql, [], performance.now() - statementStartedAt, true)
            if (!ignoreAllErrors && settingsForWarnings.documents.stopOnFirstError) {
              const documentName = documents.find((tab) => tab.id === selectedDocument)?.label ?? 'SQL'
              const choice = await new Promise<ScriptErrorAction>((resolve) => setExecutionError({ message: t('editor.batchErrorTitle', [documentName, index + 1, reason]), resolve }))
              const decision = decideBatchError(choice)
              if (!decision.continueBatch) throw statementError
              ignoreAllErrors = decision.ignoreFutureErrors
            }
            messages.push(`ERROR · statement ${index + 1} · ${reason}`)
            setQueryMessages([...messages])
            continue
          }
          logSql(statement.sql, statementResults, performance.now() - statementStartedAt)
          log('Execution', `Query opened · statement ${index + 1}`)
          next.push(...statementResults)
          await collectWarnings(statementResults, index + 1, requestId)
          if (index % 50 === 0 || index === statements.length - 1) setResults([...next])
          const returnedRows = statementResults.reduce((total, result) => total + (result.rowCount ?? result.rows.length), 0)
          messages.push(`OK · ${returnedRows} rows · ${((performance.now() - startedAt) / 1000).toFixed(3)} s`)
          if (index % 50 === 0 || index === statements.length - 1) setQueryMessages([...messages])
        }
      }
      setResults(next); setQueryMessages(messages); setResultIndex(next.length ? 0 : -1)
      if (next.length) setPanelVisible(false)
      if (pageQueries[selectedDocument] && (next[0]?.rowCount ?? next[0]?.rows.length ?? 0) < 1000) setPageQueries((current) => { const updated = { ...current }; delete updated[selectedDocument]; return updated })
      setErrors(serverWarnings)
      setErrorDocumentId(selectedDocument)
      if (serverWarnings.length) { setPanelTab('Error List'); setPanelVisible(true) }
      if (queryProfilingMode && (Boolean(pageQueries[selectedDocument]) || settingsForWarnings.grid.pagedByDefault)) { const warning = t('profiler.pagedWarning'); setErrors((current) => [...current, warning]); setErrorDocumentId(selectedDocument); setPanelTab('Error List'); setPanelVisible(true) }
      setStatus(t('editor.query.success'))
      log('Execution', 'Done')
      setQueryElapsed(performance.now() - startedAt)
      if (queryProfilingMode && statements.length === 1 && /^\s*(SELECT|WITH)\b/i.test(statements[0]!.sql)) {
        try {
          const profile = await window.tuxsql.profile(currentConnection.id, statements[0]!.sql)
          openRegisteredPanel('profiler')
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('tuxsql:profiler-profile', { detail: profile })), 100)
        } catch (error) { log('Profiler', error instanceof Error ? error.message : 'The query plan could not be collected.', 'warning') }
      }
      await persistExecutionHistory(sql, startedAt, true, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0))
      if (currentConnection.database && /\b(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i.test(sql)) {
        try { setEditorMetadata(await window.tuxsql.getEditorMetadata(currentConnection.id, currentConnection.database, true)) }
        catch (error) { log('Editor', error instanceof Error ? error.message : t('ui.app.msg.74eea28b46'), 'warning') }
      }
      log('Execution', t('ui.app.queryCompleted', [next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0)]), 'success')
    } catch (error) {
      const code = typeof error === 'object' && error ? String((error as { code?: unknown }).code ?? '') : ''
      if (code === 'ER_QUERY_INTERRUPTED' || code === '1317' || (error instanceof Error && error.name === 'AbortError')) {
        setQueryMessages((current) => [...current, t('ui.app.msg.5b6cd91499')])
        setResultIndex(next.length ? 0 : -1)
        setStatus('Ready')
        await persistExecutionHistory(sql, startedAt, false, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0), t('ui.app.msg.5b6cd91499'))
        return
      }
      const message = displaySqlError(error)
      const detail = error && typeof error === 'object' ? error as { code?: string; errno?: number; lineNumber?: number; columnNumber?: number } : {}
      const match = /at (?:line )?(\d+)(?:,? column (\d+))?/i.exec(message)
      const line = detail.lineNumber ?? Number(match?.[1] ?? 0)
      const column = detail.columnNumber ?? Number(match?.[2] ?? 0)
      const lostConnection = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'].includes(detail.code ?? '')
      const safeMessage = maskSecrets(message)
      if (lostConnection && currentConnection && currentRecord?.advanced.autoReconnect) {
        try {
          await window.tuxsql.disconnect(currentConnection.id)
          setActive((current) => current.filter((item) => item.id !== currentConnection.id))
          await runConnectionAction(currentRecord, emptySecrets(), true, 'connect')
          log('Connections', t('ui.app.autoReconnectSucceeded'), 'warning')
        } catch { log('Connections', t('ui.app.autoReconnectFailed'), 'warning') }
      }
      const shownMessage = `${detail.code ? `${detail.code}${detail.errno ? ` ${detail.errno}` : ''}: ` : ''}${lostConnection ? t('ui.app.queryConnectionLost', [safeMessage]) : safeMessage}${line ? ` · line ${line}${column ? `, column ${column}` : ''}` : ''}`
      setErrors([shownMessage]); setErrorDocumentId(selectedDocument); setQueryMessages([...messages, shownMessage]); setResultIndex(-1); setPanelTab('Error List'); setPanelVisible(true); setStatus('Error'); logSql(sql, [], performance.now() - startedAt, true); log('Execution', shownMessage, 'error')
      await persistExecutionHistory(sql, startedAt, false, next.reduce((sum, result) => sum + (result.rowCount ?? result.rows.length), 0), shownMessage)
      if (line && editorRef.current) editorRef.current.revealLineInCenter(line)
    } finally { if (longQueryTimer !== undefined) window.clearTimeout(longQueryTimer); setQueryBusy(false); setExecutionId('') }
  }

  async function cancelSql(): Promise<void> {
    if (!currentConnection || !queryBusy || !executionId) return
    setStatus('Canceling…')
    try { await window.tuxsql.cancelQuery(currentConnection.id, executionId); setQueryMessages((current) => [...current, t('ui.app.msg.5b6cd91499')]); setStatus('Ready') }
    catch (error) { log('Execution', error instanceof Error ? error.message : t('ui.app.msg.d3fa911fe4'), 'error') }
  }

  async function toggleAutoCommit(enabled: boolean): Promise<void> {
    if (!currentConnection) return
    try {
      if (enabled) await window.tuxsql.commitTransaction(currentConnection.id)
      else await window.tuxsql.beginTransaction(currentConnection.id)
      if (enabled) { setTransactionCommitted(true); setTransactionRevision((value) => value + 1) }
      setAutoCommit(enabled)
      log('Transaction', enabled ? t('ui.app.transactionCommitted') : t('ui.app.transactionStarted'))
    } catch (error) { log('Transaction', error instanceof Error ? error.message : t('ui.app.msg.4f17cfa979'), 'error') }
  }

  async function finishTransaction(action: 'commit' | 'rollback'): Promise<void> {
    if (!currentConnection || autoCommit) return
    try {
      if (action === 'commit') await window.tuxsql.commitTransaction(currentConnection.id)
      else await window.tuxsql.rollbackTransaction(currentConnection.id)
      setTransactionCommitted(action === 'commit'); setTransactionRevision((value) => value + 1)
      setAutoCommit(true)
      log('Transaction', action === 'commit' ? t('ui.app.changesCommitted') : t('ui.app.changesRolledBack'))
    } catch (error) { log('Transaction', error instanceof Error ? error.message : t('ui.app.msg.4f17cfa979'), 'error') }
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
  reopenPanelRef.current = openRegisteredPanel
  useEffect(() => {
    const openLocalServer = (): void => reopenPanelRef.current?.('local-server')
    window.addEventListener('tuxsql:open-local-server', openLocalServer)
    return () => window.removeEventListener('tuxsql:open-local-server', openLocalServer)
  }, [])

  function openDataReport(mode: 'report' | 'pivot'): void {
    window.sessionStorage.setItem('tuxsql:data-report-pivot:open-mode', mode)
    openRegisteredPanel('data-report-pivot')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('tuxsql:data-report-pivot:open', { detail: mode })), 300)
  }
  openDataReportRef.current = openDataReport

  function openDatabaseToolTab(tab: string): void {
    openRegisteredPanel('database-tools')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('tuxsql:database-tool-tab', { detail: tab })), 120)
  }

  function sendDebuggerCommand(command: string): void {
    openRegisteredPanel('routine-debugger')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('tuxsql:shortcut-command', { detail: { command } })), 100)
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
    if (record?.advanced.readOnly && ['newDatabase', 'newTable', 'importData', 'generateData', 'truncateTable', 'duplicateObject', 'editPrivileges', 'rename', 'deleteObject'].includes(action)) {
      log('Explorer', t('explorer.readOnly'), 'warning')
      return
    }
    setSelectedExplorerContext(context)
    if (object) setSelectedExplorerObject({ connection, database: db, object })
    else setSelectedExplorerObject(undefined)
    if (context.target === 'database' && database) { try { await window.tuxsql.setDatabase(connection.id, database) } catch { /* keep the selected database context for the panel */ } }
    setSelectedExplorerIntent(action)
    const openScript = (sql: string, label: string): void => { openSqlDocument(label, sql) }
    if (action === 'defaultOpen' && object && db) {
      try {
        const { settings } = await window.tuxsql.loadSettings()
        if (object.kind === 'table' || object.kind === 'view') {
          if (settings.explorer.openTableAs === 'object-editor') openObjectEditor(connection, db, object.kind, object.name)
          else selectTop(connection, db, object, settings.explorer.selectionMode === 'all' ? undefined : settings.explorer.firstRows)
        } else if (settings.explorer.openRoutineAs === 'object-editor') openObjectEditor(connection, db, object.kind, object.name)
        else generateScript(connection, db, object)
      } catch (error) { log('Explorer', error instanceof Error ? error.message : 'Unable to apply Explorer defaults.', 'error') }
      return
    }
    if (action === 'modifyConnection' && record) { openEdit(record); return }
    if (action === 'createConnectionLike' && record) { setDialogRecord({ ...structuredClone(record), id: crypto.randomUUID(), name: `${record.name} copy`, lastUsedAt: undefined }); setNewDialog(true); return }
    if (action === 'close') { const connected = active.find((item) => item.recordId === connection.recordId); if (connected) await disconnect(connected); return }
    const createKind = /^(?:newObject\.)?create(Table|View|Procedure|Function|Trigger|Event)$/.exec(action)?.[1]?.toLowerCase() as DatabaseObjectKind | undefined
    if (createKind && db) { openObjectEditor(connection, db, createKind, `new_${createKind}`, true); return }
    if (action.startsWith('sendTo.')) {
      const destination = action.slice('sendTo.'.length)
      if (destination === 'queryBuilder') openRegisteredPanel('query-builder')
      else if (destination === 'masterDetail') openRegisteredPanel('master-detail')
      else if (destination === 'databaseDiagram') openRegisteredPanel('er-diagram')
      else if (destination === 'dataReport') openDataReport('report')
      else if (destination === 'chartDesigner' || destination === 'pivotTable') openDataReport('pivot')
      return
    }
    const script = /^(create|drop|dropAndCreate|select|insert|update|delete|crud)\.(newSqlWindow|file|clipboard)$/.exec(action)
    if (script && !object && context.target === 'database' && db) {
      const operation = script[1]!
      const statements: Record<string, string> = { create: `CREATE DATABASE ${quoteExplorerIdentifier(db)};`, drop: `DROP DATABASE IF EXISTS ${quoteExplorerIdentifier(db)};`, dropAndCreate: `DROP DATABASE IF EXISTS ${quoteExplorerIdentifier(db)};\nCREATE DATABASE ${quoteExplorerIdentifier(db)};` }
      const sql = statements[operation] ?? `-- ${operation.toUpperCase()} ${quoteExplorerIdentifier(db)}\n`
      if (script[2] === 'newSqlWindow') openScript(sql, `${operation.toUpperCase()} ${db}`)
      else if (script[2] === 'clipboard') { try { await navigator.clipboard.writeText(sql) } catch { log('Explorer', 'Could not copy SQL to the clipboard.', 'warning') } }
      else { try { await window.tuxsql.saveSqlFile(undefined, sql) } catch (error) { log('Explorer', error instanceof Error ? error.message : 'Could not save SQL file.', 'error') } }
      return
    }
    if (script && object && db) {
      const operation = script[1] as ScriptKind
      let createSql = ''
      if (operation === 'create' || operation === 'dropAndCreate') {
        try { createSql = await window.tuxsql.showCreateObject(connection.id, db, object) }
        catch (error) { log('Explorer', error instanceof Error ? error.message : 'Unable to load object definition.', 'error'); return }
      }
      const sql = buildExplorerSql(operation, object.kind, db, object.name, createSql)
      const destination = script[2]
      if (destination === 'newSqlWindow') openScript(sql, `${operation.toUpperCase()} ${object.name}`)
      else if (destination === 'clipboard') { try { await navigator.clipboard.writeText(sql) } catch { log('Explorer', 'Could not copy SQL to the clipboard.', 'warning') } }
      else {
        try { await window.tuxsql.saveSqlFile(undefined, sql) }
        catch (error) { log('Explorer', error instanceof Error ? error.message : 'Could not save SQL file.', 'error') }
      }
      return
    }
    if (action === 'newTable' && db) { openObjectEditor(connection, db, 'table', 'new_table', true); return }
    if (action === 'newDatabase') { openDatabaseEditor(connection.recordId); return }
    if (action === 'newConnection') { openNewConnection(); return }
    if (action === 'openEditor' && object && db) { openObjectEditor(connection, db, object.kind, object.name); return }
    if (action === 'openEditor' && context.target === 'database' && db) { openScript(`USE ${quoteExplorerIdentifier(db)};\n`, `${db} · SQL`); return }
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
    if (action === 'backup' && db) { try { await window.tuxsql.backupDatabase(connection.id, db, true) } catch (error) { log('Explorer', error instanceof Error ? error.message : 'Backup failed.', 'error') }; return }
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
    const activeErrors = !activeDocumentOnly || errorDocumentId === selectedDocument ? errors : []
    const activeFindings = !activeDocumentOnly || analysisDocumentId === selectedDocument ? analysisFindings : []
    const errorCount = activeErrors.filter((item) => !item.startsWith('Warning ·')).length + activeFindings.filter((item) => item.severity === 'Error').length
    const warningCount = activeErrors.filter((item) => item.startsWith('Warning ·')).length + activeFindings.filter((item) => item.severity === 'Warning').length
    const messageCount = queryMessages.filter((item) => item.startsWith('OK ·')).length
    const filteredErrors = activeErrors.filter((item) => errorSeverity === 'all' || (errorSeverity === 'Warning' ? item.startsWith('Warning ·') : errorSeverity === 'Error' ? !item.startsWith('Warning ·') : false))
    const filteredFindings = activeFindings.filter((item) => errorSeverity === 'all' || item.severity === errorSeverity)
    const filteredMessages = errorSeverity === 'all' || errorSeverity === 'Message' ? queryMessages.filter((item) => item.startsWith('OK ·')) : []
    return <div className="error-list"><div className="error-list-toolbar"><button type="button" aria-pressed={errorSeverity === 'Error'} onClick={() => setErrorSeverity(errorSeverity === 'Error' ? 'all' : 'Error')}>{t('app.errors.errors')} <strong>{errorCount}</strong></button><button type="button" aria-pressed={errorSeverity === 'Warning'} onClick={() => setErrorSeverity(errorSeverity === 'Warning' ? 'all' : 'Warning')}>{t('app.errors.warnings')} <strong>{warningCount}</strong></button><button type="button" aria-pressed={errorSeverity === 'Message'} onClick={() => setErrorSeverity(errorSeverity === 'Message' ? 'all' : 'Message')}>{t('app.errors.messages')} <strong>{messageCount}</strong></button><label><input type="checkbox" checked={activeDocumentOnly} onChange={(event) => setActiveDocumentOnly(event.target.checked)} />{t('app.errors.activeDocument')}</label><span>{filteredErrors.length + filteredFindings.length + filteredMessages.length} {t('app.errors.items')}</span></div>{!filteredErrors.length && !filteredFindings.length && !filteredMessages.length ? <p>{t('app.errors.empty')}</p> : <table><thead><tr><th>{t('app.errors.severity')}</th><th># / {t('app.errors.rule')}</th><th>{t('app.errors.description')}</th><th>{t('app.errors.document')}</th><th>{t('app.errors.line')}</th><th>{t('app.errors.column')}</th></tr></thead><tbody>
      {filteredErrors.map((error, index) => <tr key={`error-${index}`}><td className={error.startsWith('Warning ·') ? 'field-warning' : 'field-error'}>{error.startsWith('Warning ·') ? t('app.errors.warnings') : t('app.errors.errors')}</td><td>{index + 1}</td><td>{error.replace(/^Warning · /, '')}</td><td>{documents.find((tab) => tab.id === (errorDocumentId || selectedDocument))?.label}</td><td>—</td><td>—</td></tr>)}
      {filteredFindings.map((finding) => <tr key={`${finding.ruleId}:${finding.line}:${finding.column}`} onClick={() => { editorRef.current?.setPosition({ lineNumber: finding.line, column: finding.column }); editorRef.current?.focus() }} style={{ cursor: 'pointer' }}><td className={`analysis-${finding.severity.toLowerCase()}`}>{finding.severity}</td><td>{finding.ruleId}</td><td>{t(`analysis.rule.${finding.ruleId}`)}</td><td>{documents.find((tab) => tab.id === (analysisDocumentId || selectedDocument))?.label}</td><td>{finding.line}</td><td>{finding.column}</td></tr>)}
      {filteredMessages.map((message, index) => <tr key={`message-${index}`}><td>{t('app.errors.messages')}</td><td>{index + 1}</td><td>{message}</td><td>{documents.find((tab) => tab.id === selectedDocument)?.label}</td><td>—</td><td>—</td></tr>)}
    </tbody></table>}</div>
  }

  function closeTab(id: string): void {
    if (id === 'start') return
    const tab = documents.find((item) => item.id === id)
    if (tab?.modified && !window.confirm(t('ui.app.discardTabChanges', [tab.label]))) return
    const next = documents.filter((item) => item.id !== id)
    setDocuments(next)
    if (selectedDocument === id) setSelectedDocument(next.at(-1)?.id ?? 'start')
  }

  function closeManyTabs(ids: string[]): void {
    const closing = documents.filter((tab) => ids.includes(tab.id) && tab.id !== 'start')
    const modified = closing.filter((tab) => tab.modified)
    if (modified.length && !window.confirm(`Close ${closing.length} documents and discard changes in ${modified.map((tab) => tab.label).join(', ')}?`)) return
    const closingIds = new Set(closing.map((tab) => tab.id))
    const next = documents.filter((tab) => !closingIds.has(tab.id))
    setDocuments(next)
    setPinnedTabs((current) => current.filter((id) => !closingIds.has(id)))
    if (closingIds.has(selectedDocument)) setSelectedDocument(next.at(-1)?.id ?? 'start')
  }

  function dropDocumentTab(documentId: string, targetDocumentId: string, direction: DockDirection | 'center'): void {
    if (documentId === targetDocumentId) return
    if (direction === 'center') {
      setDocumentLayout((current) => mergeDocumentIntoGroup(current, documentId, targetDocumentId))
      setSplitDocument(undefined)
      setSelectedDocument(documentId)
      return
    }
    setDocumentLayout((current) => splitDocumentGroup(current, targetDocumentId, documentId, direction, `group-${Date.now()}`))
    const orientation = direction === 'left' || direction === 'right' ? 'vertical' : 'horizontal'
    setTabGroups((current) => ({ ...current, [documentId]: orientation, [targetDocumentId]: orientation }))
    setSplitDocument(documentId)
    setSplitOrientation(orientation)
    setSelectedDocument(targetDocumentId)
  }

  async function handleTabContextAction(action: string, tab: DocumentTab): Promise<void> {
    if (action === 'close') { closeTab(tab.id); return }
    if (action === 'closeAllButThis') { closeManyTabs(documents.filter((item) => item.id !== tab.id).map((item) => item.id)); return }
    if (action === 'closeAllUnmodified') { closeManyTabs(documents.filter((item) => item.id !== 'start' && !item.modified).map((item) => item.id)); return }
    if (action === 'closeAllButPinned') { closeManyTabs(documents.filter((item) => item.id !== 'start' && !pinnedTabs.includes(item.id)).map((item) => item.id)); return }
    if (action === 'pinTab') { setPinnedTabs((current) => current.includes(tab.id) ? current.filter((id) => id !== tab.id) : [...current, tab.id]); return }
    if (action === 'copyFullPath' && tab.filePath) { await navigator.clipboard.writeText(tab.filePath); return }
    if (action === 'openContainingFolder' && tab.filePath) { await window.tuxsql.openContainingFolder(tab.filePath); return }
    if (action === 'newHorizontalTabGroup' || action === 'newVerticalTabGroup') {
      const orientation = action === 'newHorizontalTabGroup' ? 'horizontal' : 'vertical'
      const direction = orientation === 'horizontal' ? 'bottom' : 'right'
      const targetId = selectedDocument !== tab.id ? selectedDocument : documents.find((item) => item.id !== tab.id && item.id !== 'start')?.id
      if (!targetId) return
      dropDocumentTab(tab.id, targetId, direction)
      setTabGroups((current) => ({ ...current, [tab.id]: orientation, [targetId]: orientation }))
      return
    }
    if (action === 'floatTab') {
      if (tab.panelId) { await window.tuxsql.floatDocumentPanel(tab.panelId, tab.label); return }
      const contents = sqlByDocument[tab.id]
      if (typeof contents === 'string') { await window.tuxsql.floatSqlDocument(tab.id, tab.label, contents); return }
      log('Documents', 'This document type cannot be opened in a separate window yet.', 'warning')
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (editorContextMenu && event.key === 'Escape') { event.preventDefault(); setEditorContextMenu(null); return }
      if (event.defaultPrevented) return
      const ctrl = event.ctrlKey || event.metaKey
      const pressed = [ctrl ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key) ? '' : event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+')
      const combined = shortcutChordRef.current ? `${shortcutChordRef.current} ${pressed}` : pressed
      const targetIsInput = event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)
      const hasChordContinuation = !targetIsInput && appSettings.shortcuts.bindings.some((binding) => binding.shortcut && normalizeShortcut(binding.shortcut).startsWith(`${normalizeShortcut(combined)} `))
      if (hasChordContinuation) { shortcutChordRef.current = combined; event.preventDefault(); return }
      if (targetIsInput) shortcutChordRef.current = ''
      const customBinding = appSettings.shortcuts.bindings.find((binding) => binding.shortcut && normalizeShortcut(binding.shortcut) === normalizeShortcut(combined) && (binding.context === 'Global' || (binding.context === 'Editor' && activeSql && !targetIsInput) || (binding.context === 'Debugger' && openPanel === 'routine-debugger')))
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
        else if (customBinding.command === 'Show Project Explorer') setProjectExplorerVisible((value) => !value)
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
        else if (customBinding.command === 'Show Command Palette') window.dispatchEvent(new CustomEvent('tuxsql:shortcut-command', { detail: { command: customBinding.command } }))
        else if (customBinding.command === 'Show Help') void window.tuxsql.openAboutLink('documentation')
        else if (editorCommands.has(customBinding.command)) runEditorCommand(customBinding.command)
        else { runEditorCommand(customBinding.command); window.dispatchEvent(new CustomEvent('tuxsql:shortcut-command', { detail: { command: customBinding.command } })) }
        return
      }
      if (event.key === 'F2' && selectedExplorerObject?.object.kind === 'table' && !activeSql && !targetIsInput) { event.preventDefault(); const { connection, database, object } = selectedExplorerObject; const next = window.prompt(t('explorer.rename.prompt', [object.name]), object.name)?.trim(); if (next && next !== object.name) void renameTable(connection, database, object, next) }
      else if (event.key === 'F5' && selectedExplorerObject && !activeSql && !targetIsInput) { event.preventDefault(); void loadObjects(selectedExplorerObject.connection, selectedExplorerObject.database) }
      else if (event.key === 'Delete' && selectedExplorerObject && !activeSql && !targetIsInput) { event.preventDefault(); const { connection, database, object } = selectedExplorerObject; if (window.confirm(t('explorer.delete.prompt', [object.kind, object.name]))) void dropObject(connection, database, object) }
      else if (event.key === 'F4' && selectedExplorerObject) { event.preventDefault(); showObjectProperties(selectedExplorerObject.connection, selectedExplorerObject.database, selectedExplorerObject.object) }
      else if (ctrl && event.key.toLowerCase() === 'f' && activeSql) { event.preventDefault(); openFind(false, false) }
      else if (ctrl && event.key.toLowerCase() === 'h' && activeSql) { event.preventDefault(); openFind(true, false) }
      else if (ctrl && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); openFind(false, true) }
      else if (ctrl && event.altKey && event.key.toLowerCase() === 'u') { event.preventDefault(); openRegisteredPanel('document-outline') }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const activeTitle = useMemo(() => currentConnection?.name ?? t('app.connection.none'), [currentConnection, t])
  const shortcutFor = (command: string): string | undefined => appSettings.shortcuts.bindings.find((binding) => binding.command === command)?.shortcut || undefined
  const editorLabel = (command: string): string => t(`editor.command.${command.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)

  useEffect(() => {
    if (!editorContextMenu) return
    const onPointerDown = (event: PointerEvent): void => { if (!(event.target instanceof Element) || !event.target.closest('.sql-editor-context')) setEditorContextMenu(null) }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [editorContextMenu])

  useEffect(() => {
    const onEditorContextMenu = (event: MouseEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('.monaco-editor')) return
      event.preventDefault(); event.stopImmediatePropagation()
      setEditorContextMenu({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('contextmenu', onEditorContextMenu, true)
    return () => window.removeEventListener('contextmenu', onEditorContextMenu, true)
  }, [])

  useEffect(() => () => completionProviderRef.current?.dispose(), [])

  // Menu bar behaviour: one open menu at a time, closes on outside click / Escape / choosing an item,
  // and moves between menus on hover while one is open (the <details> elements do none of this on their own).
  useEffect(() => {
    const nav = menuRowRef.current
    if (!nav) return
    const menus = (): HTMLDetailsElement[] => Array.from(nav.querySelectorAll<HTMLDetailsElement>(':scope > details'))
    const closeAll = (except?: HTMLDetailsElement): void => { for (const menu of menus()) if (menu !== except && menu.open) menu.open = false }
    const onToggle = (event: Event): void => {
      if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return
      let root = event.target
      while (root.parentElement && root.parentElement !== nav) {
        const parent = root.parentElement.closest('details')
        if (!parent || parent === root) break
        root = parent
      }
      closeAll(root)
    }
    const onPointerDown = (event: PointerEvent): void => { if (!(event.target instanceof Node) || !nav.contains(event.target)) closeAll() }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') closeAll() }
    const onClick = (event: MouseEvent): void => { if (event.target instanceof Element && event.target.closest('.menu-popup button')) closeAll() }
    const onHover = (event: MouseEvent): void => {
      const menu = event.target instanceof Element ? event.target.closest('summary')?.parentElement : null
      if (menu instanceof HTMLDetailsElement && !menu.open && menus().some((entry) => entry.open)) menu.open = true
    }
    nav.addEventListener('toggle', onToggle, true)
    nav.addEventListener('click', onClick)
    nav.addEventListener('mouseover', onHover)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      nav.removeEventListener('toggle', onToggle, true)
      nav.removeEventListener('click', onClick)
      nav.removeEventListener('mouseover', onHover)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (floatedDocument) return <FloatSqlDocument documentId={floatedDocument} title={floatParams?.get('title') ?? 'SQL document'} initialContents={floatParams?.get('contents') ?? ''} />
  if (floatedPanelId) {
    const entry = panelRegistry.find((item) => item.id === floatedPanelId)
    if (!entry) return <main className="float-panel-document">Panel unavailable.</main>
    const Panel = entry.component
    return <main className="float-panel-document"><Suspense fallback={<div role="status">Loading panel…</div>}>{panelContents(Panel)}</Suspense></main>
  }
  return <main className="app-shell" aria-label="TuxSQL">
    <header className="app-menubar">
      <strong className="brand">TuxSQL</strong>
      <nav className="menu-row" aria-label="Menu principal" ref={menuRowRef}>
        <details><summary>{t('menu.file')}</summary><div className="menu-popup"><MenuAction label={t('menu.newSql')} shortcut={shortcutFor('New SQL Document')} onClick={newSql} /><MenuAction label={t('menu.openFile')} shortcut={shortcutFor('Open SQL File')} onClick={() => void openSqlFile()} /><MenuAction label={t('menu.close')} shortcut={shortcutFor('Close Tab')} onClick={() => closeTab(selectedDocument)} disabled={!activeSql} /><MenuAction label={t('menu.openProject')} shortcut="Ctrl+Shift+O" onClick={() => { setProjectExplorerVisible(true); window.dispatchEvent(new CustomEvent('tuxsql:source-control:open-project')) }} /><MenuAction label={t('sc.project.close')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:source-control:close-project'))} /><MenuAction label={t('sc.project.recent')} onClick={() => { setProjectExplorerVisible(true); window.dispatchEvent(new CustomEvent('tuxsql:source-control:recent-projects')) }} /><MenuAction label={t('menu.save')} shortcut={shortcutFor('Save SQL')} onClick={() => void saveCurrentSql()} disabled={!activeSql} /><MenuAction label={t('menu.saveAs')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.saveAll')} shortcut={shortcutFor('Save All')} onClick={() => void saveAllSql()} /><MenuAction label={t('menu.print')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.recentFiles')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.exit')} shortcut={shortcutFor('Exit')} onClick={() => window.close()} /></div></details>
        <details><summary>{t('menu.edit')}</summary><div className="menu-popup"><MenuAction label={t('menu.undo')} shortcut="Ctrl+Z" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.redo')} shortcut="Ctrl+Y" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.cut')} shortcut="Ctrl+X" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.copy')} shortcut="Ctrl+C" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.paste')} shortcut="Ctrl+V" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.duplicate')} shortcut="Ctrl+D" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.delete')} shortcut="Delete" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.selectAll')} shortcut="Ctrl+A" disabled={!activeSql} title={!activeSql ? t('menu.notAvailable') : undefined} /><MenuAction label={t('menu.goTo')} shortcut={shortcutFor('Go To Line')} onClick={() => editorRef.current?.trigger('keyboard', 'editor.action.gotoLine', null)} disabled={!activeSql} /><MenuAction label={t('menu.findReplace')} shortcut="Ctrl+H" onClick={() => openFind(true)} disabled={!activeSql} /><MenuAction label={t('nav.findInFiles')} shortcut="Ctrl+Shift+F" onClick={() => openFind(false, true)} /><details className="menu-nested"><summary>{t('menu.advanced')}</summary><div className="menu-submenu">
<MenuAction label={editorLabel('Rename')} shortcut="F2" onClick={() => runEditorCommand('Rename')} disabled={!activeSql} />
<MenuAction label={editorLabel('Format Document')} shortcut="Ctrl+K, D" onClick={() => runEditorCommand('Format Document')} disabled={!activeSql} /><MenuAction label={editorLabel('Format Selection')} shortcut="Ctrl+K, F" onClick={() => runEditorCommand('Format Selection')} disabled={!activeSql} /><MenuAction label={editorLabel('Format Current Statement')} shortcut="Ctrl+K, S" onClick={() => runEditorCommand('Format Current Statement')} disabled={!activeSql} />
<MenuAction label={editorLabel('Select Current Statement')} shortcut="Ctrl+Shift+A" onClick={() => runEditorCommand('Select Current Statement')} disabled={!activeSql} /><MenuAction label={editorLabel('Add Backticks to All Identifiers')} shortcut="Ctrl+K, Ctrl+[" onClick={() => runEditorCommand('Add Backticks to All Identifiers')} disabled={!activeSql} /><MenuAction label={editorLabel('Remove Unnecessary Backticks')} shortcut="Ctrl+K, Ctrl+]" onClick={() => runEditorCommand('Remove Unnecessary Backticks')} disabled={!activeSql} /><MenuAction label={editorLabel('Qualify Object Names')} shortcut="Ctrl+K, Ctrl+Q" onClick={() => runEditorCommand('Qualify object names')} disabled={!activeSql} /><MenuAction label={editorLabel('Expand Wildcards')} shortcut="Ctrl+K, Ctrl+Y" onClick={() => runEditorCommand('Expand wildcards')} disabled={!activeSql} />
<MenuAction label={editorLabel('Make Uppercase')} shortcut="Ctrl+Shift+U" onClick={() => runEditorCommand('Make Uppercase')} disabled={!activeSql} /><MenuAction label={editorLabel('Make Lowercase')} shortcut="Ctrl+U" onClick={() => runEditorCommand('Make Lowercase')} disabled={!activeSql} /><MenuAction label={editorLabel('View White Space')} shortcut="Ctrl+K, E" onClick={() => runEditorCommand('View White Space')} disabled={!activeSql} /><MenuAction label={editorLabel('Word Wrap')} shortcut="Ctrl+K, O" onClick={() => runEditorCommand('Word Wrap')} disabled={!activeSql} /><MenuAction label={editorLabel('Show Line Numbers')} onClick={() => runEditorCommand('Show Line Numbers')} disabled={!activeSql} /><MenuAction label={editorLabel('Toggle Block Comment')} shortcut="Ctrl+/" onClick={() => runEditorCommand('Toggle Block Comment')} disabled={!activeSql} /><MenuAction label={editorLabel('Comment Selection')} shortcut="Ctrl+K, C" onClick={() => runEditorCommand('Comment Selection')} disabled={!activeSql} /><MenuAction label={editorLabel('Uncomment Selection')} shortcut="Ctrl+K, U" onClick={() => runEditorCommand('Uncomment Selection')} disabled={!activeSql} /><MenuAction label={editorLabel('Incremental Search')} shortcut="Ctrl+I" onClick={() => runEditorCommand('Incremental Search')} disabled={!activeSql} /><MenuAction label={editorLabel('Increase Line Indent')} onClick={() => runEditorCommand('Increase Line Indent')} disabled={!activeSql} /><MenuAction label={editorLabel('Decrease Line Indent')} onClick={() => runEditorCommand('Decrease Line Indent')} disabled={!activeSql} /><MenuAction label={editorLabel('Move Selected Lines Up')} shortcut="Alt+↑" onClick={() => runEditorCommand('Move Selected Lines Up')} disabled={!activeSql} /><MenuAction label={editorLabel('Move Selected Lines Down')} shortcut="Alt+↓" onClick={() => runEditorCommand('Move Selected Lines Down')} disabled={!activeSql} /><MenuAction label={editorLabel('Remove Line')} onClick={() => runEditorCommand('Remove Line')} disabled={!activeSql} /><MenuAction label={editorLabel('Join Lines')} shortcut="Shift+Alt+L, Shift+Alt+J" onClick={() => runEditorCommand('Join Lines')} disabled={!activeSql} /></div></details><details className="menu-nested"><summary>{t('menu.bookmarks')}</summary><div className="menu-submenu"><MenuAction label={editorLabel('Toggle Bookmark')} shortcut="Ctrl+B, T" onClick={() => runEditorCommand('Toggle Bookmark')} disabled={!activeSql} /><MenuAction label={editorLabel('Previous Bookmark')} shortcut="Ctrl+B, P" onClick={() => runEditorCommand('Previous Bookmark')} disabled={!activeSql} /><MenuAction label={editorLabel('Next Bookmark')} shortcut="Ctrl+B, N" onClick={() => runEditorCommand('Next Bookmark')} disabled={!activeSql} /><MenuAction label={editorLabel('Clear Bookmarks')} shortcut="Ctrl+B, C" onClick={() => runEditorCommand('Clear Bookmarks')} disabled={!activeSql} /></div></details><details className="menu-nested"><summary>{t('menu.outlining')}</summary><div className="menu-submenu"><MenuAction label={editorLabel('Toggle Outline Expansion')} shortcut="Ctrl+M, M" onClick={() => runEditorCommand('Toggle Outline Expansion')} disabled={!activeSql} /><MenuAction label={editorLabel('Toggle All Outlining')} shortcut="Ctrl+M, L" onClick={() => runEditorCommand('Toggle All Outlining')} disabled={!activeSql} /><MenuAction label={editorLabel('Stop Outlining')} shortcut="Ctrl+M, P" onClick={() => runEditorCommand('Stop Outlining')} disabled={!activeSql} /><MenuAction label={editorLabel('Start Automatic Outlining')} shortcut="Ctrl+M, S" onClick={() => runEditorCommand('Start Automatic Outlining')} disabled={!activeSql} /></div></details><details className="menu-nested"><summary>{t('menu.codeCompletion')}</summary><div className="menu-submenu"><MenuAction label={editorLabel('List Members')} shortcut="Ctrl+K, L" onClick={() => runEditorCommand('List Members')} disabled={!activeSql} /><MenuAction label={editorLabel('Parameter Info')} shortcut="Ctrl+K, P" onClick={() => runEditorCommand('Parameter Info')} disabled={!activeSql} /><MenuAction label={editorLabel('Quick Info')} shortcut="Ctrl+K, I" onClick={() => runEditorCommand('Quick Info')} disabled={!activeSql} /><MenuAction label={editorLabel('Complete Word')} shortcut="Ctrl+K, W" onClick={() => runEditorCommand('Complete Word')} disabled={!activeSql} /><MenuAction label={editorLabel('Insert Snippet')} shortcut="Ctrl+K, X" onClick={() => runEditorCommand('Insert Snippet')} disabled={!activeSql} /><MenuAction label={editorLabel('Refresh Suggestions')} shortcut="Ctrl+Shift+R" onClick={() => runEditorCommand('Refresh Suggestions')} disabled={!activeSql} /><MenuAction label={editorLabel('Disable Code Completion')} onClick={() => runEditorCommand('Disable Code Completion')} disabled={!activeSql} /></div></details></div></details>
        <details><summary>{t('menu.view')}</summary><div className="menu-popup"><MenuAction label={t('menu.startPage')} shortcut="Ctrl+W, S" onClick={() => setSelectedDocument('start')} /><MenuAction label={t('menu.databaseExplorer')} shortcut={shortcutFor('Show Database Explorer')} onClick={() => setExplorerVisible((value) => !value)} /><MenuAction label={t('menu.projectExplorer')} shortcut="Ctrl+W, J" onClick={() => setProjectExplorerVisible((value) => !value)} /><MenuAction label={t('sc.panel.title')} onClick={() => openRegisteredPanel('source-control')} /><MenuAction label={t('tasks.title')} onClick={() => openRegisteredPanel('tasks')} /><MenuAction label={t('nav.objectViewer')} onClick={() => openRegisteredPanel('object-viewer')} /><MenuAction label={t('menu.aiAssistant')} shortcut="Ctrl+\\, C" onClick={() => setOpenPanel('ai-assistant')} /><MenuAction label={t('nav.schemaView')} shortcut="Ctrl+W, C" onClick={() => openRegisteredPanel('schema-view')} /><MenuAction label={t('menu.dataViewer')} shortcut="Ctrl+W, R" onClick={() => openRegisteredPanel('object-viewer')} /><MenuAction label={t('nav.documentOutline')} shortcut="Ctrl+W, U" onClick={() => openRegisteredPanel('document-outline')} disabled={!activeSql} /><MenuAction label={t('menu.snippets')} shortcut="Ctrl+W, T" onClick={() => openRegisteredPanel('snippets-manager')} /><MenuAction label={t('nav.output')} shortcut="Ctrl+W, O" onClick={() => { setPanelVisible(true); setPanelTab('Output') }} /><MenuAction label={t('nav.errorList')} shortcut="Ctrl+W, E" onClick={() => { setPanelVisible(true); setPanelTab('Error List') }} /><MenuAction label={t('nav.propertiesF4')} shortcut="Ctrl+W, P" onClick={() => selectedExplorerObject && showObjectProperties(selectedExplorerObject.connection, selectedExplorerObject.database, selectedExplorerObject.object)} disabled={!selectedExplorerObject} /><MenuAction label={t('menu.queryBuilder')} onClick={() => openRegisteredPanel('query-builder')} /><MenuAction label={t('menu.profiler')} onClick={() => openRegisteredPanel('profiler')} /><MenuAction label={t('menu.pivot')} onClick={() => openRegisteredPanel('data-report-pivot')} /><div className="menu-divider" /><MenuAction label={t('menu.themeAuto')} checked={themeMode === 'auto'} onClick={() => setThemeMode('auto')} /><MenuAction label={t('menu.themeLight')} checked={themeMode === 'light'} onClick={() => setThemeMode('light')} /><MenuAction label={t('menu.themeDark')} checked={themeMode === 'dark'} onClick={() => setThemeMode('dark')} /></div></details>
        {results.length > 0 && <details><summary>{t('menu.dataContext')}</summary><div className="menu-popup"><MenuAction label={t('menu.data.showResults')} onClick={() => { setPanelVisible(true); setPanelTab('Output') }} /><MenuAction label={t('menu.data.export')} onClick={() => openRegisteredPanel('import-export')} /><MenuAction label={t('menu.data.compare')} onClick={() => openRegisteredPanel('data-compare')} /></div></details>}
        {activePanelTab === 'query-builder' && <><details><summary>{t('menu.queryContext')}</summary><div className="menu-popup"><MenuAction label={t('menu.query.execute')} shortcut="F5" onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:query-builder:action', { detail: 'execute' }))} /><MenuAction label={t('menu.query.text')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:query-builder:action', { detail: 'text' }))} /><MenuAction label={t('menu.query.data')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:query-builder:action', { detail: 'data' }))} /></div></details><details><summary>{t('menu.layoutContext')}</summary><div className="menu-popup"><MenuAction label={t('menu.query.diagram')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:query-builder:action', { detail: 'diagram' }))} /><MenuAction label={t('menu.layout.reset')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:query-builder:action', { detail: 'reset-layout' }))} /></div></details></>}
        {projectExplorerVisible && <details><summary>{t('menu.projectContext')}</summary><div className="menu-popup"><MenuAction label={t('menu.project.open')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:source-control:open-project'))} /><MenuAction label={t('menu.project.recent')} onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:source-control:recent-projects'))} /></div></details>}
        <details><summary>{t('menu.database')}</summary><div className="menu-popup"><MenuAction label={t('menu.newConnection')} onClick={openNewConnection} /><MenuAction label={t('menu.newObject')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.newDatabase')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('sc.link.cmd')} onClick={() => { setProjectExplorerVisible(true); window.dispatchEvent(new CustomEvent('tuxsql:source-control:link')) }} /><details className="menu-nested"><summary>{t('menu.tasks')}</summary><div className="menu-submenu"><MenuAction label={t('menu.taskExport')} onClick={() => openRegisteredPanel('import-export')} /><MenuAction label={t('menu.taskImport')} onClick={() => openRegisteredPanel('import-export')} /><MenuAction label={t('menu.backupRestore')} onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.copyDatabases')} onClick={() => openRegisteredPanel('copy-databases')} /><MenuAction label={t('menu.taskDataGeneration')} onClick={() => openRegisteredPanel('data-generator')} /><MenuAction label={t('documenter.title')} onClick={() => openRegisteredPanel('documenter')} /><MenuAction label={t('menu.taskCreateScriptsFolder')} onClick={() => { setProjectExplorerVisible(true); window.dispatchEvent(new CustomEvent('tuxsql:source-control:create-scripts')) }} /><MenuAction label={t('menu.invalidObjects')} shortcut="Ctrl+Alt+F" onClick={() => { openRegisteredPanel('database-tools'); window.dispatchEvent(new CustomEvent('tuxsql:database-tool-tab', { detail: 'Find Invalid Objects...' })) }} /></div></details><MenuAction label={t('menu.backupRestore')} onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.diagram')} onClick={() => openRegisteredPanel('er-diagram')} /><MenuAction label={t('menu.masterDetail')} onClick={() => openRegisteredPanel('master-detail')} /><MenuAction label={t('menu.reportDesigner')} onClick={() => openDataReport('report')} /><MenuAction label={t('menu.pivot')} onClick={() => openDataReport('pivot')} /><MenuAction label={t('menu.security')} shortcut="Ctrl+D, Q" onClick={() => openRegisteredPanel('security')} /><MenuAction label={t('menu.sessions')} shortcut="Ctrl+D, S" onClick={() => openRegisteredPanel('sessions')} /><MenuAction label={t('menu.serverVariables')} shortcut="Ctrl+D, V" onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.serviceControl')} shortcut="Ctrl+D, R" onClick={() => openRegisteredPanel('service-control')} /><MenuAction label={t('menu.findObject')} shortcut="Ctrl+D, F" onClick={() => openRegisteredPanel('database-tools')} /><MenuAction label={t('menu.largeScript')} onClick={() => openDatabaseToolTab('Large Script')} /><MenuAction label={t('menu.maintenance')} onClick={() => openDatabaseToolTab('Table Maintenance')} /><MenuAction label={t('menu.flush')} onClick={() => { if (currentConnection && window.confirm(t('menu.flushConfirm'))) void handleExplorerContextAction('flush', { connection: currentConnection, database: currentConnection.database, target: 'database' }) }} disabled={!currentConnection} /></div></details>
        <details><summary>{t('menu.comparison')}</summary><div className="menu-popup"><MenuAction label={t('menu.newSchemaCompare')} onClick={() => openRegisteredPanel('schema-compare')} /><MenuAction label={t('menu.newDataCompare')} onClick={() => openRegisteredPanel('data-compare')} /><MenuAction label={t('menu.editComparison')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'edit'}))} /><MenuAction label={t('panel.schema.compare.xObjectsFilter')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'filter'}))} /><MenuAction label={t('menu.refresh')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'refresh'}))} /><MenuAction label={t('menu.stop')} onClick={() => void cancelSql()} disabled={!queryBusy} /><MenuAction label={t('panel.schema.compare.xViewScript')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'script'}))} /><MenuAction label={t('panel.schema.compare.xReport')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'report'}))} /><MenuAction label={t('menu.synchronize')} onClick={() => window.dispatchEvent(new CustomEvent('schema-compare:action',{detail:'sync'}))} /></div></details>
        <details><summary>{t('menu.debug')}</summary><div className="menu-popup"><MenuAction label={t('menu.debugStart')} shortcut="Ctrl+F5" onClick={() => sendDebuggerCommand('Run Debugging (Ctrl+F5)')} /><MenuAction label={t('menu.debugContinue')} shortcut="Ctrl+F5" onClick={() => sendDebuggerCommand('Continue Debugging')} /><MenuAction label={t('menu.debugBreakAll')} shortcut="Ctrl+Alt+Pause" onClick={() => sendDebuggerCommand('Break All')} /><MenuAction label={t('menu.debugStop')} shortcut="Shift+F5" onClick={() => sendDebuggerCommand('Stop Debugging')} /><MenuAction label={t('menu.debugRestart')} shortcut="Ctrl+Shift+F5" onClick={() => sendDebuggerCommand('Restart Debugging')} /><MenuAction label={t('menu.debugStepInto')} shortcut="F11" onClick={() => sendDebuggerCommand('Step Into')} /><MenuAction label={t('menu.debugStepOver')} shortcut="F10" onClick={() => sendDebuggerCommand('Step Over')} /><MenuAction label={t('menu.debugStepOut')} shortcut="Shift+F11" onClick={() => sendDebuggerCommand('Step Out')} /></div></details>
        {activeSql && <details><summary>{t('menu.sql')}</summary><div className="menu-popup"><MenuAction label={t('menu.beginTransaction')} onClick={() => void toggleAutoCommit(false)} disabled={!currentConnection || !autoCommit} /><MenuAction label={t('menu.rollback')} onClick={() => void finishTransaction('rollback')} disabled={!currentConnection || transactionCommitted} /><MenuAction label={t('menu.commit')} onClick={() => void finishTransaction('commit')} disabled={!currentConnection || transactionCommitted} /><MenuAction label={t('menu.execute')} shortcut="F5" onClick={() => void runSql()} disabled={!currentConnection || queryBusy} /><MenuAction label={t('menu.executeCurrent')} shortcut="F8" onClick={() => void runSql('current')} disabled={!currentConnection || queryBusy} /><MenuAction label={t('menu.stopExecution')} shortcut={shortcutFor('Stop Execution (Alt+Pause)')} onClick={() => void cancelSql()} disabled={!queryBusy} /><MenuAction label={t('menu.editParameters')} shortcut="Ctrl+Shift+P" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.resultsText')} shortcut="Ctrl+T" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.resultsGrid')} shortcut="Ctrl+Shift+D" disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.estimatedPlan')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.profiling')} checked={queryProfilingMode} onClick={() => setQueryProfilingMode((value) => !value)} /><MenuAction label={t('menu.sendReport')} disabled title={t('menu.notAvailable')} /></div></details>}
        <details><summary>{t('menu.tools')}</summary><div className="menu-popup"><MenuAction label={t('menu.formatter')} onClick={() => openDatabaseToolTab('SQL Formatter')} /><MenuAction label={t('menu.snippetsManager')} onClick={() => openRegisteredPanel('snippets-manager')} /><MenuAction label={t('sc.project.createScripts')} onClick={() => { setProjectExplorerVisible(true); window.dispatchEvent(new CustomEvent('tuxsql:source-control:create-scripts')) }} /><MenuAction label={t('menu.importExport')} disabled title={t('menu.notAvailable')} /><MenuAction label={t('menu.skinBlue')} checked={themeMode === 'blue'} onClick={() => setThemeMode('blue')} /><MenuAction label={t('menu.skinOffice')} checked={themeMode === 'office'} onClick={() => setThemeMode('office')} /><MenuAction label={t('menu.customize')} onClick={() => setToolbarCustomizeOpen(true)} /><MenuAction label={t('menu.resetToolbar')} onClick={() => setToolbarHidden([])} /><MenuAction label={t('menu.options')} shortcut={shortcutFor('Options')} onClick={() => openRegisteredPanel('options')} /></div></details>
        <details><summary>{t('menu.window')}</summary><div className="menu-popup"><MenuAction label={t('menu.window.floatCurrent')} disabled={!activeSql} onClick={() => { const tab = documents.find((item) => item.id === selectedDocument); if (tab) void handleTabContextAction('floatTab', tab) }} /><MenuAction label={t('menu.window.pinCurrent')} disabled={selectedDocument === 'start'} checked={pinnedTabs.includes(selectedDocument)} onClick={() => { const tab = documents.find((item) => item.id === selectedDocument); if (tab) void handleTabContextAction('pinTab', tab) }} /><MenuAction label={t('menu.window.horizontalGroup')} disabled={!activeSql} onClick={() => { const tab = documents.find((item) => item.id === selectedDocument); if (tab) void handleTabContextAction('newHorizontalTabGroup', tab) }} /><MenuAction label={t('menu.window.verticalGroup')} disabled={!activeSql} onClick={() => { const tab = documents.find((item) => item.id === selectedDocument); if (tab) void handleTabContextAction('newVerticalTabGroup', tab) }} /><MenuAction label={t('menu.closeAll')} onClick={() => closeManyTabs(documents.filter((tab) => tab.id !== 'start').map((tab) => tab.id))} /><MenuAction label={t('menu.window.closeUnmodified')} onClick={() => closeManyTabs(documents.filter((tab) => tab.id !== 'start' && !tab.modified).map((tab) => tab.id))} /><MenuAction label={t('menu.window.closeButPinned')} onClick={() => closeManyTabs(documents.filter((tab) => tab.id !== 'start' && !pinnedTabs.includes(tab.id)).map((tab) => tab.id))} /><MenuAction label={t('menu.resetLayout')} onClick={() => { setExplorerVisible(true); setPanelVisible(true); setExplorerWidth(280); setPanelHeight(200); setSplitDocument(undefined); setTabGroups({}) }} /><div className="menu-divider" />{(appSettings.environment.windowItems ? documents.slice(-appSettings.environment.windowItems) : []).map((tab) => <MenuAction key={tab.id} label={`${tab.id === selectedDocument ? '✓ ' : ''}${tab.label}${tabGroups[tab.id] ? ` · ${tabGroups[tab.id]}` : ''}`} onClick={() => setSelectedDocument(tab.id)} />)}</div></details>
        <details><summary>{t('menu.help')}</summary><div className="menu-popup"><MenuAction label={t('menu.contents')} shortcut="F1" onClick={() => void window.tuxsql.openAboutLink('documentation')} /><MenuAction label={t('menu.gettingStarted')} onClick={() => setSelectedDocument('start')} /><MenuAction label={t('updates.check')} onClick={() => void checkForUpdates()} /><MenuAction label={t('menu.about')} onClick={() => setAboutOpen(true)} /></div></details>
      </nav>
      <span className="menubar-status">{status}</span>
      <button className="menubar-ai" onClick={() => setOpenPanel('ai-assistant')}>{t('menu.aiAssistant')} <small>AI</small></button>
    </header>
    {vaultWarning && <div role="alert" className="vault-warning"><span>{vaultWarning}</span><button aria-label="Dismiss vault warning" onClick={() => setVaultWarning('')}>×</button></div>}
    {backupScheduleWarning && <div role="alert" className="vault-warning"><span>{t('extras.backup.failureNotice')}</span><button aria-label={t('common.close')} onClick={() => setBackupScheduleWarning(false)}>×</button></div>}
    {(longQueryNotice || transactionNotice) && <div className="execution-notification" role="status">{longQueryNotice && <span>{t('execution.notification.longQuery')}</span>}{transactionNotice && <span>{t('execution.notification.openTransaction')}</span>}<button onClick={() => { setLongQueryNotice(false); setTransactionNotice(false) }} aria-label={t('common.close')}>×</button></div>}
    <div className="app-toolbar">
      {!toolbarHidden.includes('newSql') && <Button title="New SQL Document (Ctrl+N)" onClick={newSql}>＋ SQL</Button>}
      {!toolbarHidden.includes('newConnection') && <Button title="New Connection (Ctrl+Shift+N)" onClick={openNewConnection}>＋ Connection</Button>}
      {!toolbarHidden.includes('connectionManager') && <Button onClick={() => setManagerOpen(true)}>Connection Manager</Button>}
      <span className="toolbar-divider" />
      <select aria-label={t('ui.app.activeConnection')} value={currentConnection?.recordId ?? ''} onChange={(event) => { const record = records.find((item) => item.id === event.target.value); if (record) void connectFromExplorer(record) }}>
        <option value="">{currentConnection?.name ?? 'Connection'}</option>{records.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
      </select>
      <select aria-label="Database ativa" value={currentConnection?.database ?? ''} disabled={!currentConnection} onChange={(event) => { if (currentConnection) void selectDatabase(currentConnection, event.target.value) }}><option value="">{currentConnection?.database ?? 'Database'}</option>{(databases[currentConnection?.recordId ?? ''] ?? []).map((name) => <option key={name}>{name}</option>)}</select>
      {!toolbarHidden.includes('execute') && <Button variant="primary" onClick={() => void runSql()} disabled={!activeSql || !currentConnection || queryBusy}>▶ Execute</Button>}
      {!toolbarHidden.includes('stop') && <Button variant="danger" onClick={() => void cancelSql()} disabled={!queryBusy}>■ Stop</Button>}
      <label className="autocommit-toggle"><input type="checkbox" checked={autoCommit} disabled={!currentConnection} onChange={(event) => void toggleAutoCommit(event.target.checked)} />Auto-commit</label>
      <Button onClick={() => void toggleAutoCommit(false)} disabled={!currentConnection || !autoCommit}>{t('menu.beginTransaction')}</Button>
      <Button onClick={() => void finishTransaction('commit')} disabled={autoCommit}>Commit</Button>
      <Button onClick={() => void finishTransaction('rollback')} disabled={autoCommit}>Rollback</Button>
      <Button onClick={() => { setSplitDocument(selectedDocument === 'start' ? documents.find((tab) => tab.id !== 'start')?.id : selectedDocument); setSplitOrientation('vertical') }} disabled={selectedDocument === 'start' && documents.length < 2}>{t('tabs.splitView')}</Button>
      {!toolbarHidden.includes('results') && <Button onClick={() => setPanelVisible((value) => !value)} title="Toggle Results">Results</Button>}
      <span className="toolbar-spacer" />
      <Button className="icon-button" title="Auto theme" onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark')}>{theme === 'dark' ? '☾' : '☼'}</Button>
    </div>
    {loadError && <div className="storage-error" role="alert">{loadError}<Button onClick={() => void loadConnections()}>Tentar de novo</Button></div>}
    <div className={`workbench${explorerVisible ? '' : ' explorer-hidden'}${panelVisible ? '' : ' panel-hidden'}`} style={{ gridTemplateColumns: explorerVisible ? `${explorerWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}>
      {explorerVisible && <DatabaseExplorer records={records} active={active} databases={databases} objects={objects} loadingObjects={loadingObjects} connecting={connecting} errors={connectionErrors} onNew={openNewConnection} onManage={() => setManagerOpen(true)} onConnect={(record) => void connectFromExplorer(record)} onDisconnect={(connection) => void disconnect(connection)} onExpand={(record) => void expandRecord(record)} onLoadObjects={loadObjects} onSelectDatabase={(connection, database) => void selectDatabase(connection, database)} onDropObject={(connection, database, object) => void dropObject(connection, database, object)} onOpenObject={(connection, database, object) => openObjectEditor(connection, database, object.kind, object.name)} onCreateObject={(connection, database, kind) => openObjectEditor(connection, database, kind, `new_${kind}`, true)} onRenameTable={(connection, database, object, name) => void renameTable(connection, database, object, name)} onTruncateTable={(connection, database, object) => void truncateTable(connection, database, object)} onSelectObject={(connection, database, object) => setSelectedExplorerObject({ connection, database, object })} onProperties={showObjectProperties} onEdit={openEdit} onContextAction={(action, context) => void handleExplorerContextAction(action, context)} />}
      {explorerVisible && <div className="vertical-splitter" role="separator" aria-orientation="vertical" aria-label="Resize Database Explorer" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setExplorerWidth(Math.min(Math.floor(window.innerWidth * 0.5), Math.max(200, event.clientX))) }} />}
      <section className="document-workspace" style={{ gridTemplateRows: panelVisible ? `30px minmax(0, 1fr) 5px ${panelHeight}px` : '30px minmax(0, 1fr) 0 0' }}>
        <div className="document-tab-strip"><div className="document-tabs" role="tablist" aria-label="Documents" aria-owns={documents.filter((tab) => primaryGroupTabs.includes(tab.id)).map((tab) => `document-tab-control-${tab.id}`).join(' ')} />
          {documents.filter((tab) => primaryGroupTabs.includes(tab.id)).map((tab, index) => <div key={tab.id} draggable={tab.id !== 'start'} onPointerDown={() => { if (tab.id !== 'start') { draggedTabRef.current = tab.id; setDocumentDropGuides(true) } }} onPointerUp={() => { if (draggedTabRef.current === tab.id) { draggedTabRef.current = undefined; setDocumentDropGuides(false); setDocumentDropTarget(undefined) } }} onDragStart={() => { draggedTabRef.current = tab.id; setDocumentDropGuides(true) }} onDragEnd={() => { draggedTabRef.current = undefined; setDocumentDropGuides(false); setDocumentDropTarget(undefined) }} onDragOver={(event) => { if (draggedTabRef.current && draggedTabRef.current !== tab.id) { event.preventDefault(); setDocumentDropTarget({ documentId: tab.id, direction: 'center' }) } }} onDrop={(event) => { event.preventDefault(); const dragged = draggedTabRef.current; if (dragged && dragged !== tab.id) dropDocumentTab(dragged, tab.id, 'center'); draggedTabRef.current = undefined; setDocumentDropGuides(false); setDocumentDropTarget(undefined) }} className={`document-tab${selectedDocument === tab.id ? ' selected' : ''}${pinnedTabs.includes(tab.id) ? ' pinned' : ''}${tabGroups[tab.id] ? ` group-${tabGroups[tab.id]}` : ''}`}>
            <button id={`document-tab-control-${tab.id}`} type="button" role="tab" tabIndex={selectedDocument === tab.id ? 0 : -1} aria-selected={selectedDocument === tab.id} aria-label={`${tab.label}${tab.modified ? ` · ${t('tabs.modified')}` : ''}${pinnedTabs.includes(tab.id) ? ` · ${t('tabs.pinned')}` : ''}`} className="tab-label" onClick={() => setSelectedDocument(tab.id)} onContextMenu={(event) => { event.preventDefault(); setTabContext({ x: event.clientX, y: event.clientY, tabId: tab.id }) }} onKeyDown={(event) => { if (event.shiftKey && event.key === 'F10') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setTabContext({ x: rect.left, y: rect.bottom, tabId: tab.id }) } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = documents[(index + (event.key === 'ArrowRight' ? 1 : documents.length - 1)) % documents.length]; if (next) { setSelectedDocument(next.id); document.querySelector<HTMLButtonElement>(`[role="tab"][aria-label^="${CSS.escape(next.label)}"]`)?.focus() } } }}>{tab.modified ? '• ' : ''}{tab.label}</button>
            {tab.id !== 'start' && <button type="button" className="tab-close" aria-label={`${t('tabs.close')} ${tab.label}`} title={t('tabs.close')} onClick={() => closeTab(tab.id)}>×</button>}
          </div>)}
          <button className="tab-overflow" title="Todas as abas" onClick={() => window.alert(documents.map((tab) => tab.label).join('\n'))}>⌄</button></div>
          {documentDropGuides && <div className="document-drop-guides" role="group" aria-label={t('tabs.splitView')} onDragOver={(event) => event.preventDefault()}>
            {(['top', 'left', 'center', 'right', 'bottom'] as const).map((direction) => <button key={direction} type="button" data-document-dock-direction={direction} className={`document-drop-guide document-drop-guide-${direction}${documentDropTarget?.direction === direction ? ' active' : ''}`} aria-label={direction === 'center' ? t('tabs.mergeGroup') : t(`tabs.drop.${direction}`)} onDragOver={(event) => { event.preventDefault(); const target = selectedDocument !== draggedTabRef.current ? selectedDocument : documents.find((item) => item.id !== draggedTabRef.current && item.id !== 'start')?.id; if (target) setDocumentDropTarget({ documentId: target, direction }) }} onDrop={(event) => { event.preventDefault(); const dragged = draggedTabRef.current; const target = documentDropTarget?.documentId ?? (selectedDocument !== dragged ? selectedDocument : documents.find((item) => item.id !== dragged && item.id !== 'start')?.id); if (dragged && target) dropDocumentTab(dragged, target, direction); draggedTabRef.current = undefined; setDocumentDropGuides(false); setDocumentDropTarget(undefined) }}>{direction === 'center' ? '●' : direction === 'top' ? '↑' : direction === 'bottom' ? '↓' : direction === 'left' ? '←' : '→'}</button>)}
          </div>}
          {tabContext && <div ref={tabContextMenuRef} className="object-context tab-context-menu" style={{ left: tabContext.x, top: tabContext.y }} role="menu" aria-label={t('tabs.contextMenu')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => {
            if (event.key === 'Escape') { setTabContext(undefined); return }
            const items = [...(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))]
            const current = items.indexOf(document.activeElement as HTMLButtonElement)
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus() }
            if (event.key === 'Home') { event.preventDefault(); items[0]?.focus() }
            if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus() }
          }}>{([
            ['close', t('tabs.close')], ['closeAllDocuments', t('tabs.closeAll')], ['closeAllButThis', t('tabs.closeAllButThis')], ['closeAllUnmodified', t('tabs.closeUnmodified')], ['closeAllButPinned', t('tabs.closeButPinned')],
            ['copyFullPath', t('tabs.copyPath')], ['openContainingFolder', t('tabs.openFolder')], ['floatTab', t('tabs.float')], ['pinTab', pinnedTabs.includes(tabContext.tabId) ? t('tabs.unpin') : t('tabs.pin')], ['newHorizontalTabGroup', t('tabs.horizontalGroup')], ['newVerticalTabGroup', t('tabs.verticalGroup')]
          ] as const).map(([action, label]) => <button key={action} type="button" role="menuitem" disabled={(['copyFullPath', 'openContainingFolder'] as string[]).includes(action) && !documents.find((item) => item.id === tabContext.tabId)?.filePath} onClick={() => { const tab = documents.find((item) => item.id === tabContext.tabId); if (!tab) return; if (action === 'closeAllDocuments') closeManyTabs(documents.map((item) => item.id)); else void handleTabContextAction(action, tab); setTabContext(undefined) }}>{label}</button>)}</div>}
        <div className={`document-content${splitDocument ? ` split-${splitOrientation}` : ''}`} style={splitDocument ? splitOrientation === 'vertical' ? { gridTemplateColumns: `minmax(0, ${documentLayout.root.type === 'split' ? documentLayout.root.ratio : 0.5}fr) 5px minmax(0, ${documentLayout.root.type === 'split' ? 1 - documentLayout.root.ratio : 0.5}fr)` } : { gridTemplateRows: `minmax(0, ${documentLayout.root.type === 'split' ? documentLayout.root.ratio : 0.5}fr) 5px minmax(0, ${documentLayout.root.type === 'split' ? 1 - documentLayout.root.ratio : 0.5}fr)` } : undefined}>
        {selectedDocument === 'start' ? <StartPage files={documents.filter((tab) => tab.id !== 'start' && tab.filePath).slice(-10).reverse()} connections={records} onNewSql={newSql} onOpenSql={() => void openSqlFile()} onNewConnection={openNewConnection} onManageConnections={() => setManagerOpen(true)} onOpenFile={setSelectedDocument} onConnect={(record) => void connectFromExplorer(record)} onOpenTask={(panel) => openRegisteredPanel(panel)} /> : activeObjectTab ? <Suspense fallback={<div className="editor-loading" role="status">Loading object editor…</div>}><ObjectEditor key={selectedDocument} target={activeObjectTab} isNew={activeObjectTab.isNew} isProduction={currentConnection?.environment === 'prod'} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} onScript={(sql, label) => openSqlDocument(label, sql)} onApplied={() => { const connection = active.find((item) => item.id === activeObjectTab.connectionId); if (connection) void loadObjects(connection, activeObjectTab.database) }} /></Suspense> : activeDatabaseTab ? (() => { const draft = databaseDrafts[selectedDocument]; if (!draft) return <div className="tool-document-empty">{t('database.editor.empty')}</div>; return <section className="database-create-editor" aria-label={t('database.editor.title')}><header><strong>{t('database.editor.title')}</strong><span className="toolbar-spacer" /><button onClick={() => updateDatabaseDraft({ page: 'General' })}>{t('database.editor.general')}</button><button onClick={() => updateDatabaseDraft({ page: 'SQL' })}>{t('database.editor.sql')}</button><Button variant="primary" onClick={() => void applyDatabaseDraft()}>{t('common.applyChanges')}</Button></header>{draft.page === 'General' ? <div className="database-create-form"><label>{t('database.editor.name')}<input value={draft.name} onChange={(event) => updateDatabaseDraft({ name: event.target.value }, true)} /></label><label>{t('database.editor.characterSet')}<input value={draft.charset} onChange={(event) => updateDatabaseDraft({ charset: event.target.value }, true)} /></label><label>{t('database.editor.collation')}<input value={draft.collation} onChange={(event) => updateDatabaseDraft({ collation: event.target.value }, true)} /></label></div> : <textarea value={draft.sql} onChange={(event) => updateDatabaseDraft({ sql: event.target.value })} />}{databaseEditorStatus && <p role="status">{databaseEditorStatus}</p>}<pre>{draft.sql}</pre></section> })() : activePanelTab ? (() => { const entry = panelRegistry.find((item) => item.id === activePanelTab); if (!entry) return <div className="tool-document-empty">Panel unavailable.</div>; const Panel = entry.component; return <div className="tool-document">{panelContents(Panel)}</div> })() : <div className="document-main">
          <div className="sql-context-toolbar"><span>{documents.find((tab) => tab.id === selectedDocument)?.label}</span><span>{activeTitle}</span><span className="metadata-state">{metadataLoading ? 'Loading schema…' : editorMetadata.objects.length ? `${editorMetadata.objects.length} schema objects` : ''}</span><Button onClick={() => formatEditor('document')}>Format</Button><Button onClick={() => formatEditor('statement')}>Format statement</Button><Button variant="primary" onClick={() => void runSql()} disabled={!currentConnection || queryBusy}>▶ Execute</Button><Button onClick={() => void runSql('current')} disabled={!currentConnection || queryBusy}>Current statement</Button></div>
          {findOpen && <div className="find-toolbar"><input type="search" aria-label={t('nav.find')} placeholder={t('nav.find')} value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') cycleFind(event.shiftKey ? -1 : 1) }} /><Button onClick={() => cycleFind(-1)} title={t('nav.previous')}>↑</Button><Button onClick={() => cycleFind(1)} title={t('nav.next')}>↓</Button><label><input type="checkbox" checked={findRegex} onChange={(event) => setFindRegex(event.target.checked)} />{t('nav.regex')}</label><label><input type="checkbox" checked={findCase} onChange={(event) => setFindCase(event.target.checked)} />{t('nav.caseSensitive')}</label><select aria-label={t('nav.scope')} value={findScope} onChange={(event) => setFindScope(event.target.value as typeof findScope)}><option value="document">{t('nav.document')}</option><option value="selection">{t('nav.selection')}</option><option value="open">{t('nav.openDocuments')}</option></select>{findReplaceMode && <><input aria-label={t('nav.replace')} placeholder={t('nav.replace')} value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} /><Button onClick={replaceCurrentMatch}>{t('nav.replaceOne')}</Button><Button onClick={replaceAllMatches}>{t('nav.replaceAll')}</Button></>}<span>{findMatches.length}</span><Button onClick={() => { setFindOpen(false); setFindReplaceMode(false) }} title={t('nav.close')}>×</Button></div>}
          <div className="editor-surface"><Suspense fallback={<div className="editor-loading" role="status">Loading SQL editor…</div>}><Editor path={`tuxsql://sql/${encodeURIComponent(selectedDocument)}`} height="100%" language="sql" theme={editorTheme} value={sqlByDocument[selectedDocument] ?? ''} onMount={(editor, monaco) => {
            editorRef.current = editor
            monacoApiRef.current = monaco
            applyEditorTheme(monaco, appSettingsRef.current, theme === 'dark' || theme === 'high-contrast' ? theme : 'light')
            editor.onDidChangeModelContent(() => { const model = editor.getModel(); const position = editor.getPosition(); if (!model || !position) return; const value = model.getValue(); const offset = model.getOffsetAt(position); const adjusted = applyKeywordCaseAtOffset(value, offset, appSettingsRef.current.editor.keywordCase); if (adjusted !== value) { let start = 0; while (start < value.length && value[start] === adjusted[start]) start++; let suffix = 0; while (suffix < value.length - start && value[value.length - suffix - 1] === adjusted[adjusted.length - suffix - 1]) suffix++; const from = model.getPositionAt(start); const to = model.getPositionAt(value.length - suffix); const range = new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column); editor.executeEdits('keyword-case', [{ range, text: adjusted.slice(start, adjusted.length - suffix) }]) } const current = model.getValue(); const caret = model.getPositionAt(Math.min(offset, current.length)); const e = appSettingsRef.current.editor; const suggestions = buildSqlSuggestions(current, Math.min(offset, current.length), metadataRef.current, userSnippetsRef.current, { filter: e.completionFilter, sortKeywords: e.completionSortKeywords, qualifyColumnWithAlias: e.qualifyColumnWithAlias, autoAlias: e.autoAlias, aliasUppercase: e.aliasUppercase, aliasUseAs: e.aliasUseAs, aliasQualifier: e.aliasQualifier, aliasRules: e.aliasRules, identifierQuoting: e.identifierQuoting }); const match = suggestions.find((item) => item.kind === 'table' && metadataRef.current.objects.some((object) => object.name.toLowerCase() === item.label.toLowerCase())); const detail = match && metadataRef.current.objects.find((object) => object.name.toLowerCase() === match.label.toLowerCase()); setCompletionDetails(detail); setEditorPosition({ line: caret.lineNumber, column: caret.column }) })
            editor.onDidChangeModelContent((event) => { if (formattingRef.current) return; const editorSettings = appSettingsRef.current.editor; const inserted = event.changes.map((change) => change.text).join(''); if ((editorSettings.formatOnStatementEnd && inserted.includes(';')) || (editorSettings.formatOnType && /[;\n]/.test(inserted))) window.requestAnimationFrame(() => formatEditor('statement')) })
            editor.onDidPaste(() => { if (!appSettingsRef.current.editor.formatOnPaste) return; window.requestAnimationFrame(() => formatEditor(editor.getSelection()?.isEmpty() ? 'statement' : 'selection')) })
            editor.onKeyDown((event) => {
              if (event.keyCode === monaco.KeyCode.Escape) setCompletionDetails(undefined)
              if (event.ctrlKey && event.keyCode === monaco.KeyCode.F12) {
                const model = editor.getModel()
                const position = editor.getPosition()
                if (!model || !position) return
                const word = model.getWordAtPosition(position)
                if (!word || !/^(BEGIN|END)$/i.test(word.word)) return
                const currentOffset = model.getOffsetAt({ lineNumber: position.lineNumber, column: word.startColumn })
                const pairOffset = findBeginEndPair(model.getValue(), currentOffset)
                if (pairOffset === undefined) return
                const target = model.getPositionAt(pairOffset)
                editor.setPosition(target); editor.revealPositionInCenter(target); event.preventDefault(); event.stopPropagation()
              }
            })
            editor.onDidBlurEditorText(() => setCompletionDetails(undefined))
            editor.onDidChangeModelContent(() => {
              const model = editor.getModel()
              if (!model) return
              const current = model.getValue()
              if (analysisTimerRef.current !== undefined) window.clearTimeout(analysisTimerRef.current)
              analysisTimerRef.current = window.setTimeout(() => {
                void window.tuxsql.analyzeSql(current).then((findings) => {
                  setAnalysisFindings(findings); setAnalysisDocumentId(selectedDocument)
                  monaco.editor.setModelMarkers(model, 'tuxsql-sql-analysis', findings.filter((finding) => finding.severity !== 'Info').map((finding) => ({ startLineNumber: finding.line, startColumn: finding.column, endLineNumber: finding.line, endColumn: finding.column + 1, message: finding.message, severity: finding.severity === 'Error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning })))
                }).catch(() => undefined)
              }, 500)
            })
            completionProviderRef.current?.dispose()
            completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
              triggerCharacters: ['.'],
              provideCompletionItems: (model, position) => {
                const source = model.getValue()
                const offset = model.getOffsetAt(position)
                const word = model.getWordUntilPosition(position)
                const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column)
                const kinds = { database: monaco.languages.CompletionItemKind.Module, table: monaco.languages.CompletionItemKind.Struct, column: monaco.languages.CompletionItemKind.Field, routine: monaco.languages.CompletionItemKind.Function, keyword: monaco.languages.CompletionItemKind.Keyword, snippet: monaco.languages.CompletionItemKind.Snippet }
                const e = appSettingsRef.current.editor
                const suggestions = buildSqlSuggestions(source, offset, metadataRef.current, userSnippetsRef.current, { filter: e.completionFilter, sortKeywords: e.completionSortKeywords, qualifyColumnWithAlias: e.qualifyColumnWithAlias, autoAlias: e.autoAlias, aliasUppercase: e.aliasUppercase, aliasUseAs: e.aliasUseAs, aliasQualifier: e.aliasQualifier, aliasRules: e.aliasRules, identifierQuoting: e.identifierQuoting })
                const visibleSuggestions = snippetPickerRef.current ? suggestions.filter((item) => item.kind === 'snippet') : suggestions
                snippetPickerRef.current = false
                return { suggestions: visibleSuggestions.map((item) => ({ label: item.schema ? { label: item.label, description: item.schema, detail: item.detail } : item.label, kind: kinds[item.kind], detail: item.detail, documentation: { value: completionDocumentation(item, metadataRef.current) }, insertText: item.insertText, filterText: item.kind === 'snippet' ? item.detail.split(' · ')[0] : item.label, insertTextRules: item.kind === 'snippet' ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : monaco.languages.CompletionItemInsertTextRule.None, range })) }
              }
            })
            signatureHelpProviderRef.current?.dispose()
            signatureHelpProviderRef.current = monaco.languages.registerSignatureHelpProvider('sql', {
              signatureHelpTriggerCharacters: ['(', ','],
              signatureHelpRetriggerCharacters: [','],
              provideSignatureHelp: (model, position) => {
                const signature = getActiveSqlSignature(model.getValue(), model.getOffsetAt(position), metadataRef.current.routines, (message) => t(message))
                if (!signature) return undefined
                return {
                  value: {
                    signatures: [{ label: signature.label, documentation: signature.description, parameters: signature.parameters.map((label, index) => ({ label: signature.parameterRanges[index]!, documentation: label })) }],
                    activeSignature: 0,
                    activeParameter: signature.activeParameter
                  },
                  dispose: () => undefined
                }
              }
            })
            editor.onDidChangeCursorPosition(({ position }) => setEditorPosition({ line: position.lineNumber, column: position.column }))
            const editorContextActions = [
              ['cut', 'Cut', 'Cut', '1_modification'], ['copy', 'Copy', 'Copy', '1_modification'], ['paste', 'Paste', 'Paste', '1_modification'],
              ['execute', 'Execute', 'Execute SQL', '1_modification'], ['execute-current', 'Execute Current Statement', 'Execute Current Statement', '1_modification'],
              ['execute-to-cursor', 'Execute To Cursor', 'Execute To Cursor', '1_modification'], ['run-to-cursor', 'Run To Cursor', 'Run To Cursor', '1_modification'],
              ['breakpoint', 'Insert Breakpoint', 'Insert Breakpoint', '1_modification'], ['insert-snippet', 'Insert Snippet…', 'Insert Snippet', '1_modification'],
              ['go-to-definition', 'Go To Definition', 'Go To Definition', '1_modification'], ['jump-pair', 'Jump Between Syntax Pairs', 'Jump Between Syntax Pairs', '1_modification'],
              ['rename', 'Rename…', 'Rename', '2_refactoring'], ['backticks', 'Add Backticks to All Identifiers', 'Add Backticks to All Identifiers', '2_refactoring'],
              ['unbackticks', 'Remove Unnecessary Backticks', 'Remove Unnecessary Backticks', '2_refactoring'], ['qualify', 'Qualify Object Names', 'Qualify object names', '2_refactoring'],
              ['expand-wildcards', 'Expand Wildcards', 'Expand wildcards', '2_refactoring'], ['format-doc', 'Format Document', 'Format Document', '3_format'],
              ['format-selection', 'Format Selection', 'Format Selection', '3_format'], ['format-statement', 'Format Current Statement', 'Format Current Statement', '3_format'],
              ['white-space', 'View White Space', 'View White Space', '4_settings'], ['word-wrap', 'Word Wrap', 'Word Wrap', '4_settings'],
              ['line-numbers', 'Show Line Numbers', 'Show Line Numbers', '4_settings'], ['disable-completion', 'Disable Code Completion', 'Disable Code Completion', '4_settings']
            ] as const
            editorContextActions.forEach(([id, , command, group], index) => editor.addAction({ id: `tuxsql.context.${id}`, label: editorLabel(command), contextMenuGroupId: group, contextMenuOrder: index + 1, run: () => runEditorCommand(command) }))
            const formatAction = (id: string, label: string, target: 'document' | 'selection' | 'statement', keybindings?: number[]): void => { editor.addAction({ id, label, ...(keybindings ? { keybindings } : {}), run: () => formatEditor(target) }) }
            formatAction('tuxsql.format-document', 'Format Document', 'document')
            formatAction('tuxsql.format-selection', 'Format Selection', 'selection')
            formatAction('tuxsql.format-statement', 'Format Statement', 'statement')
          }} onChange={(value) => { const nextValue = value ?? ''; setSqlByDocument((current) => ({ ...current, [selectedDocument]: nextValue })); setDocuments((current) => current.map((tab) => tab.id === selectedDocument ? { ...tab, modified: true } : tab)) }} options={{ minimap: { enabled: appSettings.editor.minimap }, fontFamily: appSettings.editor.fontName, fontSize: appSettings.editor.fontSize, automaticLayout: true, fontLigatures: appSettings.editor.ligatures, lineNumbers: appSettings.editor.lineNumbers ? 'on' : 'off', glyphMargin: appSettings.editor.glyphMargin, matchBrackets: appSettings.editor.matchBrackets ? 'always' : 'never', occurrencesHighlight: appSettings.editor.highlightOccurrences ? 'singleFile' : 'off', autoClosingBrackets: appSettings.editor.autoCloseBrackets ? 'always' : 'never', autoClosingQuotes: appSettings.editor.autoCloseQuotes ? 'always' : 'never', autoIndent: appSettings.editor.indentStyle === 'none' ? 'none' : appSettings.editor.indentStyle === 'smart' ? 'advanced' : 'keep', rulers: appSettings.editor.rightMargin > 0 ? [{ column: appSettings.editor.rightMargin, color: appSettings.appearance.editorForeground }] : [], tabCompletion: 'on', suggestOnTriggerCharacters: appSettings.editor.autoComplete, quickSuggestions: appSettings.editor.autoComplete, quickSuggestionsDelay: appSettings.editor.completionDelayMs, suggestSelection: appSettings.editor.completionCyclic ? 'first' : 'recentlyUsedByPrefix', acceptSuggestionOnEnter: 'off', acceptSuggestionOnCommitCharacter: Boolean(appSettings.editor.completionConfirmCharacters), wordBasedSuggestions: appSettings.editor.completionSortKeywords ? 'currentDocument' : 'off', wordWrap: appSettings.editor.wordWrap ? 'on' : 'off', tabSize: appSettings.editor.tabSize, insertSpaces: appSettings.editor.insertSpaces, folding: appSettings.editor.folding, renderLineHighlight: appSettings.editor.highlightCurrentLine ? 'line' : 'none' }} /></Suspense>{completionDetails && <aside className="editor-completion-details" aria-label={t('editor.completion.details')}><strong>{completionDetails.name}</strong><small>{completionDetails.kind} · {editorMetadata.database} · {completionDetails.engine || t('editor.completion.engineUnknown')}</small><table><thead><tr><th>{t('editor.completion.column')}</th><th>{t('editor.completion.type')}</th><th>{t('editor.completion.null')}</th></tr></thead><tbody>{completionDetails.columns.map((column) => <tr key={column.name}><td>{column.name}</td><td>{column.type}</td><td>{column.nullable === false ? 'NOT NULL' : 'NULL'}</td></tr>)}</tbody></table></aside>}{editorContextMenu && <div className="sql-editor-context" role="menu" aria-label="SQL editor context menu" style={{ left: editorContextMenu.x, top: editorContextMenu.y }} onContextMenu={(event) => event.preventDefault()}>
            {(['Cut','Copy','Paste'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}
            <hr /><details><summary>{t('editor.context.editing')}</summary><div>{(['Make Uppercase','Make Lowercase','Toggle Block Comment','Comment Selection','Uncomment Selection','Move Selected Lines Up','Move Selected Lines Down','Join Lines','Remove Line','Increase Line Indent','Decrease Line Indent','Incremental Search','Select Current Statement'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            {(['Execute SQL','Execute Current Statement','Execute To Cursor','Run To Cursor','Insert Breakpoint','Go To Definition','Jump Between Syntax Pairs'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}
            <details><summary>{t('menu.bookmarks')}</summary><div>{(['Toggle Bookmark','Previous Bookmark','Next Bookmark','Clear Bookmarks'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            <details><summary>{t('menu.outlining')}</summary><div>{(['Toggle Outline Expansion','Toggle All Outlining','Stop Outlining','Start Automatic Outlining'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            <details><summary>{t('editor.context.refactoring')}</summary><div>{(['Rename','Add Backticks to All Identifiers','Remove Unnecessary Backticks','Qualify object names','Expand wildcards'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            <details><summary>{t('editor.context.format')}</summary><div>{(['Format Document','Format Selection','Format Current Statement'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            <details><summary>{t('editor.context.settings')}</summary><div>{(['View White Space','Word Wrap','Show Line Numbers','Disable Code Completion'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
            <details><summary>{t('menu.codeCompletion')}</summary><div>{(['List Members','Parameter Info','Quick Info','Complete Word','Insert Snippet','Refresh Suggestions'] as const).map((command) => <button key={command} type="button" role="menuitem" onClick={() => { runEditorCommand(command); setEditorContextMenu(null) }}>{editorLabel(command)}</button>)}</div></details>
          </div>}</div>
          <div className="result-view">
            <div className="result-presentation">{t('editor.results.as')} <button className={resultPresentation === 'text' ? 'selected' : ''} onClick={() => setResultPresentation('text')}>{t('editor.results.text')}</button><button className={resultPresentation === 'grid' ? 'selected' : ''} onClick={() => setResultPresentation('grid')}>{t('editor.results.grid')}</button></div><div className="result-tabs" role="tablist" aria-label={t('editor.results.tabs')}>{results.map((result, index) => <button key={index} role="tab" aria-selected={resultIndex === index} className={resultIndex === index ? 'selected' : ''} onClick={() => setResultIndex(index)}>Result {index + 1} ({result.rowCount ?? result.rows.length})</button>)}<button role="tab" aria-selected={resultIndex === -1} className={resultIndex === -1 ? 'selected' : ''} onClick={() => setResultIndex(-1)}>Messages</button><button role="tab" aria-selected={resultIndex === -2} className={resultIndex === -2 ? 'selected' : ''} onClick={() => setResultIndex(-2)}>Query History</button></div>
            {resultIndex >= 0 && results[resultIndex] ? resultPresentation === 'text' ? <pre className="result-text">{JSON.stringify(results[resultIndex].rows, null, 2)}</pre> : <ResultGrid result={results[resultIndex]} index={resultIndex} currentConnection={currentConnection ?? undefined} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} fetchRows={(offset, limit) => window.tuxsql.readResultRows(results[resultIndex].resultStoreId!, offset, limit)} onLoadMore={pageQueries[selectedDocument] ? () => loadMorePage(resultIndex) : undefined} /> : resultIndex === -2 ? <div className="query-history"><div className="history-toolbar"><input aria-label="Search Query History" placeholder="Search SQL, connection, database…" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} /><span>{historyLoading ? 'Loading…' : `${history.length} entries`}</span></div><div className="query-messages">{history.length ? history.map((entry) => <article className="history-row" key={entry.id}><button className="history-entry" onClick={() => openSqlDocument('History query', entry.sql)}><span>{new Date(entry.timestamp).toLocaleString()} · {entry.connection}{entry.database ? ` · ${entry.database}` : ''} · {(entry.elapsedMs / 1000).toFixed(3)} s · {entry.success ? 'Success' : 'Failed'}</span><code>{entry.sql}</code></button><Button onClick={() => replayHistory(entry)}>Re-run</Button></article>) : <p>{historyLoading ? 'Loading…' : t('ui.app.msg.8918e025fe')}</p>}</div></div> : <div className="query-messages" aria-live="polite">{queryBusy && <p>{t('ui.app.queryRunning')}</p>}{queryMessages.map((message, index) => <p key={index}>{message}</p>)}{!queryBusy && !queryMessages.length && <p>{t('ui.app.queryMessagesEmpty')}</p>}{results.filter((result) => !result.columns.length).map((result, index) => <p key={`affected-${index}`}>Affected rows: {result.affectedRows} · Last insert id: {result.insertId}</p>)}{queryElapsed > 0 && <small>{(queryElapsed / 1000).toFixed(3)} s</small>}</div>}
          </div>
        </div>}
        {splitDocument && <div className={`document-group-splitter ${splitOrientation}`} role="separator" aria-orientation={splitOrientation === 'vertical' ? 'vertical' : 'horizontal'} aria-label={t('tabs.resizeGroups')} onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (!event.buttons || documentLayout.root.type !== 'split') return; const rect = event.currentTarget.parentElement!.getBoundingClientRect(); const ratio = splitOrientation === 'vertical' ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height; setDocumentLayout((current) => current.root.type === 'split' ? setGroupRatio(current, current.root.id, ratio) : current) }} />}
        {splitDocument && <aside className="document-split-pane" aria-label={t('tabs.secondaryPane')}><header><div className="split-document-tabs" role="tablist" aria-label={t('tabs.secondaryPane')}>{(findDocumentGroup(documentLayout.root, splitDocument)?.tabs ?? [splitDocument]).map((id) => { const tab = documents.find((item) => item.id === id); return tab && <button key={id} type="button" role="tab" aria-selected={id === splitDocument} onClick={() => setSplitDocument(id)}>{tab.modified ? '• ' : ''}{tab.label}</button> })}</div><Button onClick={() => { const groupTabs = findDocumentGroup(documentLayout.root, splitDocument)?.tabs ?? [splitDocument]; for (const id of groupTabs) setDocumentLayout((current) => mergeDocumentIntoGroup(current, id, selectedDocument)); setSplitDocument(undefined) }}>{t('tabs.closeSplit')}</Button></header>
          {(() => {
            const tab = documents.find((item) => item.id === splitDocument)
            if (!tab) return null
            if (tab.panelId) { const entry = panelRegistry.find((item) => item.id === tab.panelId); if (!entry) return <div className="tool-document-empty">Panel unavailable.</div>; return <div className="tool-document split-tool-document">{panelContents(entry.component)}</div> }
            if (tab.objectEditor) { const target = tab.objectEditor; return <div className="split-tool-document"><Suspense fallback={<div role="status">Loading object editor…</div>}><ObjectEditor key={tab.id} target={target} isNew={target.isNew} isProduction={currentConnection?.environment === 'prod'} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} onScript={(sql, label) => openSqlDocument(label, sql)} onApplied={() => { const connection = target.connectionId ? active.find((item) => item.id === target.connectionId) : undefined; if (connection && target.database) void loadObjects(connection, target.database) }} /></Suspense></div> }
            if (tab.databaseEditor) { const draft = databaseDrafts[tab.id]; return <textarea aria-label={t('tabs.secondaryEditor')} spellCheck={false} value={draft?.sql ?? ''} onChange={(event) => { const value = event.target.value; setDatabaseDrafts((current) => ({ ...current, [tab.id]: { ...(current[tab.id] ?? { name: '', charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci', page: 'SQL' as const }), sql: value, page: 'SQL' } })); setDocuments((current) => current.map((item) => item.id === tab.id ? { ...item, modified: true } : item)) }} /> }
            if (tab.id === 'start') return <StartPage files={documents.filter((item) => item.id !== 'start' && item.filePath).slice(-10).reverse()} connections={records} onNewSql={newSql} onOpenSql={() => void openSqlFile()} onNewConnection={openNewConnection} onManageConnections={() => setManagerOpen(true)} onOpenFile={setSelectedDocument} onConnect={(record) => void connectFromExplorer(record)} onOpenTask={(panel) => openRegisteredPanel(panel)} />
            return <textarea aria-label={t('tabs.secondaryEditor')} spellCheck={false} value={sqlByDocument[tab.id] ?? ''} onChange={(event) => { const value = event.target.value; setSqlByDocument((current) => ({ ...current, [tab.id]: value })); setDocuments((current) => current.map((item) => item.id === tab.id ? { ...item, modified: true } : item)) }} />
          })()}
        </aside>}
        </div>
        <div className="horizontal-splitter" role="separator" aria-orientation="horizontal" aria-label="Resize Output panel" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => { if (event.buttons) setPanelHeight(Math.min(480, Math.max(80, window.innerHeight - event.clientY))) }} />
        <section className="bottom-panel" aria-label="Output and errors">
          {panelTab === 'Output' ? <><nav className="output-subtabs" aria-label={t('app.output.title')}>{(['General', 'SQL Log', 'Debug'] as const).map((view) => <button type="button" key={view} className={outputView === view ? 'selected' : ''} aria-pressed={outputView === view} onClick={() => setOutputView(view)}>{t(`app.output.${view === 'SQL Log' ? 'sqlLog' : view.toLowerCase()}`)}</button>)}<span className="toolbar-spacer" /><button type="button" onClick={() => { setOutput([]); setSqlLog([]) }}>{t('app.output.clearAll')}</button></nav><div className="output-log" aria-live="polite">{outputView === 'SQL Log' && !appSettings.output.sqlLogEnabled ? <p>{t('app.output.sqlLogDisabled')}</p> : (outputView === 'General' ? output : outputView === 'SQL Log' ? sqlLog : output.filter((entry) => /debug/i.test(entry.origin))).length ? (outputView === 'General' ? output : outputView === 'SQL Log' ? sqlLog : output.filter((entry) => /debug/i.test(entry.origin))).map((entry, index) => <div key={`${entry.timestamp}-${index}`} className={`output-${entry.tone}`}>{appSettings.output.showTimestamps && <time>[{entry.timestamp}] </time>}{entry.origin} {entry.message}</div>) : <p>{outputView === 'SQL Log' ? t('app.output.sqlLogEmpty') : t('app.output.empty')} {t('app.output.secretNote')}</p>}</div></> : panelTab === 'Find Results' ? panelContents(panelRegistry.find((entry) => entry.id === 'find-results')!.component) : renderErrorList()}
        </section>
      </section>
    </div>
    {appSettings.environment.showStatusBar && <footer className="status-bar"><span>{currentConnection ? t('editor.connection.connected') : status}</span><button onClick={() => currentRecord && setManagerOpen(true)}>{currentConnection ? `${currentConnection.host} (${serverVersion || currentRecord?.type || 'MySQL'}) · ${currentConnection.user}` : activeTitle}</button>{currentConnection && currentRecord?.environment !== 'none' && <span data-shape={currentRecord?.environmentShape ?? ({ none: 'square', dev: 'square', test: 'diamond', prod: 'circle', sandbox: 'triangle', custom: 'triangle' }[currentRecord?.environment ?? 'none'])} className={`environment-badge env-${currentRecord?.environment ?? 'none'}`} style={{ '--environment-color': currentRecord?.color ?? (currentRecord?.environment === 'prod' ? '#c62828' : currentRecord?.environment === 'test' ? '#ed6c02' : currentRecord?.environment === 'sandbox' ? '#1565c0' : '#2e7d32') } as React.CSSProperties}>{t(`conn.environment.${currentRecord?.environment ?? 'none'}`)}</span>}{currentRecord?.category && <span className="connection-category">{currentRecord.category}</span>}<span>{currentConnection?.database ?? ''}</span>{status === t('editor.query.success') && <span>{status} · {(queryElapsed / 1000).toFixed(3)} s</span>}<span>Ln {editorPosition.line}, Col {editorPosition.column}, Ch {editorPosition.column - 1}</span><span>UTF-8</span><span>LF</span><span>{results.length ? `${results.reduce((sum, item) => sum + (item.rowCount ?? item.rows.length), 0)} rows` : ''}</span><span className="toolbar-spacer" />{updateState.phase === 'checking' ? <button className="update-status" onClick={() => void checkForUpdates()}>{t('updates.checking')}</button> : updateState.phase === 'available' ? <button className="update-status available" onClick={() => setUpdateDialogOpen(true)}>{t('updates.available', [updateState.newVersion ?? ''])}</button> : updateState.phase === 'up-to-date' ? <span className="update-status">{t('updates.updated')}</span> : null}{themeMode.toUpperCase()}</footer>}
    {toolbarCustomizeOpen && <PanelDialog title={t('menu.toolbarCustomizeTitle')} onClose={() => setToolbarCustomizeOpen(false)}><section className="toolbar-customize" aria-label={t('menu.toolbarCustomizeTitle')}><h2>{t('menu.toolbarCustomizeTitle')}</h2><div role="tablist" aria-label={t('menu.toolbarCustomizeTitle')}><Button role="tab" aria-selected={toolbarCustomizeTab === 'toolbars'} onClick={() => setToolbarCustomizeTab('toolbars')}>{t('menu.customize.toolbars')}</Button><Button role="tab" aria-selected={toolbarCustomizeTab === 'commands'} onClick={() => setToolbarCustomizeTab('commands')}>{t('menu.customize.commands')}</Button></div>{toolbarCustomizeTab === 'toolbars' ? <div role="tabpanel">{toolbarActions.map((action) => <label key={action}><input type="checkbox" checked={!toolbarHidden.includes(action)} onChange={(event) => setToolbarHidden((current) => event.target.checked ? current.filter((item) => item !== action) : [...new Set([...current, action])])} />{t(`menu.toolbar${action[0]!.toUpperCase()}${action.slice(1)}`)}</label>)}</div> : <div role="tabpanel"><label>{t('menu.customize.search')}<input value={toolbarCommandSearch} onChange={(event) => setToolbarCommandSearch(event.target.value)} /></label>{toolbarActions.filter((action) => t(`menu.toolbar${action[0]!.toUpperCase()}${action.slice(1)}`).toLocaleLowerCase().includes(toolbarCommandSearch.toLocaleLowerCase())).map((action) => <div className="toolbar-command" key={action}><span>{t(`menu.toolbar${action[0]!.toUpperCase()}${action.slice(1)}`)}</span><Button disabled={!toolbarHidden.includes(action)} onClick={() => setToolbarHidden((current) => current.filter((item) => item !== action))}>{t('menu.customize.add')}</Button></div>)}</div>}<footer><Button onClick={() => setToolbarHidden([])}>{t('menu.resetToolbar')}</Button><Button variant="primary" onClick={() => setToolbarCustomizeOpen(false)}>{t('menu.toolbarDone')}</Button></footer></section></PanelDialog>}
    {dialogRecord && <ConnectionPropertiesDialog initial={dialogRecord} isNew={newDialog} names={records.filter((record) => record.id !== dialogRecord.id).map((record) => record.name)} onAction={runConnectionAction} onTrustHostKey={async (record) => { await window.tuxsql.saveConnection(record); upsertRecord(record) }} onCancel={() => setDialogRecord(null)} />}
    {openPanel && (() => { const entry = panelRegistry.find((item) => item.id === openPanel); if (!entry) return null; const contents = panelContents(entry.component); return entry.presentation === 'dock' ? <aside className={`right-dock ${dockDirectionClass(panelDockDirection)}`} aria-label={t(entry.titleKey)}><header onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; dockDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: true }; setDockGuidesOpen(true); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { const drag = dockDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 8) { drag.moved = true; setDockGuidesOpen(true) } }} onPointerUp={(event) => { const drag = dockDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; dockDragRef.current = undefined; if (drag.moved) { const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-dock-direction]'); const direction = target?.dataset.dockDirection; if (direction === 'left' || direction === 'right' || direction === 'top' || direction === 'bottom') setPanelDockDirection(direction); setDockGuidesOpen(false) } }} onPointerCancel={() => { dockDragRef.current = undefined; setDockGuidesOpen(false) }}><strong>{t(entry.titleKey)}</strong><button type="button" title="Choose docking direction" aria-label="Choose docking direction" aria-expanded={dockGuidesOpen} onClick={() => setDockGuidesOpen((value) => !value)}>⊞</button><button onClick={() => { setOpenPanel(null); setDockGuidesOpen(false) }} aria-label={`Close ${t(entry.titleKey)}`}>×</button></header>{contents}{dockGuidesOpen && <nav className="dock-guides" aria-label="Docking directions"><button data-dock-direction="top" className="dock-guide-up" aria-label="Dock top" title="Dock top" onClick={() => { setPanelDockDirection('top'); setDockGuidesOpen(false) }}>↑</button><button data-dock-direction="left" className="dock-guide-left" aria-label="Dock left" title="Dock left" onClick={() => { setPanelDockDirection('left'); setDockGuidesOpen(false) }}>←</button><span className="dock-guide-center" aria-hidden="true">✥</span><button data-dock-direction="right" className="dock-guide-right" aria-label="Dock right" title="Dock right" onClick={() => { setPanelDockDirection('right'); setDockGuidesOpen(false) }}>→</button><button data-dock-direction="bottom" className="dock-guide-down" aria-label="Dock bottom" title="Dock bottom" onClick={() => { setPanelDockDirection('bottom'); setDockGuidesOpen(false) }}>↓</button></nav>}</aside> : <PanelDialog title={t(entry.titleKey)} onClose={() => setOpenPanel(null)}>{contents}</PanelDialog> })()}
    {managerOpen && <ConnectionManager records={records} onNew={() => { setManagerOpen(false); openNewConnection() }} onEdit={(record) => { setManagerOpen(false); openEdit(record) }} onDuplicate={(record) => { setManagerOpen(false); setDialogRecord({ ...structuredClone(record), id: crypto.randomUUID(), name: `${record.name} copy`, lastUsedAt: undefined }); setNewDialog(true) }} onDelete={deleteRecords} onClose={() => setManagerOpen(false)} />}
    {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    {executionError && <ExecutionErrorDialog message={executionError.message} onAction={(action) => { const pending = executionError; setExecutionError(null); pending.resolve(action) }} />}
    <SshKeyboardInteractiveDialog />
    {updateDialogOpen && <PanelDialog title={t('updates.dialogTitle')} onClose={() => setUpdateDialogOpen(false)}><section className="update-dialog"><h2>{t('updates.dialogTitle')}</h2><p>{t('updates.version', [updateState.currentVersion, updateState.newVersion ?? updateState.currentVersion])}</p><p>{t('updates.channel', [t(updateState.channel === 'dev' ? 'updates.dev' : 'updates.release')])}</p>{updateState.message && <p role="status">{updateState.message}</p>}{updateState.summary.length > 0 && <><h3>{t('updates.summary')}</h3><ul>{updateState.summary.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}</ul></>}{updateState.progress !== undefined && <label>{t('updates.progress', [updateState.progress])}<progress max={100} value={updateState.progress} /></label>}<details open={updateLogOpen} onToggle={(event) => setUpdateLogOpen(event.currentTarget.open)}><summary>{t('updates.log')}</summary><pre>{updateState.log.join('\n')}</pre></details><footer><Button onClick={() => setUpdateDialogOpen(false)}>{t('updates.later')}</Button>{['checking', 'building', 'downloading'].includes(updateState.phase) && <Button onClick={() => void window.tuxsql.updaterCancel().then(setUpdateState)}>{t('updates.cancel')}</Button>}{updateState.phase === 'available' && <><Button onClick={() => void ignoreUpdate()}>{t('updates.ignore')}</Button><Button variant="primary" onClick={() => void applyUpdate()}>{t('updates.apply')}</Button></>}</footer></section></PanelDialog>}
    <button className={`project-explorer-tab${projectExplorerVisible ? ' open' : ''}`} aria-label={t('proj.explorer')} onClick={() => setProjectExplorerVisible((value) => !value)}>{t('proj.explorer')}</button>
    {projectExplorerVisible && <aside className="project-explorer-dock" aria-label={t('proj.explorer')}><header><strong>{t('proj.explorer')}</strong><button aria-label={projectExplorerPinned ? t('menu.unpin') : t('menu.pin')} title={projectExplorerPinned ? t('menu.unpin') : t('menu.pin')} onClick={() => setProjectExplorerPinned((value) => !value)}>{projectExplorerPinned ? '📌' : '⌖'}</button><button aria-label={t('common.close')} onClick={() => setProjectExplorerVisible(false)}>×</button></header><Suspense fallback={<p role="status">Loading project tools…</p>}><SourceControlPanel projectExplorerMode /></Suspense></aside>}
  </main>

}

function MenuAction({ label, shortcut, onClick, disabled = false, checked, title }: { label: string; shortcut?: string; onClick?: () => void; disabled?: boolean; checked?: boolean; title?: string }): React.JSX.Element {
  return <button className="menu-action" disabled={disabled} title={title} onClick={(event) => { onClick?.(); event.currentTarget.closest('.menu-row')?.querySelectorAll('details[open]').forEach((item) => item.removeAttribute('open')) }}>
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
    const stored: unknown = JSON.parse(localStorage.getItem('tuxsql.documents') ?? 'null')
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

function FloatSqlDocument({ documentId, title, initialContents }: { documentId: string; title: string; initialContents: string }): React.JSX.Element {
  const { t } = useI18n()
  const [contents, setContents] = useState(initialContents)
  useEffect(() => window.tuxsql.onFloatSqlUpdate((updatedId, value) => {
    if (updatedId === documentId) setContents((current) => current === value ? current : value)
  }), [documentId])
  return <main className="float-sql-document"><header><strong>{title}</strong><span>{t('tabs.liveDocument')}</span></header><textarea aria-label={`${title} SQL editor`} spellCheck={false} value={contents} onChange={(event) => { const value = event.target.value; setContents(value); void window.tuxsql.floatSqlChange(documentId, value) }} /></main>
}
