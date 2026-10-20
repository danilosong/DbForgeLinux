import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defaultAiAssistantSettings, type AiAssistantSettings } from './types.js'
import { normalizeAiEndpoint } from './client.js'

interface StoredSettings { settings: AiAssistantSettings; credentialRef?: string }

export function validateAiSettings(value: unknown): AiAssistantSettings {
  if (!value || typeof value !== 'object') throw new Error('AI Assistant settings are invalid.')
  const input = value as Partial<AiAssistantSettings>
  if (!['openai', 'anthropic', 'compatible', 'local'].includes(input.provider ?? '')) throw new Error('Choose a supported AI provider.')
  const settings: AiAssistantSettings = {
    provider: input.provider!, endpoint: String(input.endpoint ?? '').trim(), model: String(input.model ?? '').trim(),
    temperature: Number(input.temperature), maxTokens: Number(input.maxTokens), timeoutMs: Number(input.timeoutMs)
  }
  const endpoint = new URL(settings.endpoint)
  if ([...endpoint.searchParams.keys()].some((key) => /key|token|secret|auth/i.test(key))) throw new Error('Do not put provider secrets in the endpoint URL. Save the key in the secure vault field.')
  normalizeAiEndpoint(settings.endpoint, settings.provider)
  if (!settings.model || settings.model.length > 200) throw new Error('Enter a valid model name.')
  if (!Number.isFinite(settings.temperature) || settings.temperature < 0 || settings.temperature > 2) throw new Error('Temperature must be between 0 and 2.')
  if (!Number.isInteger(settings.maxTokens) || settings.maxTokens < 1 || settings.maxTokens > 128_000) throw new Error('Token limit is out of range.')
  if (!Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 500 || settings.timeoutMs > 300_000) throw new Error('Timeout must be between 500 and 300000 ms.')
  return settings
}

export class AiAssistantSettingsStore {
  constructor(private readonly filePath: string) {}
  async loadStored(): Promise<StoredSettings> {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoredSettings>
      return { settings: validateAiSettings(data.settings), ...(typeof data.credentialRef === 'string' ? { credentialRef: data.credentialRef } : {}) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { settings: { ...defaultAiAssistantSettings } }
      throw new Error('AI Assistant settings could not be read.', { cause: error })
    }
  }
  async save(settingsValue: unknown, credentialRef?: string): Promise<AiAssistantSettings> {
    const settings = validateAiSettings(settingsValue)
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    const tempPath = join(dirname(this.filePath), `.ai-settings-${process.pid}-${Date.now()}.tmp`)
    const stored: StoredSettings = { settings, ...(credentialRef ? { credentialRef } : {}) }
    await writeFile(tempPath, `${JSON.stringify(stored, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(tempPath, this.filePath)
    return settings
  }
}
