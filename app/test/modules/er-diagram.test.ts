import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { autoLayout, buildDiagram, createVirtualRelation, deserializeDiagram, moveTable, serializeDiagram, validateVirtualRelation, VirtualRelationStore } from '../../src/modules/er-diagram/index.js'
import { avoidTableOverlap, routeERRelation } from '../../src/modules/er-diagram/routing.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const schema: DatabaseModel = {
  kind: 'database', name: 'shop', tables: [
    { kind: 'table', name: 'customers', columns: [{ name: 'id', type: 'int', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: [] },
    { kind: 'table', name: 'orders', columns: [{ name: 'id', type: 'int', nullable: false }, { name: 'customer_id', type: 'int', nullable: false }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [{ name: 'fk_customer', columns: ['customer_id'], referencedTable: 'customers', referencedColumns: ['id'], onDelete: 'CASCADE' }], checks: [] }
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
    expect(diagram.tables.find((table) => table.name === 'orders')).toMatchObject({ constraintNames: ['fk_customer'], primaryColumns: ['id'], indexNames: [], triggerNames: [] })
  })

  it('lays out relation dependencies before their child and tolerates cycles', () => {
    const points = autoLayout(['parent', 'child', 'other'], [{ from: 'parent', to: 'child' }])
    expect(points.child.x).toBeGreaterThan(points.parent.x)
    expect(Object.keys(autoLayout(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]))).toEqual(['a', 'b'])
  })

  it('routes orthogonal relations above every table obstacle', () => {
    const boxes = [
      { position: { x: 40, y: 100 }, width: 250, height: 100 },
      { position: { x: 400, y: 240 }, width: 250, height: 150 },
      { position: { x: 700, y: 130 }, width: 250, height: 110 }
    ]
    const path = routeERRelation(boxes[0], boxes[1], boxes)
    expect(path).toBe('M 165 100 L 165 82 L 525 82 L 525 240')
    const laneY = 82
    expect(boxes.every((box) => laneY < box.position.y)).toBe(true)
  })

  it('moves a dropped table to a nearby free slot instead of overlapping another card', () => {
    const obstacle = { position: { x: 100, y: 100 }, width: 250, height: 140 }
    expect(avoidTableOverlap({ x: 100, y: 100 }, 250, 140, [obstacle])).not.toEqual({ x: 100, y: 100 })
    expect(avoidTableOverlap({ x: 400, y: 100 }, 250, 140, [obstacle])).toEqual({ x: 400, y: 100 })
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
    await expect(store.write('conn', 'shop', [{ ...relation, toColumns: [] }])).rejects.toThrow(/invalid/i)
  })
})
