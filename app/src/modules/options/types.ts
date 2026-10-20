export type ThemeOption = 'auto' | 'light' | 'dark' | 'high-contrast'
export interface KeyBinding { command: string; shortcut: string; context: string }
export interface AppSettings {
  schemaVersion: 1
  environment: { confirmExit: boolean; restoreSession: boolean; recentFiles: number; autoSaveDrafts: boolean; autoSaveIntervalSeconds: number; successToasts: boolean; startup: 'last-workspace' | 'start-page' | 'empty' }
  appearance: { theme: ThemeOption; accent: string; density: 'compact' | 'comfortable'; uiZoom: number; reduceMotion: boolean }
  language: { locale: 'system' | 'en' | 'pt-BR' | 'es'; dateFormat: 'system' | 'iso'; decimalSeparator: 'system' | '.' | ',' }
  editor: { lineNumbers: boolean; folding: boolean; minimap: boolean; indentGuides: boolean; highlightCurrentLine: boolean; wordWrap: boolean; tabSize: number; insertSpaces: boolean; trimTrailingWhitespace: boolean; autoCloseBrackets: boolean; fontName: string; fontSize: number; lineHeight: number; ligatures: boolean; autoComplete: boolean; completionDelayMs: number; keywordCase: 'upper' | 'lower' | 'as-typed' }
  execution: { runSelectionOnly: boolean; onError: 'stop' | 'ask' | 'continue'; commandTimeoutSeconds: number; resultRowLimit: number; confirmDestructive: boolean; autoCommit: boolean; showWarnings: boolean }
  grid: { rowHeight: number; zebra: boolean; showBorders: boolean; alignNumbers: boolean; nullText: string; autoFit: boolean; copyHeaders: boolean; maxTextLength: number }
  connections: { connectionTimeoutSeconds: number; commandTimeoutSeconds: number; keepAliveSeconds: number; autoReconnect: boolean; storeCredentials: boolean }
  shortcuts: { scheme: 'default' | 'dbeaver' | 'ssms' | 'vscode'; bindings: KeyBinding[] }
}

export function normalizeShortcut(value: string): string { return value.trim().replace(/\s*\+\s*/g, '+').replace(/\s+/g, ' ').toLowerCase() }

export const defaultKeyBindings: KeyBinding[] = [
  { command: 'New SQL Document', shortcut: 'Ctrl+N', context: 'Global' },
  { command: 'Open SQL File', shortcut: 'Ctrl+O', context: 'Global' },
  { command: 'Save SQL', shortcut: 'Ctrl+S', context: 'Editor' },
  { command: 'Execute SQL', shortcut: 'F5', context: 'Editor' },
  { command: 'Format Document', shortcut: 'Ctrl+K Ctrl+D', context: 'Editor' },
  { command: 'Options', shortcut: 'Ctrl+,', context: 'Global' },
  { command: 'Find in Database', shortcut: 'Ctrl+Shift+F', context: 'Explorer' },
  { command: 'Find Invalid Objects', shortcut: '', context: 'Database' },
  { command: 'Source Control Manager', shortcut: 'Ctrl+Alt+G', context: 'Global' }
]

export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  environment: { confirmExit: true, restoreSession: true, recentFiles: 10, autoSaveDrafts: true, autoSaveIntervalSeconds: 30, successToasts: true, startup: 'start-page' },
  appearance: { theme: 'auto', accent: '#2f6fde', density: 'comfortable', uiZoom: 100, reduceMotion: false },
  language: { locale: 'system', dateFormat: 'system', decimalSeparator: 'system' },
  editor: { lineNumbers: true, folding: true, minimap: false, indentGuides: true, highlightCurrentLine: true, wordWrap: false, tabSize: 4, insertSpaces: true, trimTrailingWhitespace: false, autoCloseBrackets: true, fontName: 'monospace', fontSize: 13, lineHeight: 20, ligatures: false, autoComplete: true, completionDelayMs: 250, keywordCase: 'upper' },
  execution: { runSelectionOnly: false, onError: 'stop', commandTimeoutSeconds: 0, resultRowLimit: 1000, confirmDestructive: true, autoCommit: true, showWarnings: true },
  grid: { rowHeight: 26, zebra: true, showBorders: true, alignNumbers: true, nullText: 'NULL', autoFit: true, copyHeaders: true, maxTextLength: 10000 },
  connections: { connectionTimeoutSeconds: 15, commandTimeoutSeconds: 0, keepAliveSeconds: 0, autoReconnect: true, storeCredentials: true },
  shortcuts: { scheme: 'default', bindings: defaultKeyBindings.map((item) => ({ ...item })) }
}
