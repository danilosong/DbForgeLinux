import { ipcRenderer } from 'electron'
import type { AiAssistantApi, AiAssistantStreamEvent } from '../../shared/contracts/ai-assistant.js'

export const aiAssistantApi: AiAssistantApi = {
  loadAiAssistantSettings: () => ipcRenderer.invoke('ai-assistant:settings:load'),
  saveAiAssistantSettings: (settings, key) => ipcRenderer.invoke('ai-assistant:settings:save', settings, key),
  testAiAssistantSettings: (settings, key) => ipcRenderer.invoke('ai-assistant:settings:test', settings, key),
  completeAiAssistant: (request) => ipcRenderer.invoke('ai-assistant:complete', request),
  cancelAiAssistant: (requestId) => ipcRenderer.invoke('ai-assistant:cancel', requestId),
  onAiAssistantEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AiAssistantStreamEvent): void => callback(payload)
    ipcRenderer.on('ai-assistant:event', listener)
    return () => ipcRenderer.removeListener('ai-assistant:event', listener)
  }
}
