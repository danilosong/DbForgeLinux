import type { AiAssistantSettings, AiChatMessage, AiProvider, AiSchemaContext } from './types.js'

export function normalizeAiEndpoint(endpoint: string, provider: AiProvider): string {
  let url: URL
  try { url = new URL(endpoint.trim()) } catch { throw new Error('Enter a valid AI provider URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('The AI provider URL must use HTTP(S) and cannot contain credentials.')
  const localHost = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if (provider === 'local' && !localHost) throw new Error('Local AI endpoints must use localhost or a loopback IP address.')
  if (provider !== 'local' && url.protocol !== 'https:') throw new Error('Remote AI providers require HTTPS to protect API keys and schema context.')
  const path = url.pathname.replace(/\/+$/, '')
  if (provider === 'anthropic') url.pathname = path.endsWith('/messages') ? path : `${path}/v1/messages`
  else if (provider === 'local') url.pathname = path.endsWith('/api/chat') ? path : `${path}/api/chat`
  else url.pathname = path.endsWith('/chat/completions') ? path : `${path}${path.endsWith('/v1') ? '' : '/v1'}/chat/completions`
  url.hash = ''
  return url.toString()
}

export function sanitizeSchemaContext(value: AiSchemaContext): AiSchemaContext {
  if (!value || typeof value.database !== 'string' || !Array.isArray(value.tables) || value.tables.length > 200) throw new Error('Schema context is invalid or too large.')
  const tables = value.tables.map((table) => {
    if (!table || typeof table.name !== 'string' || !Array.isArray(table.columns) || table.columns.length > 1000) throw new Error('Schema context is invalid.')
    return {
      name: table.name.slice(0, 256), comment: typeof table.comment === 'string' ? table.comment.slice(0, 1000) : undefined,
      columns: table.columns.map((column) => ({ name: String(column.name).slice(0, 256), type: String(column.type).slice(0, 256), primaryKey: Boolean(column.primaryKey), nullable: Boolean(column.nullable), comment: typeof column.comment === 'string' ? column.comment.slice(0, 1000) : undefined })),
      foreignKeys: (table.foreignKeys ?? []).slice(0, 1000).map((fk) => ({ column: String(fk.column).slice(0, 256), referencedTable: String(fk.referencedTable).slice(0, 256), referencedColumn: String(fk.referencedColumn).slice(0, 256) }))
    }
  })
  const sanitized = { database: value.database.slice(0, 256), tables }
  if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > 2 * 1024 * 1024) throw new Error('Schema context exceeds the 2 MB AI request limit.')
  return sanitized
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const maxBytes = 5 * 1024 * 1024
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('AI provider response exceeds the 5 MB limit.')
  if (!response.body) throw new Error('AI provider returned invalid JSON.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new Error('AI provider response exceeds the 5 MB limit.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { throw new Error('AI provider returned invalid JSON.') }
}

function systemPrompt(schema?: AiSchemaContext): string {
  const base = 'You are an assistant for MySQL and MariaDB developers. Be accurate, explain assumptions, and never claim to have executed SQL. Review generated SQL before running it.'
  return schema ? `${base}\nThe user explicitly approved this schema metadata. It contains names, types, keys, and comments only; it does not contain table rows. Use it as context:\n${JSON.stringify(sanitizeSchemaContext(schema))}` : base
}

export async function callAiProvider(
  settings: AiAssistantSettings,
  apiKey: string | null,
  messages: AiChatMessage[],
  schema: AiSchemaContext | undefined,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!settings.model.trim()) throw new Error('Choose an AI model.')
  if (!Number.isFinite(settings.temperature) || settings.temperature < 0 || settings.temperature > 2) throw new Error('Temperature must be between 0 and 2.')
  if (!Number.isInteger(settings.maxTokens) || settings.maxTokens < 1 || settings.maxTokens > 128_000) throw new Error('Token limit is out of range.')
  if (!Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 500 || settings.timeoutMs > 300_000) throw new Error('Timeout must be between 500 and 300000 ms.')
  if (settings.provider !== 'local' && !apiKey) throw new Error('Save an API key in AI Assistant settings first.')
  if (!messages.length || messages.length > 200) throw new Error('The conversation is empty or too long.')
  if (messages.some((message) => !message || typeof message.content !== 'string' || message.content.length > 100_000) || messages.reduce((total, message) => total + message.content.length, 0) > 1024 * 1024) throw new Error('AI conversation exceeds the 1 MB request limit.')
  const endpoint = normalizeAiEndpoint(settings.endpoint, settings.provider)
  const controller = AbortSignal.any([signal, AbortSignal.timeout(settings.timeoutMs)])
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  let body: Record<string, unknown>
  if (settings.provider === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
    headers['x-api-key'] = apiKey ?? ''
    body = { model: settings.model, max_tokens: settings.maxTokens, temperature: settings.temperature, system: systemPrompt(schema), messages: messages.filter((message) => message.role !== 'assistant' || message.content.trim()).map((message) => ({ role: message.role, content: message.content })) }
  } else if (settings.provider === 'local') {
    body = { model: settings.model, stream: false, messages: [{ role: 'system', content: systemPrompt(schema) }, ...messages], options: { temperature: settings.temperature, num_predict: settings.maxTokens } }
  } else {
    headers.authorization = `Bearer ${apiKey ?? ''}`
    body = { model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens, messages: [{ role: 'system', content: systemPrompt(schema) }, ...messages] }
  }
  let response: Response
  try { response = await fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller }) }
  catch (error) {
    if (signal.aborted) throw new Error('AI request canceled.', { cause: error })
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('AI request timed out.', { cause: error })
    throw new Error('Unable to connect to the AI Assistant provider. Check the endpoint and network.', { cause: error })
  }
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`)
  const data = await readJsonResponse(response)
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  let result: string
  if (settings.provider === 'anthropic') {
    const content = Array.isArray(record.content) ? record.content : []
    result = content.filter((item): item is { text: string } => Boolean(item) && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string').map((item) => item.text).join('\n')
  } else if (settings.provider === 'local') {
    const message = record.message && typeof record.message === 'object' ? record.message as Record<string, unknown> : {}
    result = typeof message.content === 'string' ? message.content : ''
  } else {
    const choices = Array.isArray(record.choices) ? record.choices : []
    const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {}
    const message = first.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : {}
    result = typeof message.content === 'string' ? message.content : ''
  }
  if (!result.trim()) throw new Error('AI provider returned an empty response.')
  return result.trim()
}
