import { ipcRenderer } from 'electron'
import type { QueryBuilderApi } from '../../shared/contracts/query-builder.js'

export const queryBuilderApi: QueryBuilderApi = {
  getQueryBuilderSchema: (id, database) => ipcRenderer.invoke('query-builder:schema', id, database),
  buildQueryBuilder: (model) => ipcRenderer.invoke('query-builder:build', model),
  parseQueryBuilder: (sql, database) => ipcRenderer.invoke('query-builder:parse', sql, database),
  executeQueryBuilder: (id, model, confirmed, executionId) => ipcRenderer.invoke('query-builder:execute', id, model, confirmed, executionId),
  cancelQueryBuilder: (executionId) => ipcRenderer.invoke('query-builder:cancel', executionId)
}
