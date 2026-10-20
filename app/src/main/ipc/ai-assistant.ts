import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { IpcDeps } from './registry.js'
import { ipcMain } from './registry.js'
import { callAiProvider, sanitizeSchemaContext, validateAiSettings, AiAssistantSettingsStore, type AiChatMessage, type AiCompletionRequest } from '../../modules/ai-assistant/index.js'

const running = new Map<string, { controller: AbortController; senderId: number }>()

export function registerAiAssistantIpc({ vault, userDataDir }: IpcDeps): void {
  const store = new AiAssistantSettingsStore(join(userDataDir, 'ai-assistant.json'))
  ipcMain.handle('ai-assistant:settings:load', async () => {
    const stored = await store.loadStored()
    const secret = stored.credentialRef ? await vault.get(stored.credentialRef) : null
    return { settings: stored.settings, hasApiKey: Boolean(secret) }
  })
  ipcMain.handle('ai-assistant:settings:save', async (_event, settingsValue: unknown, apiKeyValue: unknown) => {
    const settings = validateAiSettings(settingsValue)
    const previous = await store.loadStored()
    const enteredKey = typeof apiKeyValue === 'string' ? apiKeyValue.trim() : ''
    let credentialRef = settings.provider === previous.settings.provider ? previous.credentialRef : undefined
    if (settings.provider === 'local') credentialRef = undefined
    if (settings.provider !== 'local' && !enteredKey && !credentialRef) throw new Error('Enter and save an API key for this provider.')
    if (enteredKey && settings.provider !== 'local') {
      credentialRef = `ai-assistant-${randomUUID()}`
      await vault.save(credentialRef, enteredKey)
    }
    try {
      await store.save(settings, credentialRef)
      if (previous.credentialRef && previous.credentialRef !== credentialRef) await vault.delete(previous.credentialRef)
      return { settings, hasApiKey: Boolean(credentialRef) }
    } catch (error) {
      if (enteredKey && credentialRef && credentialRef !== previous.credentialRef) await vault.delete(credentialRef)
      throw error
    }
  })
  ipcMain.handle('ai-assistant:settings:test', async (_event, settingsValue: unknown, apiKeyValue?: unknown) => {
    const settings = validateAiSettings(settingsValue)
    const stored = await store.loadStored()
    const key = typeof apiKeyValue === 'string' && apiKeyValue.trim() ? apiKeyValue.trim() : settings.provider === stored.settings.provider && stored.credentialRef ? await vault.get(stored.credentialRef) : null
    const controller = new AbortController(); const started = performance.now()
    await callAiProvider(settings, key, [{ role: 'user', content: 'Reply with OK.' }], undefined, controller.signal)
    return { ok: true as const, latencyMs: performance.now() - started }
  })
  ipcMain.handle('ai-assistant:complete', async (event, value: AiCompletionRequest) => {
    if (!value || typeof value.requestId !== 'string' || value.requestId.length > 100 || !value.requestId.trim()) throw new Error('Invalid AI request id.')
    if (running.has(value.requestId)) throw new Error('AI request id is already active.')
    const stored = await store.loadStored()
    const key = stored.credentialRef ? await vault.get(stored.credentialRef) : null
    const messages: AiChatMessage[] = value.messages
    if (!Array.isArray(messages) || messages.some((message) => !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 100_000)) throw new Error('Invalid AI conversation.')
    const schema = value.schema ? sanitizeSchemaContext(value.schema) : undefined
    const controller = new AbortController()
    running.set(value.requestId, { controller, senderId: event.sender.id })
    try { return { text: await callAiProvider(stored.settings, key, messages, schema, controller.signal), requestId: value.requestId } }
    finally { running.delete(value.requestId) }
  })
  ipcMain.handle('ai-assistant:cancel', (event, requestId: string) => {
    const job = running.get(requestId)
    if (job?.senderId === event.sender.id) job.controller.abort()
  })
}
