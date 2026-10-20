import { ipcRenderer } from 'electron'
import type { ERDiagramApi } from '../../shared/contracts/er-diagram.js'
export const erDiagramApi: ERDiagramApi = {
  loadERDiagram: (activeConnectionId, database, connectionId) => ipcRenderer.invoke('er-diagram:load', activeConnectionId, database, connectionId),
  saveVirtualRelations: (connectionId, database, relations) => ipcRenderer.invoke('er-diagram:save-relations', connectionId, database, relations),
  saveERDiagram: (diagram) => ipcRenderer.invoke('er-diagram:save-file', diagram),
  openERDiagram: () => ipcRenderer.invoke('er-diagram:open-file')
}
