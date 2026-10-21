export type ThemeOption = 'auto' | 'light' | 'dark' | 'high-contrast'
import { keymapCommands } from '../keymap/registry.js'
export interface KeyBinding { command: string; shortcut: string; context: string }
export interface AppSettings {
  schemaVersion: 1
  environment: { confirmExit: boolean; restoreSession: boolean; recentFiles: number; windowItems: number; showStatusBar: boolean; showSplash: boolean; showStartPage: boolean; autoSaveDrafts: boolean; autoSaveIntervalSeconds: number; successToasts: boolean; startup: 'last-workspace' | 'start-page' | 'empty' }
  appearance: { theme: ThemeOption; accent: string; density: 'compact' | 'comfortable'; uiZoom: number; reduceMotion: boolean }
  queryBuilder: { showGrid: boolean; gridSize: number; snapToGrid: boolean; shadows: boolean }
  dataComparison: { cacheFolder: 'system' | 'custom'; customCachePath: string; keyStrategy: 'none' | 'primary' | 'unique' }
  language: { locale: 'system' | 'en' | 'pt-BR' | 'es'; dateFormat: 'system' | 'iso'; decimalSeparator: 'system' | '.' | ',' }
  editor: { lineNumbers: boolean; folding: boolean; minimap: boolean; indentGuides: boolean; highlightCurrentLine: boolean; wordWrap: boolean; tabSize: number; insertSpaces: boolean; trimTrailingWhitespace: boolean; autoCloseBrackets: boolean; fontName: string; fontSize: number; lineHeight: number; ligatures: boolean; autoComplete: boolean; completionDelayMs: number; keywordCase: 'upper' | 'lower' | 'as-typed' }
  execution: { runSelectionOnly: boolean; onError: 'stop' | 'ask' | 'continue'; commandTimeoutSeconds: number; resultRowLimit: number; confirmDestructive: boolean; autoCommit: boolean; showWarnings: boolean }
  grid: { rowHeight: number; zebra: boolean; showBorders: boolean; alignNumbers: boolean; nullText: string; autoFit: boolean; copyHeaders: boolean; maxTextLength: number }
  connections: { connectionTimeoutSeconds: number; commandTimeoutSeconds: number; keepAliveSeconds: number; autoReconnect: boolean; storeCredentials: boolean }
  updater: { checkOnStartup: boolean; automatic: boolean; channel: 'auto' | 'dev' | 'release'; interval: 'startup' | 'daily'; ignoredVersion: string }
  shortcuts: { scheme: 'default' | 'dbeaver' | 'ssms' | 'vscode'; bindings: KeyBinding[] }
}

export function normalizeShortcut(value: string): string { return value.trim().replace(/\s*\+\s*/g, '+').replace(/\s+/g, ' ').toLowerCase() }

export const defaultKeyBindings: KeyBinding[] = keymapCommands.map((item) => ({ ...item }))

export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  environment: { confirmExit: true, restoreSession: true, recentFiles: 10, windowItems: 10, showStatusBar: true, showSplash: true, showStartPage: true, autoSaveDrafts: true, autoSaveIntervalSeconds: 30, successToasts: true, startup: 'start-page' },
  appearance: { theme: 'auto', accent: '#2f6fde', density: 'comfortable', uiZoom: 100, reduceMotion: false },
  queryBuilder: { showGrid: true, gridSize: 8, snapToGrid: true, shadows: true },
  dataComparison: { cacheFolder: 'system', customCachePath: '', keyStrategy: 'none' },
  language: { locale: 'system', dateFormat: 'system', decimalSeparator: 'system' },
  editor: { lineNumbers: true, folding: true, minimap: false, indentGuides: true, highlightCurrentLine: true, wordWrap: false, tabSize: 4, insertSpaces: true, trimTrailingWhitespace: false, autoCloseBrackets: true, fontName: 'monospace', fontSize: 13, lineHeight: 20, ligatures: false, autoComplete: true, completionDelayMs: 250, keywordCase: 'upper' },
  execution: { runSelectionOnly: false, onError: 'stop', commandTimeoutSeconds: 0, resultRowLimit: 1000, confirmDestructive: true, autoCommit: true, showWarnings: true },
  grid: { rowHeight: 26, zebra: true, showBorders: true, alignNumbers: true, nullText: 'NULL', autoFit: true, copyHeaders: true, maxTextLength: 10000 },
  connections: { connectionTimeoutSeconds: 15, commandTimeoutSeconds: 0, keepAliveSeconds: 0, autoReconnect: true, storeCredentials: true },
  updater: { checkOnStartup: true, automatic: false, channel: 'auto', interval: 'startup', ignoredVersion: '' },
  shortcuts: { scheme: 'default', bindings: defaultKeyBindings.map((item) => ({ ...item })) }
}
