import { describe, expect, it } from 'vitest'
import { closeDocumentFromLayout, createDocumentLayout, dockDirectionClass, findDocumentGroup, flattenDocumentGroups, mergeDocumentIntoGroup, moveDocumentToGroup, normalizeDockDirection, parseDocumentLayout, serializeDocumentLayout, setGroupRatio, splitDocumentGroup } from '../../src/modules/dock-layout.js'

describe('document docking layout model', () => {
  it('accepts directional targets and defaults malformed legacy dock directions', () => {
    for (const direction of ['left', 'right', 'top', 'bottom'] as const) {
      expect(normalizeDockDirection(direction)).toBe(direction)
      expect(dockDirectionClass(direction)).toBe(`dock-${direction}`)
    }
    expect(normalizeDockDirection(null)).toBe('right')
    expect(normalizeDockDirection('center')).toBe('right')
  })

  it('splits into directional groups and puts the dragged document on the requested edge', () => {
    const base = createDocumentLayout(['a', 'b'])
    for (const [direction, orientation, isFirst] of [['left', 'vertical', true], ['right', 'vertical', false], ['top', 'horizontal', true], ['bottom', 'horizontal', false]] as const) {
      const layout = splitDocumentGroup(base, 'a', 'b', direction, `new-${direction}`)
      expect(layout.root.type).toBe('split')
      if (layout.root.type !== 'split') continue
      expect(layout.root.orientation).toBe(orientation)
      expect(layout.root.first.type === 'group' ? layout.root.first.tabs : []).toEqual(isFirst ? ['b'] : ['a'])
      expect(findDocumentGroup(layout.root, 'b')?.activeTab).toBe('b')
    }
  })

  it('moves, merges and closes tabs while collapsing empty split groups', () => {
    const initial = splitDocumentGroup(createDocumentLayout(['a', 'b', 'c']), 'a', 'c', 'right', 'right-group')
    const right = findDocumentGroup(initial.root, 'c')!
    const moved = moveDocumentToGroup(initial, 'b', right.id)
    expect(findDocumentGroup(moved.root, 'b')?.tabs).toEqual(['c', 'b'])
    const merged = mergeDocumentIntoGroup(moved, 'a', 'c')
    expect(flattenDocumentGroups(merged.root)).toHaveLength(1)
    expect(findDocumentGroup(merged.root, 'a')?.tabs).toEqual(['c', 'b', 'a'])
    const closed = closeDocumentFromLayout(merged, 'a')!
    expect(findDocumentGroup(closed.root, 'a')).toBeUndefined()
    expect(findDocumentGroup(closed.root, 'c')?.activeTab).toBe('c')
  })

  it('persists ratios and validates layouts against currently open documents', () => {
    const split = splitDocumentGroup(createDocumentLayout(['a']), 'a', 'b', 'bottom', 'lower')
    if (split.root.type !== 'split') throw new Error('expected split')
    const resized = setGroupRatio(split, split.root.id, 0.73)
    const restored = parseDocumentLayout(JSON.parse(serializeDocumentLayout(resized)), ['a', 'b'])!
    expect(restored).toEqual(resized)
    expect(parseDocumentLayout(JSON.parse(serializeDocumentLayout(resized)), ['a'])?.root).toEqual({ type: 'group', id: 'group-1', tabs: ['a'], activeTab: 'a' })
    expect(setGroupRatio(resized, split.root.id, 1.4).root.type === 'split' && (setGroupRatio(resized, split.root.id, 1.4).root as { ratio: number }).ratio).toBe(0.9)
  })
})
