import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callAiProvider, sanitizeSchemaContext, AiAssistantSettingsStore, defaultAiAssistantSettings, type AiAssistantSettings } from '../../src/modules/ai-assistant/index.js'

const servers: Server[] = []
const directories: string[] = []

async function serve(handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void): Promise<string> {
  const server = createServer(handler); servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake HTTP server failed to start.')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('AI Assistant provider client', () => {
  it('calls an HTTPS OpenAI-compatible endpoint and sends only whitelisted, approved schema metadata', async () => {
    let headers: HeadersInit = {}; let requestBody = ''
    const settings: AiAssistantSettings = { ...defaultAiAssistantSettings, provider: 'compatible', endpoint: 'https://api.example.test', model: 'fake-model' }
    const schema = sanitizeSchemaContext({ database: 'shop', tables: [{ name: 'orders', columns: [{ name: 'id', type: 'INT', primaryKey: true }], rows: [{ id: 'PRIVATE_ROW_VALUE' }] } as never] })
    const output = await callAiProvider(settings, 'fake-test-key', [{ role: 'user', content: 'Generate a query.' }], schema, new AbortController().signal, async (_url, init) => { headers = init?.headers ?? {}; requestBody = String(init?.body ?? ''); return new Response(JSON.stringify({ choices: [{ message: { content: 'SELECT 1;' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }) })
    expect(output).toBe('SELECT 1;')
    expect(new Headers(headers).get('authorization')).toBe('Bearer fake-test-key')
    expect(requestBody).toContain('orders')
    expect(requestBody).toContain('INT')
    expect(requestBody).not.toContain('PRIVATE_ROW_VALUE')
  })

  it('rejects remote HTTP and non-loopback local endpoints before sending credentials', async () => {
    await expect(callAiProvider({ ...defaultAiAssistantSettings, provider: 'compatible', endpoint: 'http://127.0.0.1:8181', model: 'x' }, 'secret', [{ role: 'user', content: 'x' }], undefined, new AbortController().signal)).rejects.toThrow('require HTTPS')
    await expect(callAiProvider({ ...defaultAiAssistantSettings, provider: 'local', endpoint: 'http://metadata.internal', model: 'x' }, null, [{ role: 'user', content: 'x' }], undefined, new AbortController().signal)).rejects.toThrow('localhost or a loopback')
  })

  it('caps outbound conversation and inbound provider response sizes', async () => {
    const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test' }
    const longConversation = Array.from({ length: 11 }, () => ({ role: 'user' as const, content: 'x'.repeat(100_000) }))
    await expect(callAiProvider(settings, 'key', longConversation, undefined, new AbortController().signal)).rejects.toThrow('1 MB request limit')
    const fetcher: typeof fetch = async () => new Response('x'.repeat(5 * 1024 * 1024 + 1), { status: 200 })
    await expect(callAiProvider(settings, 'key', [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, fetcher)).rejects.toThrow('5 MB limit')
  })

  it('supports local Ollama responses and honors cancellation', async () => {
    const endpoint = await serve((_request, response) => { setTimeout(() => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ message: { content: 'Local answer' } })) }, 200) })
    const controller = new AbortController()
    const request = callAiProvider({ ...defaultAiAssistantSettings, provider: 'local', endpoint, model: 'local-model', timeoutMs: 5000 }, null, [{ role: 'user', content: 'Hello' }], undefined, controller.signal)
    setTimeout(() => controller.abort(), 25)
    await expect(request).rejects.toThrow('AI request canceled')
  })

  it('times out slow providers with a safe message', async () => {
    const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test', timeoutMs: 500 }
    const fetcher: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')), { once: true }))
    await expect(callAiProvider(settings, 'not-logged-key', [{ role: 'user', content: 'Hello' }], undefined, new AbortController().signal, fetcher)).rejects.toThrow('timed out')
  })

  it('stores provider metadata without persisting an API key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-ai-settings-')); directories.push(directory)
    const path = join(directory, 'ai-assistant.json')
    const store = new AiAssistantSettingsStore(path)
    await store.save({ ...defaultAiAssistantSettings, provider: 'local', endpoint: 'http://127.0.0.1:11434', model: 'qwen2.5-coder' })
    const contents = await readFile(path, 'utf8')
    expect(contents).toContain('qwen2.5-coder')
    expect(contents).not.toContain('fake-test-key')
    expect((await store.loadStored()).settings.provider).toBe('local')
  })
})
