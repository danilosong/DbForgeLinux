import { describe, expect, it } from 'vitest'
import { effectiveCommandTimeoutSeconds, validateSqlExecutionOptions } from '../../src/modules/options/sqlExecution.js'
import { spoolLimitedRows } from '../../src/modules/options/streamResult.js'

describe('SQL execution settings', () => {
  it('uses the smallest finite nonzero timeout and treats zero as unlimited', () => {
    expect(effectiveCommandTimeoutSeconds(0, 30, 10, 20)).toBe(10)
    expect(effectiveCommandTimeoutSeconds(0, 0)).toBe(0)
  })

  it('validates IPC timeout and row limit values', () => {
    expect(validateSqlExecutionOptions({ commandTimeoutSeconds: 5, profileCommandTimeoutSeconds: 10, resultRowLimit: 1000 })).toEqual({ commandTimeoutSeconds: 5, profileCommandTimeoutSeconds: 10, resultRowLimit: 1000 })
    expect(() => validateSqlExecutionOptions({ commandTimeoutSeconds: -1, resultRowLimit: 1 })).toThrow('Invalid SQL command timeout.')
    expect(() => validateSqlExecutionOptions({ commandTimeoutSeconds: 1, resultRowLimit: 1000001 })).toThrow('Invalid SQL result row limit.')
  })

  it('spools only the configured prefix, drains the stream, and detects truncation', async () => {
    let produced = 0
    let stored = 0
    async function* rows(): AsyncIterable<Record<string, unknown>> { for (let index = 0; index < 200000; index++) { produced++; yield { n: index } } }
    const summary = await spoolLimitedRows(rows(), 1000, async () => { stored++ })
    expect(summary).toEqual({ columns: ['n'], rowCount: 1000, truncated: true })
    expect(stored).toBe(1000)
    expect(produced).toBe(200000)
  })
})
