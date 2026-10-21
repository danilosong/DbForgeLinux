import { describe, expect, it } from 'vitest'
import { dockDirectionClass, normalizeDockDirection } from '../../src/modules/dock-layout.js'

describe('dock direction layout', () => {
  it('accepts the four directional docking targets and maps each to its layout class', () => {
    for (const direction of ['left', 'right', 'top', 'bottom'] as const) {
      expect(normalizeDockDirection(direction)).toBe(direction)
      expect(dockDirectionClass(direction)).toBe(`dock-${direction}`)
    }
  })

  it('defaults invalid or missing saved layouts to the right dock', () => {
    expect(normalizeDockDirection(null)).toBe('right')
    expect(normalizeDockDirection('center')).toBe('right')
  })
})
