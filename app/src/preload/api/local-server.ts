import { ipcRenderer } from 'electron'
import type { LocalServerApi } from '../../shared/contracts/local-server.js'

export const localServerApi: LocalServerApi = {
  inspectLocalContainerEngine: () => ipcRenderer.invoke('local-server:inspect'),
  listDisposableLocalServers: () => ipcRenderer.invoke('local-server:list'),
  createDisposableLocalServer: (flavor) => ipcRenderer.invoke('local-server:create', flavor),
  removeDisposableLocalServer: (id, confirmation) => ipcRenderer.invoke('local-server:remove', id, confirmation),
  createDisposableConnectionProfile: (id) => ipcRenderer.invoke('local-server:create-profile', id)
}
