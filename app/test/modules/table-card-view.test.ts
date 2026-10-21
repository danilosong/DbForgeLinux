import { describe, expect, it } from 'vitest'
import { formatCardValue, tableRecordCard } from '../../src/modules/object-editors/card-view.js'

describe('table designer card view model', () => {
  it('turns a row into an ordered vertical field list and formats nullable values', () => {
    expect(tableRecordCard({ id: 3, label: null })).toEqual([{ name: 'id', value: 3 }, { name: 'label', value: null }])
    expect(formatCardValue(null)).toBe('NULL')
    expect(formatCardValue(undefined)).toBe('—')
  })
})
