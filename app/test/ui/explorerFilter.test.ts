import { describe, expect, it } from 'vitest'
import { isValidExplorerRegex, matchesExplorerFilter } from '../../src/renderer/src/ui/components/explorerFilter.js'

describe('Database Explorer advanced filter', () => {
  it('supports regex searches across names and connection metadata', () => {
    expect(matchesExplorerFilter('Production db01.example.net', 'prod.*example', true)).toBe(true)
    expect(matchesExplorerFilter('Development localhost', '^prod', true)).toBe(false)
  })

  it('supports case sensitive matching when requested', () => {
    expect(matchesExplorerFilter('Orders', 'orders', true, false)).toBe(true)
    expect(matchesExplorerFilter('Orders', 'orders', true, true)).toBe(false)
  })

  it('marks malformed expressions invalid and safely matches nothing', () => {
    expect(isValidExplorerRegex('[')).toBe(false)
    expect(matchesExplorerFilter('anything', '[', true)).toBe(false)
  })
})
