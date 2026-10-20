import { ipcRenderer } from 'electron'
import type { DbForgeApi } from '../../shared/contracts.js'

export const sessionsApi: Pick<DbForgeApi, 'listSessions' | 'getSessionDetails' | 'killSessions' | 'getServerVariables' | 'getServerStatus' | 'setServerVariable'> = {
  listSessions: (id, filters) => ipcRenderer.invoke('sessions:list', id, filters),
  getSessionDetails: (id, sessionId) => ipcRenderer.invoke('sessions:details', id, sessionId),
  killSessions: (id, sessionIds, mode, confirm) => ipcRenderer.invoke('sessions:kill', id, sessionIds, mode, confirm),
  getServerVariables: (id, scope) => ipcRenderer.invoke('sessions:variables', id, scope),
  getServerStatus: (id, scope) => ipcRenderer.invoke('sessions:status', id, scope),
  setServerVariable: (id, change, options) => ipcRenderer.invoke('sessions:set-variable', id, change, options)
}
