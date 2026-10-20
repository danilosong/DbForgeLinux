import { describe, expect, it } from 'vitest'
import { buildGridChange, parseSimpleSelect, validateGridValue, type EditableResult } from '../src/modules/grid-editing/index.js'

const descriptor: EditableResult = {
  database: 'demo', table: 'records', keyColumns: ['id'],
  columns: [
    { name: 'id', dataType: 'int', columnType: 'int', nullable: false, defaultValue: null, extra: '' },
    { name: 'name', dataType: 'varchar', columnType: 'varchar(80)', nullable: false, defaultValue: null, extra: '' },
    { name: 'note', dataType: 'text', columnType: 'text', nullable: true, defaultValue: null, extra: '' }
  ]
}

describe('grid editing', () => {
  it('recognizes only a simple single-table SELECT * and rejects joins', () => {
    expect(parseSimpleSelect('SELECT * FROM `demo`.`records` WHERE id = 1 LIMIT 20')).toEqual({ database: 'demo', table: 'records' })
    expect(parseSimpleSelect('SELECT * FROM records', 'demo')).toEqual({ database: 'demo', table: 'records' })
    expect(parseSimpleSelect('SELECT * FROM records JOIN users ON users.id = records.id', 'demo')).toBeUndefined()
  })
  it('generates parameterized statements with optimistic row values', () => {
    expect(buildGridChange({ kind: 'update', original: { id: 7, name: 'old', note: null }, values: { id: 7, name: 'new', note: null } }, descriptor)).toEqual({
      sql: 'UPDATE `demo`.`records` SET `name` = ? WHERE `id` <=> ? AND `name` <=> ? AND `note` <=> ?', values: ['new', 7, 'old', null]
    })
    expect(buildGridChange({ kind: 'delete', original: { id: 7, name: 'old', note: null } }, descriptor).sql).toMatch(/^DELETE FROM .* WHERE `id` <=> \? AND `name` <=> \? AND `note` <=> \?$/)
    expect(buildGridChange({ kind: 'insert', values: { name: 'new', note: null } }, descriptor)).toEqual({ sql: 'INSERT INTO `demo`.`records` (`name`, `note`) VALUES (?, ?)', values: ['new', null] })
  })
  it('validates nullability and numeric values before applying', () => {
    expect(validateGridValue(descriptor.columns[0], null)).toContain('NULL')
    expect(validateGridValue(descriptor.columns[0], 'nope')).toContain('valid int')
    expect(validateGridValue(descriptor.columns[2], null)).toBeUndefined()
  })
})
