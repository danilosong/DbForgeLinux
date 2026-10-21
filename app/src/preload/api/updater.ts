import { ipcRenderer } from 'electron'
import type { UpdaterApi } from '../../shared/contracts/updater.js'

export const updaterApi: UpdaterApi = {
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterApply: (confirmBusy = false) => ipcRenderer.invoke('updater:apply', { confirmBusy }),
  updaterCancel: () => ipcRenderer.invoke('updater:cancel'),
  updaterStatus: () => ipcRenderer.invoke('updater:status'),
  onUpdaterStatus: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, value: Parameters<typeof handler>[0]): void => handler(value)
    ipcRenderer.on('updater:status-event', listener)
    return () => ipcRenderer.removeListener('updater:status-event', listener)
  }
}
