import type { DbDriver } from '../../main/db/DbDriver.js'
import type { QueryBuilderSchema, QueryForeignKey, QueryTable } from './types.js'

export async function inspectQueryBuilderSchema(driver: DbDriver, connectionId: string, database: string): Promise<QueryBuilderSchema> {
  if (!connectionId || !database) throw new Error('Choose a connection and database.')
  const parameters: unknown[] = [database]
  const [columns, references] = await Promise.all([
    driver.queryRows(connectionId, 'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS keyName, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION', parameters),
    driver.queryRows(connectionId, 'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTable, REFERENCED_COLUMN_NAME AS referencedColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION', parameters)
  ])
  const tables = new Map<string, QueryTable>()
  for (const column of columns) {
    const name = String(column.tableName)
    let table = tables.get(name)
    if (!table) { table = { name, database, alias: name, columns: [], foreignKeys: [] }; tables.set(name, table) }
    table.columns.push({ name: String(column.name), type: String(column.type), primaryKey: String(column.keyName) === 'PRI', nullable: String(column.nullable) === 'YES' })
  }
  for (const fk of references) {
    const table = tables.get(String(fk.tableName))
    if (table) table.foreignKeys.push({ column: String(fk.columnName), referencedTable: String(fk.referencedTable), referencedColumn: String(fk.referencedColumn) } satisfies QueryForeignKey)
  }
  return { database, tables: [...tables.values()] }
}
