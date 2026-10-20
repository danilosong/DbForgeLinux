export type AiProvider = 'openai' | 'anthropic' | 'compatible' | 'local'
export type AiRole = 'user' | 'assistant'
export type AiOperation = 'chat' | 'explain' | 'optimize' | 'generate-sql'

export interface AiAssistantSettings {
  provider: AiProvider
  endpoint: string
  model: string
  temperature: number
  maxTokens: number
  timeoutMs: number
}
export interface AiChatMessage { role: AiRole; content: string }
export interface AiSchemaColumn { name: string; type: string; primaryKey?: boolean; nullable?: boolean; comment?: string }
export interface AiSchemaTable { name: string; comment?: string; columns: AiSchemaColumn[]; foreignKeys?: Array<{ column: string; referencedTable: string; referencedColumn: string }> }
export interface AiSchemaContext { database: string; tables: AiSchemaTable[] }
export interface AiCompletionRequest { messages: AiChatMessage[]; operation?: AiOperation; schema?: AiSchemaContext; requestId: string }
export type AiAssistantStreamEvent =
  | { type: 'chunk'; requestId: string; text: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; message: string }
export interface AiSettingsState { settings: AiAssistantSettings; hasApiKey: boolean }
export interface AiAssistantApi {
  loadAiAssistantSettings(): Promise<AiSettingsState>
  saveAiAssistantSettings(settings: AiAssistantSettings, apiKey: string): Promise<AiSettingsState>
  testAiAssistantSettings(settings: AiAssistantSettings, apiKey?: string): Promise<{ ok: true; latencyMs: number }>
  completeAiAssistant(request: AiCompletionRequest): Promise<{ text: string; requestId: string }>
  cancelAiAssistant(requestId: string): Promise<void>
  onAiAssistantEvent(listener: (event: AiAssistantStreamEvent) => void): () => void
}

export const defaultAiAssistantSettings: AiAssistantSettings = {
  provider: 'openai', endpoint: 'https://api.openai.com', model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 2000, timeoutMs: 45_000
}
