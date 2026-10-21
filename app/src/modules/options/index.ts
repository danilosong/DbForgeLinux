import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { defaultSettings, type AppSettings, type KeyBinding } from './types.js'
import { findKeymapConflicts } from '../keymap/registry.js'
import { formatProfileNames } from '../editor/formatProfiles.js'

export { defaultKeyBindings, defaultSettings, normalizeShortcut } from './types.js'
export type { AppSettings, KeyBinding, ThemeOption } from './types.js'

export function mergeSettings(value: unknown): AppSettings {
  const data = value && typeof value === 'object' ? value as Partial<AppSettings> : {}
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > 2) throw new Error(`Settings schema ${data.schemaVersion} is newer than supported schema 2.`)
  const storedBindings = Array.isArray(data.shortcuts?.bindings) ? data.shortcuts.bindings.filter(isBinding).map((item) => ({ ...item })) : []
  const bindings = defaultSettings.shortcuts.bindings.map((defaultBinding) => storedBindings.find((item) => item.command === defaultBinding.command) ?? { ...defaultBinding })
  bindings.push(...storedBindings.filter((item) => !bindings.some((defaultBinding) => defaultBinding.command === item.command)))
  const merged: AppSettings = {
    schemaVersion: 2,
    environment: { ...defaultSettings.environment, ...safeObject(data.environment) },
    appearance: { ...defaultSettings.appearance, ...safeObject(data.appearance) },
    queryBuilder: { ...defaultSettings.queryBuilder, ...safeObject(data.queryBuilder) },
    dataComparison: { ...defaultSettings.dataComparison, ...safeObject(data.dataComparison) },
    language: { ...defaultSettings.language, ...safeObject(data.language) },
    editor: { ...defaultSettings.editor, ...safeObject(data.editor) },
    execution: { ...defaultSettings.execution, ...safeObject(data.execution), warningCategories: mergeWarningCategories(data.execution?.warningCategories) },
    output: { ...defaultSettings.output, ...safeObject(data.output) },
    documents: { ...defaultSettings.documents, ...safeObject(data.documents) },
    notifications: { ...defaultSettings.notifications, ...safeObject(data.notifications) },
    smtp: { ...defaultSettings.smtp, ...safeObject(data.smtp) },
    grid: { ...defaultSettings.grid, ...safeObject(data.grid) },
    explorer: { ...defaultSettings.explorer, ...safeObject(data.explorer) },
    connections: { ...defaultSettings.connections, ...safeObject(data.connections) },
    updater: { ...defaultSettings.updater, ...safeObject(data.updater) },
    shortcuts: { ...defaultSettings.shortcuts, ...safeObject(data.shortcuts), bindings }
  }
  validateSettings(merged)
  return merged
}

function mergeWarningCategories(value: unknown): AppSettings['execution']['warningCategories'] {
  const input = safeObject(value)
  return Object.fromEntries(Object.entries(defaultSettings.execution.warningCategories).map(([category, defaults]) => [category, { ...defaults, ...safeObject(input[category]) }])) as AppSettings['execution']['warningCategories']
}

function safeObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function isBinding(value: unknown): value is KeyBinding {
  if (!value || typeof value !== 'object') return false
  const binding = value as Partial<KeyBinding>
  return typeof binding.command === 'string' && typeof binding.shortcut === 'string' && typeof binding.context === 'string'
}

export function validateSettings(settings: AppSettings): void {
  if (settings.schemaVersion !== 2) throw new Error('Unsupported settings schema version.')
  const bounded = (value: number, min: number, max: number, name: string): void => { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is out of range.`) }
  bounded(settings.environment.recentFiles, 0, 100, 'Recent files')
  bounded(settings.environment.windowItems, 0, 100, 'Window menu items')
  bounded(settings.environment.autoSaveIntervalSeconds, 5, 3600, 'Autosave interval')
  bounded(settings.appearance.uiZoom, 80, 200, 'UI zoom')
  bounded(settings.editor.tabSize, 1, 16, 'Tab size')
  bounded(settings.editor.fontSize, 8, 32, 'Font size')
  bounded(settings.editor.lineHeight, 12, 60, 'Line height')
  bounded(settings.editor.completionDelayMs, 0, 5000, 'Completion delay')
  bounded(settings.editor.rightMargin, 40, 240, 'Editor right margin')
  bounded(settings.execution.commandTimeoutSeconds, 0, 86400, 'Command timeout')
  bounded(settings.execution.resultRowLimit, 0, 1000000, 'Result row limit')
  bounded(settings.execution.warningScriptLimitKb, 1, 100000, 'Warning analysis limit')
  bounded(settings.documents.restoreIntervalMinutes, 1, 1440, 'Restore interval')
  bounded(settings.documents.queryHistoryMaxKb, 1, 102400, 'Query history script limit')
  bounded(settings.documents.queryHistoryRetentionDays, 0, 36500, 'Query history retention')
  bounded(settings.notifications.longQuerySeconds, 0, 86400, 'Long query notification threshold')
  bounded(settings.notifications.openTransactionSeconds, 0, 86400, 'Open transaction notification threshold')
  bounded(settings.notifications.durationSeconds, 1, 300, 'Notification duration')
  bounded(settings.smtp.port, 1, 65535, 'SMTP port')
  bounded(settings.smtp.timeoutSeconds, 1, 3600, 'SMTP timeout')
  if (!['split', 'combined'].includes(settings.documents.sqlLayout)) throw new Error('Invalid SQL document layout.')
  if (settings.smtp.sender.length > 254 || settings.smtp.host.length > 253 || settings.smtp.username.length > 254) throw new Error('SMTP settings are too long.')
  for (const flags of Object.values(settings.execution.warningCategories)) if (typeof flags.truncate !== 'boolean' || typeof flags.delete !== 'boolean' || typeof flags.update !== 'boolean') throw new Error('Invalid execution warning category.')
  bounded(settings.grid.rowHeight, 18, 60, 'Grid row height')
  bounded(settings.grid.maxTextLength, 100, 1000000, 'Grid text length')
  bounded(settings.grid.pageSize, 1, 100000, 'Grid page size')
  bounded(settings.grid.lobEditorThreshold, 1, 1000000, 'LOB editor threshold')
  bounded(settings.explorer.firstRows, 1, 1000000, 'Explorer row limit')
  if (!['select-data', 'object-editor', 'data-editor'].includes(settings.explorer.openTableAs) || !['execute', 'object-editor'].includes(settings.explorer.openRoutineAs) || !['all', 'first'].includes(settings.explorer.selectionMode)) throw new Error('Invalid Database Explorer settings.')
  bounded(settings.queryBuilder.gridSize, 2, 64, 'Query Builder grid size')
  bounded(settings.connections.connectionTimeoutSeconds, 1, 600, 'Connection timeout')
  bounded(settings.connections.commandTimeoutSeconds, 0, 86400, 'Connection command timeout')
  if (!['auto', 'dev', 'release'].includes(settings.updater.channel)) throw new Error('Invalid update channel.')
  if (!['none', 'block', 'smart'].includes(settings.editor.indentStyle) || !['prefix', 'substring', 'camelCase'].includes(settings.editor.completionFilter) || !['object', 'schema-object', 'none'].includes(settings.editor.aliasQualifier) || !['always', 'reserved', 'needed'].includes(settings.editor.identifierQuoting)) throw new Error('Invalid editor configuration.')
  if (settings.editor.activeFormatProfile.length > 80 || (!formatProfileNames.includes(settings.editor.activeFormatProfile as typeof formatProfileNames[number]) && settings.editor.activeFormatProfile !== 'Custom' && !settings.editor.formatProfiles.some((profile) => profile.name === settings.editor.activeFormatProfile))) throw new Error('Invalid active SQL format profile.')
  if (!Array.isArray(settings.editor.formatProfiles) || settings.editor.formatProfiles.length > 32 || settings.editor.formatProfiles.some((profile) => !profile || typeof profile.name !== 'string' || profile.name.length > 80 || !['upper', 'lower'].includes(profile.keywordCase) || ![2, 4].includes(profile.indentSize) || !['after', 'before'].includes(profile.commaStyle))) throw new Error('Invalid SQL format profiles.')
  if (!Array.isArray(settings.editor.aliasRules) || settings.editor.aliasRules.length > 100 || settings.editor.aliasRules.some((rule) => !rule || typeof rule.condition !== 'string' || rule.condition.length > 160 || !['none', 'short', 'full'].includes(rule.action))) throw new Error('Invalid SQL alias rules.')
  if (settings.editor.completionConfirmCharacters.length > 64) throw new Error('Completion confirmation character list is too long.')
  if (!['startup', 'daily'].includes(settings.updater.interval)) throw new Error('Invalid update interval.')
  if (settings.updater.ignoredVersion.length > 40 || !/^[\w.+-]*$/.test(settings.updater.ignoredVersion)) throw new Error('Invalid ignored update version.')
  if (!/^#[0-9a-f]{6}$/i.test(settings.appearance.accent)) throw new Error('Accent color must be a six digit hex color.')
  for (const [name, color] of Object.entries({ foreground: settings.appearance.editorForeground, background: settings.appearance.editorBackground, currentLine: settings.appearance.currentLineColor, keyword: settings.appearance.keywordColor })) if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Editor ${name} color must be a six digit hex color.`)
  if (!['auto', 'light', 'dark', 'high-contrast'].includes(settings.appearance.theme)) throw new Error('Invalid theme.')
  if (!['system', 'custom'].includes(settings.dataComparison.cacheFolder) || !['none', 'primary', 'unique'].includes(settings.dataComparison.keyStrategy)) throw new Error('Invalid Data Comparison settings.')
  if (settings.dataComparison.customCachePath.length > 4096) throw new Error('Data Comparison cache path is too long.')
  if (settings.dataComparison.cacheFolder === 'custom' && settings.dataComparison.customCachePath && !isAbsolute(settings.dataComparison.customCachePath)) throw new Error('Custom Data Comparison cache path must be absolute.')
  if (!['system', 'en', 'pt-BR', 'es'].includes(settings.language.locale)) throw new Error('Invalid language.')
  for (const item of settings.shortcuts.bindings) {
    if (!item.command.trim() || !item.context.trim()) throw new Error('Shortcut command and context are required.')
  }
  const conflict = findKeymapConflicts(settings.shortcuts.bindings)[0]
  if (conflict) throw new Error(`Shortcut conflict: ${conflict.shortcut} is assigned to ${conflict.commands.join(' and ')}.`)
}

export class SettingsStore {
  constructor(readonly filePath: string) {}
  async load(): Promise<{ settings: AppSettings; warning?: string }> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      return { settings: mergeSettings(value) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { settings: mergeSettings(defaultSettings) }
      const backup = `${this.filePath}.bak`
      try { await rename(this.filePath, backup) } catch { /* Keep defaults available if the file cannot be moved. */ }
      return { settings: mergeSettings(defaultSettings), warning: `Settings file was invalid and moved to ${backup}.` }
    }
  }
  async save(value: unknown): Promise<AppSettings> {
    const settings = mergeSettings(value)
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporary = join(dirname(this.filePath), `.settings-${process.pid}-${Date.now()}.tmp`)
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.filePath)
    return settings
  }
  async reset(): Promise<AppSettings> { return this.save(defaultSettings) }
}

export async function importSettingsFile(filePath: string, store: SettingsStore): Promise<AppSettings> {
  if ((await stat(filePath)).size > 5 * 1024 * 1024) throw new Error('Settings file exceeds the 5 MB safety limit.')
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  return store.save(parsed)
}
