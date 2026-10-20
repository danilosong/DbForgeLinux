import { ipcMain } from 'electron'
import { performance } from 'node:perf_hooks'
import type { IpcDeps } from './registry.js'
import { buildQuery, inspectQueryBuilderSchema, parseQuery, type QueryBuilderModel } from '../../modules/query-builder/index.js'
import type { SqlValue } from '../db/DbDriver.js'

const activeQueryBuilder = new Map<string, { controller: AbortController; senderId: number }>()

export function registerQueryBuilderIpc({ driver }: IpcDeps): void {
  ipcMain.handle('query-builder:schema', (_event, connectionId: string, database: string) => inspectQueryBuilderSchema(driver, connectionId, database))
  ipcMain.handle('query-builder:build', (_event, model: QueryBuilderModel) => buildQuery(model))
  ipcMain.handle('query-builder:parse', (_event, sql: string, database?: string) => {
    try { return parseQuery(sql, database) } catch (error) { return { error: error instanceof Error ? error.message : 'SQL could not be represented visually.' } }
  })
  ipcMain.handle('query-builder:execute', async (event, connectionId: string, model: QueryBuilderModel, confirmedDestructive = false, executionId = '') => {
    const query = buildQuery(model)
    if ((model.statement === 'DELETE' || model.statement === 'UPDATE') && !model.conditions.some((condition) => !condition.having) && !confirmedDestructive) throw new Error('Confirm execution of a destructive statement without a WHERE clause.')
    if (!executionId || activeQueryBuilder.has(executionId)) throw new Error('Invalid or active execution id.')
    const controller = new AbortController()
    activeQueryBuilder.set(executionId, { controller, senderId: event.sender.id })
    const started = performance.now()
    try {
      if (model.statement === 'SELECT') {
        const rows: Array<Record<string, unknown>> = []
        for await (const row of driver.streamRows(connectionId, query.sql, query.parameters as SqlValue[], controller.signal)) rows.push(row)
        const columns = rows.length ? Object.keys(rows[0]) : model.selections.filter((item) => item.included).map((item) => item.alias || item.source.column)
        return { sql: query.sql, elapsedMs: performance.now() - started, results: [{ columns, rows, affectedRows: 0, insertId: 0, warningStatus: 0 }] }
      }
      const result = await driver.executeParameterized(connectionId, query.sql, query.parameters as SqlValue[], controller.signal)
      return { sql: query.sql, elapsedMs: performance.now() - started, results: [{ columns: [], rows: [], affectedRows: result.affectedRows, insertId: result.insertId, warningStatus: 0 }] }
    } finally { activeQueryBuilder.delete(executionId) }
  })
  ipcMain.handle('query-builder:cancel', (event, executionId: string) => { const job = activeQueryBuilder.get(executionId); if (job?.senderId === event.sender.id) job.controller.abort() })
}
