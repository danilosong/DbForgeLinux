import { ipcRenderer } from 'electron'
import type { ImportExportApi } from '../../shared/contracts/import-export.js'
export const importExportApi: ImportExportApi = {
  exportData: (id, query, format, options, jobId) => ipcRenderer.invoke('import-export:export', id, query, format, options, jobId),
  importData: (id, table, format, mode, keys, options, jobId) => ipcRenderer.invoke('import-export:import', id, table, format, mode, keys, options, jobId),
  generateImportSql: (table, format, mode, keys, options, jobId) => ipcRenderer.invoke('import-export:script', table, format, mode, keys, options, jobId),
  selectImportSource: (jobId, format, options) => ipcRenderer.invoke('import-export:select-source', jobId, format, options),
  previewExport: (id, query, jobId) => ipcRenderer.invoke('import-export:preview-export', id, query, jobId),
  cancelImportExport: (jobId) => ipcRenderer.invoke('import-export:cancel', jobId),
  onImportExportProgress: (jobId, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, eventJobId: string, progress: Parameters<typeof callback>[0]): void => { if (eventJobId === jobId) callback(progress) }
    ipcRenderer.on('import-export:progress', listener)
    return () => ipcRenderer.removeListener('import-export:progress', listener)
  },
  listImportExportTemplates: () => ipcRenderer.invoke('import-export:templates:list'),
  saveImportExportTemplate: (template) => ipcRenderer.invoke('import-export:templates:save', template),
  deleteImportExportTemplate: (id) => ipcRenderer.invoke('import-export:templates:delete', id),
  saveImportExportLog: (content) => ipcRenderer.invoke('import-export:save-log', content)
}
