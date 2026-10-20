import { ipcMain } from 'electron'
import type { EditableResult } from '../../modules/grid-editing/index.js'
import { quoteIdentifier } from '../../modules/grid-editing/index.js'
import type { IpcDeps } from './registry.js'
import type { MasterDetailRelation } from '../../shared/contracts/grid-data.js'

export function registerGridDataIpc({ driver }: IpcDeps): void {
  ipcMain.handle('grid-data:master-detail', async (_event, connectionId: string, master: EditableResult, row: Record<string, unknown>): Promise<MasterDetailRelation[]> => {
    if (!master.database || !master.table || !master.keyColumns.length) return []
    const keys = await driver.queryRows(connectionId, 'SELECT TABLE_NAME AS detailTable, COLUMN_NAME AS detailColumn, REFERENCED_COLUMN_NAME AS masterColumn, CONSTRAINT_NAME AS relationName FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ? AND TABLE_SCHEMA = ? AND REFERENCED_COLUMN_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION', [master.database, master.table, master.database])
    const relations = new Map<string, Array<{ detailColumn: string; masterColumn: string }>>()
    for (const item of keys) { const name = String(item.relationName); const table = String(item.detailTable); const key = `${table}\u0000${name}`; const columns = relations.get(key) ?? []; columns.push({ detailColumn: String(item.detailColumn), masterColumn: String(item.masterColumn) }); relations.set(key, columns) }
    const result: MasterDetailRelation[] = []
    for (const [key, columns] of relations) {
      const [table, name] = key.split('\u0000')
      if (!table || columns.some((column) => !Object.hasOwn(row, column.masterColumn))) continue
      const where = columns.map((column) => `${quoteIdentifier(column.detailColumn)} <=> ?`).join(' AND ')
      const rows = await driver.queryRows(connectionId, `SELECT * FROM ${quoteIdentifier(master.database)}.${quoteIdentifier(table)} WHERE ${where} LIMIT 101`, columns.map((column) => row[column.masterColumn]))
      result.push({ name, table, rows: rows.slice(0, 100), truncated: rows.length > 100 })
    }
    return result
  })
}
