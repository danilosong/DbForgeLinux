import { describe, expect, it } from 'vitest'
import { assertSchemaUpdateScript } from '../../src/modules/schema/compare.js'
import { hasNarrowingChanges, isColumnNarrowing, isDestructiveSchemaScript } from '../../src/modules/schema/destructive.js'
import type { DatabaseModel, TableModel } from '../../src/modules/schema/model.js'

const column = (type: string, nullable = false) => ({ name: 'value', type, nullable })
const table = (columns: TableModel['columns']): TableModel => ({ kind: 'table', name: 'items', columns, indexes: [], foreignKeys: [], checks: [] })
const model = (columns: TableModel['columns']): DatabaseModel => ({ kind: 'database', name: 'target', tables: [table(columns)], views: [], procedures: [], functions: [], triggers: [], events: [] })

describe('schema synchronization loss classification', () => {
  it('classifies reduced type capacity, NULL removal, and enum removal as destructive', () => {
    expect(isColumnNarrowing(column('varchar(255)'), column('varchar(50)'))).toBe(true)
    expect(isColumnNarrowing(column('int'), column('tinyint'))).toBe(true)
    expect(isColumnNarrowing(column('int', true), column('int', false))).toBe(true)
    expect(isColumnNarrowing(column("enum('a','b','c')"), column("enum('a','b')"))).toBe(true)
    expect(isColumnNarrowing(column("enum('a','b')"), column("enum('a','c')"))).toBe(true)
  })

  it('keeps widening and added columns outside the destructive gate', () => {
    expect(isColumnNarrowing(column('varchar(50)'), column('varchar(255)'))).toBe(false)
    expect(isColumnNarrowing(column('tinyint'), column('int'))).toBe(false)
    expect(hasNarrowingChanges(model([column('varchar(50)')]), model([column('varchar(255)'), { name: 'extra', type: 'int', nullable: true }]))).toBe(false)
  })

  it('detects edited DROP COLUMN without COLUMN and allows non-loss drops', () => {
    const current = model([column('int')])
    expect(isDestructiveSchemaScript('ALTER TABLE `target`.`items` DROP `value`;', current)).toBe(true)
    expect(isDestructiveSchemaScript('ALTER TABLE `target`.`items` DROP INDEX `idx_value`;', current)).toBe(false)
  })

  it('classifies a narrowing MODIFY in an edited script using the current table model', () => {
    const current = model([column('varchar(255)')])
    expect(isDestructiveSchemaScript('ALTER TABLE `target`.`items` MODIFY COLUMN `value` varchar(50) NOT NULL;', current)).toBe(true)
    expect(isDestructiveSchemaScript('ALTER TABLE target.items MODIFY value varchar(50) NOT NULL;', current)).toBe(true)
    expect(isDestructiveSchemaScript('ALTER TABLE `target`.`items` MODIFY COLUMN `value` varchar(500) NOT NULL;', current)).toBe(false)
  })

  it('accepts unqualified and selected-schema names, and rejects another schema', () => {
    expect(assertSchemaUpdateScript('ALTER TABLE items ADD COLUMN extra INT;', 'target')).toHaveLength(1)
    expect(assertSchemaUpdateScript('ALTER TABLE `target`.items ADD COLUMN extra INT;', 'target')).toHaveLength(1)
    expect(() => assertSchemaUpdateScript('ALTER TABLE other.items ADD COLUMN extra INT;', 'target')).toThrow('only to the selected destination schema')
    expect(() => assertSchemaUpdateScript('CREATE TABLE other.items (id INT);', 'target')).toThrow('only to the selected destination schema')
  })
})
