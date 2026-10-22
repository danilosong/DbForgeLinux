import { ipcRenderer } from 'electron'
import type { OptionsApi, SettingsLoadResult } from '../../shared/contracts/options.js'
let settingsLoadInFlight: Promise<SettingsLoadResult> | undefined
function loadSettingsOnce(): Promise<SettingsLoadResult> {
  if (settingsLoadInFlight) return settingsLoadInFlight
  const request = ipcRenderer.invoke('options:load') as Promise<SettingsLoadResult>
  settingsLoadInFlight = request
  void request.then(() => { if (settingsLoadInFlight === request) settingsLoadInFlight = undefined }, () => { if (settingsLoadInFlight === request) settingsLoadInFlight = undefined })
  return request
}
export const optionsApi: OptionsApi = {
  loadSettings: loadSettingsOnce,
  saveSettings: (settings) => ipcRenderer.invoke('options:save', settings),
  resetSettings: () => ipcRenderer.invoke('options:reset'),
  exportSettings: (settings) => ipcRenderer.invoke('options:export', settings),
  importSettings: () => ipcRenderer.invoke('options:import')
}
