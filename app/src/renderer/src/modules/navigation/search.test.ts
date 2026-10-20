import { describe, expect, it } from 'vitest'
import { findTextMatches } from './search.js'

describe('findTextMatches', () => {
  it('supports case-insensitive plain text and reports line positions', () => {
    expect(findTextMatches('select a;\nSELECT b;', 'select').map(({ line, column }) => [line, column])).toEqual([[1, 1], [2, 1]])
  })
  it('supports regular expressions and safely ignores invalid expressions', () => {
    expect(findTextMatches('id1 id22', 'id\\d+', { regex: true }).map((match) => match.text)).toEqual(['id1 id22', 'id1 id22'])
    expect(findTextMatches('abc', '[', { regex: true })).toEqual([])
  })
  it('limits results', () => expect(findTextMatches('a a a', 'a', { limit: 2 })).toHaveLength(2))
})
