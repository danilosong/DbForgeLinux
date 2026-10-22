import { ipcRenderer } from 'electron'
import type { TuxSqlApi } from '../../shared/contracts.js'

export const sessionsApi: Pick<TuxSqlApi, 'listSessions' | 'getSessionDetails' | 'killSessions' | 'getServerVariables' | 'getServerStatus' | 'previewServerVariable' | 'setServerVariable'> = {
  listSessions: (id, filters) => ipcRenderer.invoke('sessions:list', id, filters),
  getSessionDetails: (id, sessionId) => ipcRenderer.invoke('sessions:details', id, sessionId),
  killSessions: (id, sessionIds, mode, confirm) => ipcRenderer.invoke('sessions:kill', id, sessionIds, mode, confirm),
  getServerVariables: (id, scope) => ipcRenderer.invoke('sessions:variables', id, scope),
  getServerStatus: (id, scope) => ipcRenderer.invoke('sessions:status', id, scope),
  previewServerVariable: (id, change, options) => ipcRenderer.invoke('sessions:preview-variable', id, change, options),
  setServerVariable: (id, change, options) => ipcRenderer.invoke('sessions:set-variable', id, change, options)
}
