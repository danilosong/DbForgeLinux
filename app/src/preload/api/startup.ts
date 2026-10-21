import { ipcRenderer } from 'electron'

export const startupApi = {
  initializeNonCriticalIpc: (): Promise<{ ready: true }> => ipcRenderer.invoke('app:renderer-ready')
}
