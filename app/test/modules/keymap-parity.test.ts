import { describe, expect, it } from 'vitest'
import { keymapCommands } from '../../src/modules/keymap/registry.js'

describe('REA-confirmed keymap bindings', () => {
  it('registers the original two-stroke New Connection chord and key SQL actions', () => {
    expect(keymapCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'New Connection', shortcut: 'Ctrl+D Ctrl+N', context: 'Global' }),
      expect.objectContaining({ command: 'New SQL Document', shortcut: 'Ctrl+N', context: 'Global' }),
      expect.objectContaining({ command: 'Execute SQL', shortcut: 'F5', context: 'Editor' }),
      expect.objectContaining({ command: 'Format Document', shortcut: 'Ctrl+K Ctrl+D', context: 'Editor' })
    ]))
  })

  it('registers execute-to-cursor, debugger run-to-cursor, jump-pair, and parameter-info commands', () => {
    expect(keymapCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'Execute To Cursor', shortcut: 'Ctrl+Shift+F10', context: 'Editor' }),
      expect.objectContaining({ command: 'Run To Cursor', shortcut: 'Ctrl+F10', context: 'Debugger' }),
      expect.objectContaining({ command: 'Jump Between Syntax Pairs', shortcut: 'Ctrl+F12', context: 'Editor' }),
      expect.objectContaining({ command: 'Parameter Info', shortcut: 'Ctrl+K P', context: 'Editor' })
    ]))
  })
})
