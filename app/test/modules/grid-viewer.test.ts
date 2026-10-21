import { describe, expect, it } from 'vitest'
import { columnStatistics, formatGridCopy, generateGridScript, matchesGridCondition, quickPivot } from '../../src/modules/grid-viewer/index.js'

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
  it('neutralizes spreadsheet formulas, including after whitespace prefixes', () => {
    expect(formatGridCopy([{ value: '=1+1' }, { value: '\t@SUM(A1:A2)' }, { value: '-cmd' }, { value: '+1' }], ['value'], 'csv', undefined, false)).toBe("'=1+1\r\n'\t@SUM(A1:A2)\r\n'-cmd\r\n'+1")
  })

  it('calculates row/null/distinct/min/max statistics and quick aggregates', () => {
    expect(columnStatistics(rows, 'amount')).toEqual({ count: 3, nulls: 1, distinct: 2, min: '4', max: '6' })
    expect(quickPivot(rows, 'group', 'amount', 'sum')).toEqual([{ group: 'A', value: 10 }, { group: 'B', value: 0 }])
    expect(quickPivot(rows, 'group', 'id', 'count')).toEqual([{ group: 'A', value: 2 }, { group: 'B', value: 1 }])
    expect(quickPivot([{ group: 'empty', value: null }], 'group', 'value', 'min')).toEqual([{ group: 'empty', value: 0 }])
    expect(columnStatistics([{ value: 12n }, { value: 12n }, { value: 14n }], 'value').distinct).toBe(2)
  })

  it('builds safe selected-row scripts and evaluates quick filter comparisons', () => {
    const descriptor = { database: 'shop', table: 'items', keyColumns: ['id'], columns: [] }
    expect(generateGridScript(rows.slice(0, 2), ['id', 'group'], 'bulk-insert', descriptor)).toContain('VALUES\n  (1, \'A\'),\n  (2, \'A\')')
    expect(generateGridScript(rows.slice(0, 1), ['id', 'group'], 'update', descriptor)).toBe("UPDATE `shop`.`items` SET `group` = 'A' WHERE `id` = 1;")
    expect(generateGridScript(rows, ['id'], 'where-in', descriptor, 'id')).toContain('WHERE `id` IN (1, 2, 3)')
    expect(matchesGridCondition(4, 'gte', '4')).toBe(true)
    expect(matchesGridCondition('abc', 'ne', 'ABC')).toBe(true)
    expect(() => generateGridScript(rows, ['id'], 'update', { ...descriptor, keyColumns: [] })).toThrow('selected result key')
  })
})
