import { ipcRenderer } from 'electron'
import type { StartupRendererMilestone } from '../../shared/contracts/api.js'

export const startupApi = {
  initializeNonCriticalIpc: (): Promise<{ ready: true }> => ipcRenderer.invoke('app:renderer-ready'),
  traceStartup: (milestone: StartupRendererMilestone): void => { ipcRenderer.send('startup:trace', milestone) }
}
