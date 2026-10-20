import { describe, expect, it } from 'vitest'
import { buildObjectTemplate, buildTableDdlPreview, normalizeObjectDefinition, validateTableDraft } from '../../src/modules/object-editors/index.js'
import type { ObjectEditorTarget } from '../../src/shared/contracts/object-editors.js'
import type { TableModel } from '../../src/modules/schema/model.js'

const table: TableModel = { kind: 'table', name: 'customers', columns: [{ name: 'id', type: 'INT', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: [], engine: 'InnoDB', charset: 'utf8mb4' }
const target = (kind: ObjectEditorTarget['kind'], name = 'item'): ObjectEditorTarget => ({ connectionId: 'conn', database: 'sample', kind, name })

describe('object editor drafts', () => {
  it('builds first-run templates for all editable object kinds', () => {
    expect(buildObjectTemplate(target('view'))).toContain('CREATE OR REPLACE VIEW `sample`.`item`')
    expect(buildObjectTemplate(target('procedure'))).toContain('CREATE PROCEDURE `sample`.`item`')
    expect(buildObjectTemplate(target('function'))).toContain('RETURNS INT')
    expect(buildObjectTemplate(target('trigger'))).toContain('CREATE TRIGGER')
    expect(buildObjectTemplate(target('event'))).toContain('ON SCHEDULE EVERY 1 DAY')
  })

  it('validates table drafts and previews CREATE and ALTER from schema diffs', () => {
    expect(() => validateTableDraft(table)).not.toThrow()
    expect(buildTableDdlPreview(table, null, 'sample')).toContain('CREATE TABLE `sample`.`customers`')
    const changed = { ...table, columns: [...table.columns, { name: 'email', type: 'VARCHAR(120)', nullable: true }] }
    expect(buildTableDdlPreview(changed, table, 'sample')).toContain('ADD COLUMN `email` VARCHAR(120)')
    expect(() => validateTableDraft({ ...table, columns: [{ name: '', type: 'INT', nullable: true }] })).toThrow('column name')
    expect(() => validateTableDraft({ ...table, columns: [{ name: 'bad', type: 'INT); DROP TABLE x;--', nullable: true }] })).toThrow('Tipo inválido')
  })

  it('accepts only CREATE definitions for the target object name', () => {
    const view = target('view', 'active_customers')
    expect(normalizeObjectDefinition('CREATE VIEW `sample`.`active_customers` AS SELECT 1;', view)).toContain('CREATE VIEW')
    expect(() => normalizeObjectDefinition('DROP VIEW `sample`.`active_customers`;', view)).toThrow('CREATE')
    expect(() => normalizeObjectDefinition('CREATE VIEW `sample`.`other` AS SELECT 1;', view)).toThrow('coincidir')
  })
})
