import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultSettings, importSettingsFile, mergeSettings, normalizeShortcut, SettingsStore, validateSettings } from '../../src/modules/options/index.js'
const folders: string[] = []
async function temp(): Promise<string> { const folder = await mkdtemp(join(tmpdir(), 'tuxsql-options-')); folders.push(folder); return folder }
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('Options settings', () => {
  it('matches confirmed editor, startup, Explorer, and Profiler defaults while keeping data read-only', () => {
    expect(defaultSettings.environment.startup).toBe('last-workspace')
    expect(defaultSettings.editor).toMatchObject({ lineNumbers: false, tabSize: 2, insertSpaces: true, completionDelayMs: 200, completionConfirmCharacters: '', qualifyColumnWithAlias: true, formatOnType: true, rightMargin: 80 })
    expect(defaultSettings.grid).toMatchObject({ readOnlyByDefault: true, pageSize: 1000 })
    expect(defaultSettings.explorer.openTableAs).toBe('object-editor')
    expect(defaultSettings.queryBuilder.gridSize).toBe(8)
    expect(defaultSettings.profiler.historyLimit).toBe(10)
    expect(mergeSettings({ profiler: { historyLimit: 12 } }).profiler.historyLimit).toBe(12)
    expect(() => mergeSettings({ profiler: { historyLimit: 0 } })).toThrow('Profiler history limit')
  })

  it('fills defaults while migrating older settings and persists a versioned JSON file', async () => {
    const folder = await temp(); const store = new SettingsStore(join(folder, 'settings.json'))
    expect((await store.load()).settings).toEqual(defaultSettings)
    const saved = await store.save({ schemaVersion: 0, appearance: { theme: 'dark' }, editor: { fontSize: 16 } })
    expect(saved.schemaVersion).toBe(2); expect(saved.appearance.theme).toBe('dark'); expect(saved.appearance.accent).toBe(defaultSettings.appearance.accent); expect(saved.editor.fontSize).toBe(16)
    expect(JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'))).toEqual(saved)
    expect(saved.documents.restoreIntervalMinutes).toBe(5)
    expect(saved.notifications.longQuerySeconds).toBe(10)
    expect(saved.execution.warningCategories.prod.truncate).toBe(true)
    expect(saved.execution.warningCategories.sandbox.delete).toBe(true)
  })
  it('moves invalid settings to a backup and loads defaults', async () => {
    const folder = await temp(); const file = join(folder, 'settings.json'); await writeFile(file, '{broken')
    const result = await new SettingsStore(file).load()
    expect(result.settings).toEqual(defaultSettings); expect(result.warning).toContain('.bak'); expect(await readFile(`${file}.bak`, 'utf8')).toBe('{broken')
  })
  it('rejects a corrupted imported JSON file without replacing active settings', async () => {
    const folder = await temp(); const store = new SettingsStore(join(folder, 'settings.json'))
    await store.save({ appearance: { theme: 'dark' } })
    const imported = join(folder, 'import.json'); await writeFile(imported, '{broken')
    await expect(importSettingsFile(imported, store)).rejects.toThrow()
    expect((await store.load()).settings.appearance.theme).toBe('dark')
  })
  it('validates ranges and detects conflicting shortcut combinations by context', () => {
    expect(normalizeShortcut(' Ctrl + Shift + F ')).toBe('ctrl+shift+f')
    expect(() => mergeSettings({ shortcuts: { bindings: [{ command: 'A', shortcut: 'Ctrl+F', context: 'Editor' }, { command: 'B', shortcut: 'ctrl + f', context: 'Editor' }] } })).toThrow('Shortcut conflict')
    validateSettings(mergeSettings(defaultSettings))
    expect(() => mergeSettings({ appearance: { uiZoom: 240 } })).toThrow('UI zoom')
    expect(() => mergeSettings({ notifications: { durationSeconds: 0 } })).toThrow('Notification duration')
    expect(() => mergeSettings({ smtp: { port: 70000 } })).toThrow('SMTP port')
  })
  it('migrates and validates Data Comparison and Query Builder pages', () => {
    const migrated = mergeSettings({ dataComparison: { cacheFolder: 'custom', customCachePath: '/tmp/compare-cache', keyStrategy: 'primary' }, queryBuilder: { showGrid: false, gridSize: 16, snapToGrid: false, shadows: false } })
    expect(migrated.dataComparison).toEqual({ cacheFolder: 'custom', customCachePath: '/tmp/compare-cache', keyStrategy: 'primary' })
    expect(migrated.queryBuilder).toEqual({ showGrid: false, gridSize: 16, snapToGrid: false, shadows: false })
    expect(() => mergeSettings({ queryBuilder: { gridSize: 100 } })).toThrow('Query Builder grid size')
    expect(() => mergeSettings({ dataComparison: { keyStrategy: 'arbitrary' } })).toThrow('Data Comparison settings')
    expect(() => mergeSettings({ dataComparison: { cacheFolder: 'custom', customCachePath: 'relative/cache' } })).toThrow('must be absolute')
  })
  it('migrates Data Editor and Database Explorer defaults with bounded page and selection sizes', () => {
    const migrated = mergeSettings({ grid: { pageSize: 250, showDataTypes: false }, explorer: { selectionMode: 'first', firstRows: 250 } })
    expect(migrated.grid.pageSize).toBe(250)
    expect(migrated.grid.showDataTypes).toBe(false)
    expect(migrated.explorer.openTableAs).toBe(defaultSettings.explorer.openTableAs)
    expect(migrated.explorer.firstRows).toBe(250)
    expect(() => mergeSettings({ grid: { pageSize: 0 } })).toThrow('Grid page size')
    expect(() => mergeSettings({ explorer: { selectionMode: 'unknown' } })).toThrow('Invalid Database Explorer settings')
  })
  it('migrates editor completion, alias, formatting profiles, and output preferences', () => {
    const migrated = mergeSettings({
      editor: { formatOnPaste: true, completionFilter: 'camelCase', activeFormatProfile: 'Compact', aliasRules: [{ condition: '<Sales>.<tbl_*>', action: 'none' }] },
      output: { showTimestamps: false, sqlLogEnabled: true }
    })
    expect(migrated.editor).toMatchObject({ formatOnPaste: true, completionFilter: 'camelCase', activeFormatProfile: 'Compact', aliasRules: [{ condition: '<Sales>.<tbl_*>', action: 'none' }] })
    expect(migrated.output).toEqual({ showTimestamps: false, sqlLogEnabled: true })
    expect(() => mergeSettings({ editor: { rightMargin: 500 } })).toThrow(/right margin/i)
    expect(() => mergeSettings({ editor: { aliasRules: [{ condition: '<*>', action: 'invalid' }] } })).toThrow(/alias rules/i)
  })
})
