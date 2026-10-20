import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { autoLayout, buildDiagram, createVirtualRelation, deserializeDiagram, moveTable, serializeDiagram, validateVirtualRelation, VirtualRelationStore } from '../../src/modules/er-diagram/index.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const schema: DatabaseModel = {
  kind: 'database', name: 'shop', tables: [
    { kind: 'table', name: 'customers', columns: [{ name: 'id', type: 'int', nullable: false }], indexes: [], foreignKeys: [], checks: [] },
    { kind: 'table', name: 'orders', columns: [{ name: 'id', type: 'int', nullable: false }, { name: 'customer_id', type: 'int', nullable: false }], indexes: [], foreignKeys: [{ name: 'fk_customer', columns: ['customer_id'], referencedTable: 'customers', referencedColumns: ['id'], onDelete: 'CASCADE' }], checks: [] }
  ], views: [], procedures: [], functions: [], triggers: [], events: []
}
const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('ER diagram module', () => {
  it('extracts table columns and physical foreign key relations with automatic positions', () => {
    const diagram = buildDiagram(schema, 'conn')
    expect(diagram.tables.map((table) => table.name)).toEqual(['customers', 'orders'])
    expect(diagram.relations).toMatchObject([{ name: 'fk_customer', fromTable: 'orders', toTable: 'customers', fromColumns: ['customer_id'], toColumns: ['id'], virtual: false }])
    expect(diagram.tables[0].position).not.toEqual(diagram.tables[1].position)
  })

  it('lays out relation dependencies before their child and tolerates cycles', () => {
    const points = autoLayout(['parent', 'child', 'other'], [{ from: 'parent', to: 'child' }])
    expect(points.child.x).toBeGreaterThan(points.parent.x)
    expect(Object.keys(autoLayout(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]))).toEqual(['a', 'b'])
  })

  it('creates and validates virtual relations, and preserves diagram positions on serialization', () => {
    const relation = createVirtualRelation({ name: 'orders_customer', fromTable: 'orders', fromColumns: ['customer_id'], toTable: 'customers', toColumns: ['id'] }, schema.tables.map((table) => table.name))
    const diagram = buildDiagram(schema, 'conn', [relation])
    expect(validateVirtualRelation(relation, schema)).toBeUndefined()
    expect(validateVirtualRelation({ ...relation, fromColumns: ['missing'] }, schema)).toBe('Coluna inexistente.')
    const moved = moveTable(diagram, 'orders', { x: 450, y: 80 })
    expect(deserializeDiagram(serializeDiagram(moved)).tables.find((table) => table.name === 'orders')?.position).toEqual({ x: 450, y: 80 })
    expect(() => deserializeDiagram('{bad json')).toThrow('Diagram deserialization failed.')
  })

  it('persists virtual relations locally by connection and database', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'dbforge-erd-')); folders.push(folder)
    const store = new VirtualRelationStore(folder)
    const relation = createVirtualRelation({ name: 'orders_customer', fromTable: 'orders', fromColumns: ['customer_id'], toTable: 'customers', toColumns: ['id'] }, schema.tables.map((table) => table.name))
    await store.write('conn', 'shop', [relation])
    expect(await store.read('conn', 'shop')).toEqual([relation])
    expect(JSON.parse(await readFile(join(folder, 'conn--shop.relations.json'), 'utf8'))).toEqual([relation])
  })
})
