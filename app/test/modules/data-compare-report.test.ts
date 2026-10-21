import { describe, expect, it } from 'vitest'
import { buildComparisonReport } from '../../src/modules/data-compare/report.js'
import type { DataCompareDifference } from '../../src/modules/data-compare/types.js'

const rows: DataCompareDifference[] = [
  { kind: 'different', objectName: 'items', key: { id: 1 }, source: { name: '=SUM(A1:A2)' }, target: { name: 'old' }, changedColumns: ['name'] },
  { kind: 'same', objectName: 'items', key: { id: 2 }, source: { name: '<ok>' }, target: { name: '<ok>' }, changedColumns: [] }
]

describe('Data Compare report export', () => {
  it('supports filtered CSV, Excel-readable HTML, and escaped HTML reports', () => {
    expect(buildComparisonReport(rows, 'csv', 'different')).toContain('""=SUM(A1:A2)""')
    expect(buildComparisonReport(rows, 'excel')).toContain('schemas-microsoft-com:office:excel')
    expect(buildComparisonReport(rows, 'html')).toContain('&lt;ok&gt;')
  })

  it('limits selected reports to the selected row identities', () => {
    const selected = new Set(['items\u0000{"id":2}'])
    const report = buildComparisonReport(rows, 'csv', 'selected', selected)
    expect(report).toContain('2')
    expect(report).not.toContain("'=SUM(A1:A2)")
  })
})
