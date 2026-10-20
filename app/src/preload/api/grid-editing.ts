import { ipcRenderer } from 'electron'
import type { GridEditingApi } from '../../shared/contracts/grid-editing.js'
export const gridEditingApi: GridEditingApi = {
  describeGridResult: (id, sql, database) => ipcRenderer.invoke('grid-editing:describe', id, sql, database),
  previewGridChanges: (descriptor, changes) => ipcRenderer.invoke('grid-editing:preview', descriptor, changes),
  applyGridChanges: (id, descriptor, changes, autoCommit) => ipcRenderer.invoke('grid-editing:apply', id, descriptor, changes, autoCommit)
}
