import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultSettings, importSettingsFile, mergeSettings, normalizeShortcut, SettingsStore, validateSettings } from '../../src/modules/options/index.js'
const folders: string[] = []
async function temp(): Promise<string> { const folder = await mkdtemp(join(tmpdir(), 'dbforge-options-')); folders.push(folder); return folder }
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('Options settings', () => {
  it('fills defaults while migrating older settings and persists a versioned JSON file', async () => {
    const folder = await temp(); const store = new SettingsStore(join(folder, 'settings.json'))
    expect((await store.load()).settings).toEqual(defaultSettings)
    const saved = await store.save({ schemaVersion: 0, appearance: { theme: 'dark' }, editor: { fontSize: 16 } })
    expect(saved.schemaVersion).toBe(1); expect(saved.appearance.theme).toBe('dark'); expect(saved.appearance.accent).toBe(defaultSettings.appearance.accent); expect(saved.editor.fontSize).toBe(16)
    expect(JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'))).toEqual(saved)
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
  })
})
