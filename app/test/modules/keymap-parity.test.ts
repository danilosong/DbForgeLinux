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
})
