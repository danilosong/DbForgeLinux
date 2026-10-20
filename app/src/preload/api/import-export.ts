import { ipcRenderer } from 'electron'
import type { ImportExportApi } from '../../shared/contracts/import-export.js'
export const importExportApi: ImportExportApi = {
  exportData: (id, query, format, options) => ipcRenderer.invoke('import-export:export', id, query, format, options),
  importData: (id, table, format, mode, keys, options) => ipcRenderer.invoke('import-export:import', id, table, format, mode, keys, options)
}
