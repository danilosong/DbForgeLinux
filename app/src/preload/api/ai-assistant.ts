import { ipcRenderer } from 'electron'
import type { AiAssistantApi } from '../../shared/contracts/ai-assistant.js'

export const aiAssistantApi: AiAssistantApi = {
  loadAiAssistantSettings: () => ipcRenderer.invoke('ai-assistant:settings:load'),
  saveAiAssistantSettings: (settings, key) => ipcRenderer.invoke('ai-assistant:settings:save', settings, key),
  testAiAssistantSettings: (settings, key) => ipcRenderer.invoke('ai-assistant:settings:test', settings, key),
  completeAiAssistant: (request) => ipcRenderer.invoke('ai-assistant:complete', request),
  cancelAiAssistant: (requestId) => ipcRenderer.invoke('ai-assistant:cancel', requestId)
}
