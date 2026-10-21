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

function routeHttpsToFakeServer(base: string): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const remote = new URL(input instanceof Request ? input.url : String(input))
    return fetch(new URL(remote.pathname + remote.search, base), init)
  }) as typeof fetch
}

function writeChunks(response: import('node:http').ServerResponse, chunks: string[], intervalMs = 10): void {
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' })
  let index = 0
  const timer = setInterval(() => {
    if (index >= chunks.length) { clearInterval(timer); response.end(); return }
    response.write(chunks[index++]!)
  }, intervalMs)
  response.on('close', () => clearInterval(timer))
}

async function waitFor(predicate: () => boolean, timeoutMs = 750): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  return predicate()
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })))
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('AI Assistant provider client', () => {
  it('streams OpenAI-compatible SSE chunks incrementally and requests stream mode', async () => {
    let requestBody = ''
    const base = await serve((request, response) => {
      request.setEncoding('utf8'); request.on('data', chunk => { requestBody += chunk })
      request.on('end', () => writeChunks(response, [
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"stream"}}]}\n\n',
        'data: [DONE]\n\n'
      ]))
    })
    const chunks: string[] = []
    const result = await callAiProvider({ ...defaultAiAssistantSettings, provider: 'compatible', endpoint: 'https://api.example.test', model: 'fake-model' }, 'test-key', [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, routeHttpsToFakeServer(base), chunk => chunks.push(chunk))
    expect(result).toBe('Hello stream')
    expect(chunks).toEqual(['Hello ', 'stream'])
    expect(JSON.parse(requestBody).stream).toBe(true)
  })

  it('parses Anthropic SSE and Ollama NDJSON streams', async () => {
    const anthropicBase = await serve((_request, response) => writeChunks(response, [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Anthropic "}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"reply"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]))
    const anthropic: string[] = []
    await expect(callAiProvider({ ...defaultAiAssistantSettings, provider: 'anthropic', endpoint: 'https://api.anthropic.com', model: 'fake-model' }, 'test-key', [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, routeHttpsToFakeServer(anthropicBase), chunk => anthropic.push(chunk))).resolves.toBe('Anthropic reply')
    expect(anthropic).toEqual(['Anthropic ', 'reply'])

    const localBase = await serve((_request, response) => writeChunks(response, [
      '{"message":{"content":"Ollama "},"done":false}\n',
      '{"message":{"content":"reply"},"done":false}\n',
      '{"done":true}\n'
    ]))
    const local: string[] = []
    await expect(callAiProvider({ ...defaultAiAssistantSettings, provider: 'local', endpoint: localBase, model: 'qwen-test' }, null, [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, fetch, chunk => local.push(chunk))).resolves.toBe('Ollama reply')
    expect(local).toEqual(['Ollama ', 'reply'])
  })

  it('rejects SSE and NDJSON streams cut off before their completion marker', async () => {
    const base = await serve((_request, response) => writeChunks(response, ['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n']))
    const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test' }
    await expect(callAiProvider(settings, 'key', [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, routeHttpsToFakeServer(base), () => undefined)).rejects.toThrow('stream ended before completion')
    const localBase = await serve((_request, response) => writeChunks(response, ['{"message":{"content":"partial"},"done":false}\n']))
    await expect(callAiProvider({ ...defaultAiAssistantSettings, provider: 'local', endpoint: localBase }, null, [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, fetch, () => undefined)).rejects.toThrow('stream ended before completion')
  })

  it('aborts an active HTTP stream when the caller cancels', async () => {
    let responseClosed = false
    const base = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('data: {"choices":[{"delta":{"content":"first"}}]}\n\n')
      const timer = setInterval(() => response.write('data: {"choices":[{"delta":{"content":"later"}}]}\n\n'), 20)
      response.on('close', () => { responseClosed = true; clearInterval(timer) })
    })
    const controller = new AbortController()
    const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test', timeoutMs: 5000 }
    const request = callAiProvider(settings, 'key', [{ role: 'user', content: 'Hi' }], undefined, controller.signal, routeHttpsToFakeServer(base), () => controller.abort())
    await expect(request).rejects.toThrow('AI request canceled')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(await waitFor(() => responseClosed)).toBe(true)
  })

  it('times out while reading a stream and closes the response', async () => {
    let responseClosed = false
    const base = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/x-ndjson' })
      const timer = setInterval(() => response.write('{"message":{"content":"still working"},"done":false}\n'), 40)
      response.on('close', () => { responseClosed = true; clearInterval(timer) })
    })
    const settings = { ...defaultAiAssistantSettings, provider: 'local' as const, endpoint: base, timeoutMs: 500 }
    await expect(callAiProvider(settings, null, [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, fetch, () => undefined)).rejects.toThrow('AI request timed out')
    expect(await waitFor(() => responseClosed)).toBe(true)
  })

  it('returns safe status-only errors for fake HTTP 401 and 429 responses', async () => {
    for (const status of [401, 429]) {
      const base = await serve((_request, response) => { response.writeHead(status); response.end('provider response contains private-token') })
      const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test' }
      const result = callAiProvider(settings, 'private-token', [{ role: 'user', content: 'Hi' }], undefined, new AbortController().signal, routeHttpsToFakeServer(base), () => undefined)
      const error = await result.catch(reason => reason)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(`AI provider returned HTTP ${status}.`)
      expect((error as Error).message).not.toContain('private-token')
    }
  })

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

  it('includes schema only when explicitly supplied and keeps provider authentication errors free of secrets', async () => {
    const settings = { ...defaultAiAssistantSettings, provider: 'compatible' as const, endpoint: 'https://api.example.test', model: 'fake-model' }
    let body = ''
    const completion = callAiProvider(settings, 'invalid-secret-value', [{ role: 'user', content: 'Explain this query.' }], undefined, new AbortController().signal, async (_url, init) => {
      body = String(init?.body ?? '')
      return new Response('invalid key', { status: 401 })
    })
    await expect(completion).rejects.toThrow('AI provider returned HTTP 401.')
    expect(body).not.toContain('schema context')
    expect(body).not.toContain('private_schema_name')
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
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-ai-settings-')); directories.push(directory)
    const path = join(directory, 'ai-assistant.json')
    const store = new AiAssistantSettingsStore(path)
    await store.save({ ...defaultAiAssistantSettings, provider: 'local', endpoint: 'http://127.0.0.1:11434', model: 'qwen2.5-coder' })
    const contents = await readFile(path, 'utf8')
    expect(contents).toContain('qwen2.5-coder')
    expect(contents).not.toContain('fake-test-key')
    expect((await store.loadStored()).settings.provider).toBe('local')
  })
})
