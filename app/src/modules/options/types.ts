export type ThemeOption = 'auto' | 'light' | 'dark' | 'high-contrast'
import { keymapCommands } from '../keymap/registry.js'
import { builtInFormatProfiles, type FormatProfileName, type SqlFormatProfile } from '../editor/formatProfiles.js'
export interface KeyBinding { command: string; shortcut: string; context: string }
export interface SqlAliasRule { condition: string; action: 'none' | 'short' | 'full' }
export interface AppSettings {
  schemaVersion: 2
  environment: { confirmExit: boolean; restoreSession: boolean; recentFiles: number; windowItems: number; showStatusBar: boolean; showSplash: boolean; showStartPage: boolean; autoSaveDrafts: boolean; autoSaveIntervalSeconds: number; successToasts: boolean; startup: 'last-workspace' | 'start-page' | 'empty' }
  appearance: { theme: ThemeOption; accent: string; density: 'compact' | 'comfortable'; uiZoom: number; reduceMotion: boolean; editorForeground: string; editorBackground: string; currentLineColor: string; keywordColor: string }
  queryBuilder: { showGrid: boolean; gridSize: number; snapToGrid: boolean; shadows: boolean }
  dataComparison: { cacheFolder: 'system' | 'custom'; customCachePath: string; keyStrategy: 'none' | 'primary' | 'unique' }
  language: { locale: 'system' | 'en' | 'pt-BR' | 'es'; dateFormat: 'system' | 'iso'; decimalSeparator: 'system' | '.' | ',' }
  editor: { lineNumbers: boolean; folding: boolean; minimap: boolean; indentGuides: boolean; highlightCurrentLine: boolean; wordWrap: boolean; tabSize: number; insertSpaces: boolean; trimTrailingWhitespace: boolean; autoCloseBrackets: boolean; fontName: string; fontSize: number; lineHeight: number; ligatures: boolean; autoComplete: boolean; completionDelayMs: number; keywordCase: 'upper' | 'lower' | 'as-typed'; virtualSpace: boolean; matchBrackets: boolean; glyphMargin: boolean; hideNavigationBarWhenEmpty: boolean; highlightOccurrences: boolean; autoCloseQuotes: boolean; indentStyle: 'none' | 'block' | 'smart'; collapseRegionsOnOpen: boolean; formatOnPaste: boolean; formatOnStatementEnd: boolean; formatOnType: boolean; rightMargin: number; completionSortKeywords: boolean; completionCyclic: boolean; completionFilter: 'prefix' | 'substring' | 'camelCase'; completionConfirmCharacters: string; qualifyColumnWithAlias: boolean; aliasQualifier: 'object' | 'schema-object' | 'none'; autoAlias: boolean; aliasUppercase: boolean; aliasUseAs: boolean; aliasRules: SqlAliasRule[]; identifierQuoting: 'always' | 'reserved' | 'needed'; activeFormatProfile: FormatProfileName; formatProfiles: SqlFormatProfile[] }
  execution: { runSelectionOnly: boolean; onError: 'stop' | 'ask' | 'continue'; commandTimeoutSeconds: number; resultRowLimit: number; confirmDestructive: boolean; autoCommit: boolean; showWarnings: boolean; warningScriptLimitKb: number; warningCategories: Record<'none' | 'dev' | 'test' | 'prod' | 'custom', { truncate: boolean; delete: boolean; update: boolean }> }
  documents: { sqlLayout: 'split' | 'combined'; showDataView: boolean; activateDataEditor: boolean; showRoutineParameters: boolean; stopOnFirstError: boolean; restoreIntervalMinutes: number; restoreSqlDocuments: boolean; restoreOtherDocuments: boolean; queryHistoryEnabled: boolean; queryHistoryMaxKb: number; queryHistoryRetentionDays: number }
  notifications: { longQuerySeconds: number; openTransactionSeconds: number; durationSeconds: number }
  smtp: { sender: string; host: string; port: number; timeoutSeconds: number; ssl: boolean; authentication: boolean; username: string }
  grid: { rowHeight: number; zebra: boolean; showBorders: boolean; alignNumbers: boolean; nullText: string; autoFit: boolean; copyHeaders: boolean; maxTextLength: number; pageSize: number; pagedByDefault: boolean; autoSearch: boolean; showRowNumbers: boolean; showDataTypes: boolean; lobEditorThreshold: number; readOnlyByDefault: boolean }
  explorer: { detailedColumnNames: boolean; showTableSize: boolean; openTableAs: 'select-data' | 'object-editor' | 'data-editor'; openRoutineAs: 'execute' | 'object-editor'; selectionMode: 'all' | 'first'; firstRows: number }
  connections: { connectionTimeoutSeconds: number; commandTimeoutSeconds: number; keepAliveSeconds: number; autoReconnect: boolean; storeCredentials: boolean }
  updater: { checkOnStartup: boolean; automatic: boolean; channel: 'auto' | 'dev' | 'release'; interval: 'startup' | 'daily'; ignoredVersion: string }
  shortcuts: { scheme: 'default' | 'dbeaver' | 'ssms' | 'vscode'; bindings: KeyBinding[] }
}

export function normalizeShortcut(value: string): string { return value.trim().replace(/\s*\+\s*/g, '+').replace(/\s+/g, ' ').toLowerCase() }

export const defaultKeyBindings: KeyBinding[] = keymapCommands.map((item) => ({ ...item }))

export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  environment: { confirmExit: true, restoreSession: true, recentFiles: 10, windowItems: 10, showStatusBar: true, showSplash: true, showStartPage: true, autoSaveDrafts: true, autoSaveIntervalSeconds: 30, successToasts: true, startup: 'start-page' },
  appearance: { theme: 'auto', accent: '#2f6fde', density: 'comfortable', uiZoom: 100, reduceMotion: false, editorForeground: '#202124', editorBackground: '#ffffff', currentLineColor: '#f1f5fb', keywordColor: '#315fc0' },
  queryBuilder: { showGrid: true, gridSize: 8, snapToGrid: true, shadows: true },
  dataComparison: { cacheFolder: 'system', customCachePath: '', keyStrategy: 'none' },
  language: { locale: 'system', dateFormat: 'system', decimalSeparator: 'system' },
  editor: { lineNumbers: true, folding: true, minimap: false, indentGuides: true, highlightCurrentLine: true, wordWrap: false, tabSize: 4, insertSpaces: true, trimTrailingWhitespace: false, autoCloseBrackets: true, fontName: 'monospace', fontSize: 13, lineHeight: 20, ligatures: false, autoComplete: true, completionDelayMs: 250, keywordCase: 'upper', virtualSpace: false, matchBrackets: true, glyphMargin: true, hideNavigationBarWhenEmpty: false, highlightOccurrences: true, autoCloseQuotes: true, indentStyle: 'smart', collapseRegionsOnOpen: false, formatOnPaste: false, formatOnStatementEnd: false, formatOnType: false, rightMargin: 80, completionSortKeywords: true, completionCyclic: true, completionFilter: 'substring', completionConfirmCharacters: ',; ', qualifyColumnWithAlias: true, aliasQualifier: 'object', autoAlias: true, aliasUppercase: false, aliasUseAs: true, aliasRules: [{ condition: '<dual>', action: 'none' }], identifierQuoting: 'needed', activeFormatProfile: 'Default', formatProfiles: structuredClone(builtInFormatProfiles) },
  execution: { runSelectionOnly: false, onError: 'stop', commandTimeoutSeconds: 0, resultRowLimit: 1000, confirmDestructive: true, autoCommit: true, showWarnings: true, warningScriptLimitKb: 5000, warningCategories: { none: { truncate: true, delete: true, update: true }, dev: { truncate: false, delete: false, update: false }, test: { truncate: true, delete: true, update: true }, prod: { truncate: true, delete: true, update: true }, custom: { truncate: true, delete: true, update: true } } },
  documents: { sqlLayout: 'split', showDataView: true, activateDataEditor: true, showRoutineParameters: true, stopOnFirstError: true, restoreIntervalMinutes: 5, restoreSqlDocuments: true, restoreOtherDocuments: true, queryHistoryEnabled: true, queryHistoryMaxKb: 1024, queryHistoryRetentionDays: 60 },
  notifications: { longQuerySeconds: 10, openTransactionSeconds: 0, durationSeconds: 7 },
  smtp: { sender: '', host: '', port: 25, timeoutSeconds: 100, ssl: false, authentication: false, username: '' },
  grid: { rowHeight: 26, zebra: true, showBorders: true, alignNumbers: true, nullText: 'NULL', autoFit: true, copyHeaders: true, maxTextLength: 10000, pageSize: 1000, pagedByDefault: true, autoSearch: false, showRowNumbers: true, showDataTypes: true, lobEditorThreshold: 200, readOnlyByDefault: true },
  explorer: { detailedColumnNames: false, showTableSize: true, openTableAs: 'select-data', openRoutineAs: 'object-editor', selectionMode: 'first', firstRows: 1000 },
  connections: { connectionTimeoutSeconds: 15, commandTimeoutSeconds: 0, keepAliveSeconds: 0, autoReconnect: true, storeCredentials: true },
  updater: { checkOnStartup: true, automatic: false, channel: 'auto', interval: 'startup', ignoredVersion: '' },
  shortcuts: { scheme: 'default', bindings: defaultKeyBindings.map((item) => ({ ...item })) }
}
