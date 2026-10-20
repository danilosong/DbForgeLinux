import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defaultSettings, normalizeShortcut, type AppSettings, type KeyBinding } from './types.js'

export { defaultKeyBindings, defaultSettings, normalizeShortcut } from './types.js'
export type { AppSettings, KeyBinding, ThemeOption } from './types.js'

export function mergeSettings(value: unknown): AppSettings {
  const data = value && typeof value === 'object' ? value as Partial<AppSettings> : {}
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > 1) throw new Error(`Settings schema ${data.schemaVersion} is newer than supported schema 1.`)
  const bindings = Array.isArray(data.shortcuts?.bindings) ? data.shortcuts.bindings.filter(isBinding).map((item) => ({ ...item })) : defaultSettings.shortcuts.bindings.map((item) => ({ ...item }))
  const merged: AppSettings = {
    schemaVersion: 1,
    environment: { ...defaultSettings.environment, ...safeObject(data.environment) },
    appearance: { ...defaultSettings.appearance, ...safeObject(data.appearance) },
    language: { ...defaultSettings.language, ...safeObject(data.language) },
    editor: { ...defaultSettings.editor, ...safeObject(data.editor) },
    execution: { ...defaultSettings.execution, ...safeObject(data.execution) },
    grid: { ...defaultSettings.grid, ...safeObject(data.grid) },
    connections: { ...defaultSettings.connections, ...safeObject(data.connections) },
    shortcuts: { ...defaultSettings.shortcuts, ...safeObject(data.shortcuts), bindings }
  }
  validateSettings(merged)
  return merged
}

function safeObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function isBinding(value: unknown): value is KeyBinding {
  if (!value || typeof value !== 'object') return false
  const binding = value as Partial<KeyBinding>
  return typeof binding.command === 'string' && typeof binding.shortcut === 'string' && typeof binding.context === 'string'
}

export function validateSettings(settings: AppSettings): void {
  if (settings.schemaVersion !== 1) throw new Error('Unsupported settings schema version.')
  const bounded = (value: number, min: number, max: number, name: string): void => { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is out of range.`) }
  bounded(settings.environment.recentFiles, 0, 100, 'Recent files')
  bounded(settings.environment.autoSaveIntervalSeconds, 5, 3600, 'Autosave interval')
  bounded(settings.appearance.uiZoom, 80, 200, 'UI zoom')
  bounded(settings.editor.tabSize, 1, 16, 'Tab size')
  bounded(settings.editor.fontSize, 8, 32, 'Font size')
  bounded(settings.editor.lineHeight, 12, 60, 'Line height')
  bounded(settings.editor.completionDelayMs, 0, 5000, 'Completion delay')
  bounded(settings.execution.commandTimeoutSeconds, 0, 86400, 'Command timeout')
  bounded(settings.execution.resultRowLimit, 0, 1000000, 'Result row limit')
  bounded(settings.grid.rowHeight, 18, 60, 'Grid row height')
  bounded(settings.grid.maxTextLength, 100, 1000000, 'Grid text length')
  bounded(settings.connections.connectionTimeoutSeconds, 1, 600, 'Connection timeout')
  bounded(settings.connections.commandTimeoutSeconds, 0, 86400, 'Connection command timeout')
  if (!/^#[0-9a-f]{6}$/i.test(settings.appearance.accent)) throw new Error('Accent color must be a six digit hex color.')
  if (!['auto', 'light', 'dark', 'high-contrast'].includes(settings.appearance.theme)) throw new Error('Invalid theme.')
  if (!['system', 'en', 'pt-BR', 'es'].includes(settings.language.locale)) throw new Error('Invalid language.')
  const seen = new Map<string, string>()
  for (const item of settings.shortcuts.bindings) {
    if (!item.command.trim() || !item.context.trim()) throw new Error('Shortcut command and context are required.')
    const shortcut = normalizeShortcut(item.shortcut)
    if (!shortcut) continue
    const key = `${item.context.toLowerCase()}:${shortcut}`
    const conflict = seen.get(key)
    if (conflict && conflict !== item.command) throw new Error(`Shortcut conflict: ${item.shortcut} is assigned to ${conflict} and ${item.command}.`)
    seen.set(key, item.command)
  }
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
