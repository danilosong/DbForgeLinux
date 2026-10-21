import { describe, expect, it } from 'vitest'
import { findBookmark, toggleBookmark, toggleOutlining } from '../../src/modules/editor-navigation.js'

describe('SQL editor bookmarks and outlining', () => {
  it('toggles a bookmark without mutating the previous document state', () => {
    const existing = new Set([2, 8])
    expect([...toggleBookmark(existing, 5)]).toEqual([2, 8, 5])
    expect([...toggleBookmark(existing, 2)]).toEqual([8])
    expect([...existing]).toEqual([2, 8])
    expect([...toggleBookmark(existing, 0)]).toEqual([2, 8])
  })

  it('cycles next and previous navigation and wraps at either end', () => {
    const bookmarks = new Set([3, 7, 11])
    expect(findBookmark(bookmarks, 7, 'next')).toBe(11)
    expect(findBookmark(bookmarks, 11, 'next')).toBe(3)
    expect(findBookmark(bookmarks, 7, 'previous')).toBe(3)
    expect(findBookmark(bookmarks, 3, 'previous')).toBe(11)
    expect(findBookmark([], 1, 'next')).toBeUndefined()
  })

  it('alternates between folding and unfolding all regions', () => {
    expect(toggleOutlining(false)).toBe(true)
    expect(toggleOutlining(true)).toBe(false)
  })
})
