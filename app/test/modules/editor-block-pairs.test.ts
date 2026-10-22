import { describe, expect, it } from 'vitest'
import { findBeginEndPair } from '../../src/modules/editor/blockPairs.js'

describe('SQL block pair navigation', () => {
  it('matches nested BEGIN/END blocks and skips END IF labels', () => {
    const sql = 'BEGIN\nIF TRUE THEN\n  BEGIN\n    SELECT 1;\n  END;\nEND IF;\nSELECT 2;\nEND;'
    const outerBegin = sql.indexOf('BEGIN')
    const outerEnd = sql.lastIndexOf('END')
    const innerBegin = sql.indexOf('BEGIN', outerBegin + 1)
    const innerEnd = sql.indexOf('END', innerBegin)
    expect(findBeginEndPair(sql, outerBegin)).toBe(outerEnd)
    expect(findBeginEndPair(sql, outerEnd)).toBe(outerBegin)
    expect(findBeginEndPair(sql, innerBegin)).toBe(innerEnd)
    expect(findBeginEndPair(sql, innerEnd)).toBe(innerBegin)
  })

  it('returns no pair for offsets outside a block keyword or an unmatched block', () => {
    expect(findBeginEndPair('BEGIN\nSELECT 1;', 0)).toBeUndefined()
    expect(findBeginEndPair('SELECT 1;', 0)).toBeUndefined()
  })
})
