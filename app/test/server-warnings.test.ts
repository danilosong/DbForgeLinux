import { describe, expect, it } from 'vitest'
import { formatServerWarnings } from '../src/modules/sql/serverWarnings.js'

describe('formatServerWarnings', () => {
  it('keeps server level, code, message and statement context', () => {
    expect(formatServerWarnings([{ Level: 'Warning', Code: 1265, Message: 'Data truncated' }], 2))
      .toEqual(['Warning · statement 2 · Warning 1265: Data truncated'])
  })

  it('handles incomplete server warning rows', () => {
    expect(formatServerWarnings([{}], 1)).toEqual(['Warning · statement 1 · Warning: Server reported a warning.'])
  })
})
