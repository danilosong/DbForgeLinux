import { ipcRenderer } from 'electron'
import type { OptionsApi } from '../../shared/contracts/options.js'
export const optionsApi: OptionsApi = {
  loadSettings: () => ipcRenderer.invoke('options:load'),
  saveSettings: (settings) => ipcRenderer.invoke('options:save', settings),
  resetSettings: () => ipcRenderer.invoke('options:reset'),
  exportSettings: (settings) => ipcRenderer.invoke('options:export', settings),
  importSettings: () => ipcRenderer.invoke('options:import')
}
