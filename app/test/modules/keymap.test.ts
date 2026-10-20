import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defaultSettings } from '../../src/modules/options/types.js'
import { mergeSettings, validateSettings } from '../../src/modules/options/index.js'
import { findKeymapConflicts, keymapCommands } from '../../src/modules/keymap/registry.js'
import { enMessages, ptBrCatalog } from '../../src/renderer/src/i18n/specMessages.js'

describe('central keymap', () => {
  it('registers the confirmed SQL editor and debugger bindings', () => {
    expect(keymapCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'Execute SQL', shortcut: 'F5' }),
      expect.objectContaining({ command: 'Run Debugging', shortcut: 'Alt+F9' }),
      expect.objectContaining({ command: 'Run To Cursor', shortcut: 'Ctrl+F10' })
    ]))
    expect(findKeymapConflicts(keymapCommands)).toEqual([])
  })

  it('finds conflicts within the same context and with global bindings', () => {
    expect(findKeymapConflicts([
      { command: 'A', shortcut: 'Ctrl+K', context: 'Editor' },
      { command: 'B', shortcut: 'ctrl + k', context: 'Editor' },
      { command: 'C', shortcut: 'Ctrl+K', context: 'Debugger' }
    ])).toEqual([{ shortcut: 'ctrl+k', commands: ['A', 'B'] }])
    expect(findKeymapConflicts([
      { command: 'A', shortcut: 'Ctrl+K', context: 'Global' },
      { command: 'B', shortcut: 'Ctrl+K', context: 'Debugger' }
    ])).toHaveLength(1)
  })

  it('uses canonical defaults when upgrading saved bindings and validates collisions', () => {
    const old = mergeSettings({ ...defaultSettings, shortcuts: { scheme: 'default', bindings: [{ command: 'Execute SQL', shortcut: 'Ctrl+1', context: 'Editor' }] } })
    expect(old.shortcuts.bindings.length).toBe(keymapCommands.length)
    expect(old.shortcuts.bindings.find((item) => item.command === 'Execute SQL')?.shortcut).toBe('Ctrl+1')
    old.shortcuts.bindings.push({ command: 'Collision', shortcut: 'Ctrl+1', context: 'Global' })
    expect(() => validateSettings(old)).toThrow(/Shortcut conflict/)
  })
})

describe('UX translation catalogs', () => {
  it('covers all suggested UX keys in both supported catalogs', () => {
    const references = resolve(process.cwd(), '../document/ux')
    const expected = new Set<string>()
    for (const file of readdirSync(references).filter((name) => /^\d\d-.*\.md$/.test(name))) {
      const source = readFileSync(join(references, file), 'utf8')
      const section = source.match(/## Textos de interface[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? ''
      for (const line of section.split('\n')) {
        const cells = line.split('|')
        const keyCell = cells[3] ?? ''
        const groups = [...keyCell.matchAll(/`([^`]+)`/g)].map((match) => match[1])
        if (!groups.length) continue
        let prefix = ''
        for (const group of groups) {
          for (const raw of group.split('/')) {
            let key = raw.trim()
            if (key.startsWith('.')) key = `${prefix}${key.slice(1)}`
            if (/^[a-z][\w]*(?:\.[\w*{}]+)*$/.test(key)) {
              expected.add(key)
              prefix = `${key.slice(0, key.lastIndexOf('.') + 1)}`
            }
          }
        }
      }
    }
    expect(expected.size).toBeGreaterThanOrEqual(498)
    expect([...expected].filter((key) => typeof enMessages[key] !== 'string')).toEqual([])
    expect([...expected].filter((key) => typeof ptBrCatalog[key] !== 'string')).toEqual([])
    expect(Object.values(ptBrCatalog).every((message) => message.trim().length > 0)).toBe(true)
  })
})
