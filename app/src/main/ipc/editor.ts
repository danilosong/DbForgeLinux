import type { MysqlDriver } from '../db/MysqlDriver.js'
import type { EditorMetadata } from '../../shared/contracts/editor.js'
import { EditorMetadataCache } from '../../modules/editor/metadataCache.js'

export const editorMetadataCache = new EditorMetadataCache()

export function registerEditorIpc({ driver }: { driver: MysqlDriver }): void {
  ipcMain.handle('editor:metadata', async (_event, connectionId: string, database: string, refresh = false): Promise<EditorMetadata> => {
    if (!connectionId?.trim() || !database?.trim()) throw new Error('Select a connection and database before loading autocomplete.')
    if (refresh) editorMetadataCache.invalidate(connectionId, database)
    return editorMetadataCache.get(connectionId, database, async () => {
      const [databases, tables, columns, routines, parameters] = await Promise.all([
        driver.queryRows(connectionId, 'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME'),
        driver.queryRows(connectionId, 'SELECT TABLE_NAME AS name, TABLE_TYPE AS tableType, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME', [database]),
        driver.queryRows(connectionId, 'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION', [database]),
        driver.queryRows(connectionId, 'SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS routineType FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME', [database]).catch(() => []),
        driver.queryRows(connectionId, 'SELECT SPECIFIC_NAME AS routineName, PARAMETER_NAME AS parameterName, PARAMETER_MODE AS parameterMode, DATA_TYPE AS dataType, ORDINAL_POSITION AS ordinalPosition FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = ? AND PARAMETER_NAME IS NOT NULL ORDER BY SPECIFIC_NAME, ORDINAL_POSITION', [database]).catch(() => [])
      ])
      const byRoutine = new Map<string, string[]>()
      for (const parameter of parameters) {
        const name = String(parameter.routineName)
        const args = byRoutine.get(name) ?? []
        const mode = String(parameter.parameterMode ?? 'IN').toUpperCase()
        const parameterName = String(parameter.parameterName ?? `arg${args.length + 1}`)
        args.push(`${mode === 'IN' ? '' : `${mode} `}${parameterName} ${String(parameter.dataType ?? 'unknown').toUpperCase()}`)
        byRoutine.set(name, args)
      }
      const byTable = new Map<string, Array<{ name: string; type: string; nullable: boolean }>>()
      for (const column of columns) {
        const tableName = String(column.tableName)
        const current = byTable.get(tableName) ?? []
        current.push({ name: String(column.name), type: String(column.type), nullable: String(column.nullable).toUpperCase() === 'YES' })
        byTable.set(tableName, current)
      }
      return {
        database,
        databases: databases.map((item) => String(item.name)),
        objects: tables.map((item) => ({ name: String(item.name), kind: String(item.tableType).toUpperCase() === 'VIEW' ? 'view' : 'table', columns: byTable.get(String(item.name)) ?? [], engine: String(item.engine ?? '') })),
        routines: routines.map((item) => ({ name: String(item.name), kind: String(item.routineType).toUpperCase() === 'FUNCTION' ? 'function' : 'procedure', parameters: byRoutine.get(String(item.name)) ?? [] }))
      }
    }, refresh)
  })
  ipcMain.handle('editor:invalidate-metadata', (_event, connectionId: string, database?: string) => { editorMetadataCache.invalidate(connectionId, database) })
}

import { ipcMain } from 'electron'
