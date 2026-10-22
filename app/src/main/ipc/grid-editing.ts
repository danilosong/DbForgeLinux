import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import { buildGridChange, parseSimpleSelect, validateGridValue, type EditableColumn, type EditableResult, type GridChange } from '../../modules/grid-editing/index.js'

export async function describeGridResult(driver: IpcDeps['driver'], connectionId: string, sql: string, defaultDatabase?: string): Promise<EditableResult> {
  const table = parseSimpleSelect(sql, defaultDatabase)
  if (!table) return { database: defaultDatabase ?? '', table: '', keyColumns: [], columns: [], reason: 'This result is not a simple SELECT from one table.' }
  const columns = await driver.queryRows(connectionId, 'SELECT column_name AS name, data_type AS dataType, column_type AS columnType, is_nullable AS isNullable, column_default AS defaultValue, extra FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position', [table.database, table.table])
  if (!columns.length) return { ...table, keyColumns: [], columns: [], reason: 'The source table or its columns could not be found.' }
  const indexes = await driver.queryRows(connectionId, 'SELECT index_name AS indexName, column_name AS columnName, non_unique AS nonUnique, seq_in_index AS sequence FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? ORDER BY index_name, seq_in_index', [table.database, table.table])
  const groups = new Map<string, Array<{ name: string; nullable: boolean }>>()
  for (const index of indexes) {
    if (Number(index.nonUnique) !== 0) continue
    const name = String(index.indexName)
    const group = groups.get(name) ?? []
    const column = columns.find((item) => item.name === index.columnName)
    if (!column) continue
    group.push({ name: String(index.columnName), nullable: String(column.isNullable).toUpperCase() === 'YES' })
    groups.set(name, group)
  }
  const key = groups.get('PRIMARY') ?? [...groups.values()].find((items) => items.length && items.every((item) => !item.nullable))
  const mapped: EditableColumn[] = columns.map((column) => ({ name: String(column.name), dataType: String(column.dataType), columnType: String(column.columnType), nullable: String(column.isNullable).toUpperCase() === 'YES', defaultValue: column.defaultValue, extra: String(column.extra ?? '') }))
  return { ...table, columns: mapped, keyColumns: key?.map((item) => item.name) ?? [], ...(!key ? { reason: 'Editing is disabled because the table has no primary key or non-null unique index.' } : {}) }
}

export function registerGridEditingIpc({ driver }: IpcDeps): void {
  ipcMain.handle('grid-editing:describe', (_event, connectionId: string, sql: string, database?: string) => describeGridResult(driver, connectionId, sql, database))
  ipcMain.handle('grid-editing:preview', (_event, descriptor: EditableResult, changes: GridChange[]) => changes.map((change) => buildGridChange(change, descriptor)).filter((item) => item.sql))
  ipcMain.handle('grid-editing:apply', async (_event, connectionId: string, descriptor: EditableResult, changes: GridChange[], autoCommit: boolean) => {
    if (!descriptor.keyColumns.length) throw new Error('This result is read-only: a primary or unique key is required.')
    if (changes.length > 1000) throw new Error('Apply at most 1,000 grid edits at a time.')
    const prepared = changes.map((change) => {
      const record = change.kind === 'delete' ? change.original : change.values
      for (const column of descriptor.columns) if (Object.hasOwn(record, column.name)) {
        const error = validateGridValue(column, record[column.name]); if (error) throw new Error(error)
      }
      for (const key of descriptor.keyColumns) if (change.kind !== 'insert' && !Object.hasOwn(change.original, key)) throw new Error(`Missing key value: ${key}.`)
      return { change, statement: buildGridChange(change, descriptor) }
    }).filter(({ statement }) => statement.sql)
    const run = async (execute: (sql: string, values: readonly (string | number | bigint | boolean | Date | Buffer | null)[]) => Promise<{ affectedRows: number }>): Promise<{ updated: number; inserted: number; deleted: number }> => {
      const count = { updated: 0, inserted: 0, deleted: 0 }
      for (const { change, statement } of prepared) {
        const response = await execute(statement.sql, statement.values as (string | number | bigint | boolean | Date | Buffer | null)[])
        if (change.kind !== 'insert' && response.affectedRows !== 1) throw new Error('Conflict detected: the row was changed or removed on the server. Pending edits were kept.')
        if (change.kind === 'update') count.updated++
        else if (change.kind === 'insert') count.inserted++
        else count.deleted++
      }
      return count
    }
    if (autoCommit) return driver.withTransaction(connectionId, (transaction) => run((sql, values) => transaction.execute(sql, values)))
    return driver.withSavepoint(connectionId, () => run((sql, values) => driver.executeParameterized(connectionId, sql, values)))
  })
}
