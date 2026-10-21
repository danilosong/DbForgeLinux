import { describe, expect, it } from 'vitest'
import { copySourceToTarget, serializeCompareArguments, swapCompareEndpoints } from '../../src/modules/data-compare/wizard.js'

const endpoints = { source: 'source-id', target: 'target-id', sourceDb: 'source_db', targetDb: 'target_db' }

describe('Data Compare wizard helpers', () => {
  it('copies the source connection and database to the target', () => {
    expect(copySourceToTarget(endpoints)).toEqual({ ...endpoints, target: 'source-id', targetDb: 'source_db' })
  })

  it('swaps both endpoint connections and databases', () => {
    expect(swapCompareEndpoints(endpoints)).toEqual({ source: 'target-id', target: 'source-id', sourceDb: 'target_db', targetDb: 'source_db' })
  })

  it('serializes saved comparison arguments as readable JSON', () => {
    expect(JSON.parse(serializeCompareArguments({ source: endpoints.source, options: { views: true } }))).toEqual({ source: 'source-id', options: { views: true } })
    expect(serializeCompareArguments({ source: endpoints.source, options: { views: true } })).toContain('\n  "source"')
  })
})
