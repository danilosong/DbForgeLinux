import { describe, expect, it } from 'vitest'
import { columnStatistics, formatGridCopy, quickPivot } from '../../src/modules/grid-viewer/index.js'

const rows = [{ id: 1, group: 'A', amount: 4 }, { id: 2, group: 'A', amount: 6 }, { id: 3, group: 'B', amount: null }]

describe('grid viewer helpers', () => {
  it('copies selected result data in CSV, JSON, INSERT, Markdown, HTML and TSV forms', () => {
    expect(formatGridCopy(rows.slice(0, 1), ['id', 'group'], 'csv')).toContain('id,group')
    expect(formatGridCopy(rows.slice(0, 1), ['id', 'group'], 'json')).toContain('"group": "A"')
    expect(formatGridCopy(rows.slice(0, 1), ['id', 'group'], 'tsv', undefined, false)).toBe('1\tA')
    expect(formatGridCopy(rows.slice(0, 1), ['id'], 'insert', { database: 'shop', table: 'items', keyColumns: [], columns: [] })).toBe('INSERT INTO `shop`.`items` (`id`) VALUES (1);')
    expect(formatGridCopy(rows.slice(0, 1), ['group'], 'markdown')).toContain('| A |')
    expect(formatGridCopy(rows.slice(0, 1), ['group'], 'html')).toContain('<td>A</td>')
    expect(formatGridCopy([{ amount: 9007199254740993n, blob: new Uint8Array([0, 255]) }], ['amount', 'blob'], 'json')).toContain('0x00ff')
  })

  it('calculates row/null/distinct/min/max statistics and quick aggregates', () => {
    expect(columnStatistics(rows, 'amount')).toEqual({ count: 3, nulls: 1, distinct: 2, min: '4', max: '6' })
    expect(quickPivot(rows, 'group', 'amount', 'sum')).toEqual([{ group: 'A', value: 10 }, { group: 'B', value: 0 }])
    expect(quickPivot(rows, 'group', 'id', 'count')).toEqual([{ group: 'A', value: 2 }, { group: 'B', value: 1 }])
    expect(quickPivot([{ group: 'empty', value: null }], 'group', 'value', 'min')).toEqual([{ group: 'empty', value: 0 }])
    expect(columnStatistics([{ value: 12n }, { value: 12n }, { value: 14n }], 'value').distinct).toBe(2)
  })
})
