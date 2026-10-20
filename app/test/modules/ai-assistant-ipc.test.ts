import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AiAssistantSettingsStore, defaultAiAssistantSettings } from '../../src/modules/ai-assistant/index.js'

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('../../src/main/ipc/registry.js', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => ipc.handlers.set(name, handler) } }))

import { registerAiAssistantIpc } from '../../src/main/ipc/ai-assistant.js'

const servers: Server[] = []
const directories: string[] = []

async function waitFor(predicate: () => boolean, timeoutMs = 750): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  return predicate()
}

async function serve(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<string> {
  const server = createServer(handler); servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake HTTP server failed to start.')
  return `http://127.0.0.1:${address.port}`
}

async function register(endpoint: string, userDataDir: string): Promise<void> {
  const vault = { get: async () => null, save: async () => undefined, delete: async () => undefined }
  registerAiAssistantIpc({ vault, userDataDir } as never)
  const store = new AiAssistantSettingsStore(join(userDataDir, 'ai-assistant.json'))
  await store.save({ ...defaultAiAssistantSettings, provider: 'local', endpoint, model: 'fake-local', timeoutMs: 5000 })
}

function sender(id = 7): { id: number; send: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn>; isDestroyed: () => boolean } {
  return { id, send: vi.fn(), once: vi.fn(), removeListener: vi.fn(), isDestroyed: () => false }
}

beforeEach(() => ipc.handlers.clear())
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })))
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('AI Assistant streaming IPC', () => {
  it('sends request-scoped chunks and done events only to the invoking webContents', async () => {
    const endpoint = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/x-ndjson' })
      response.write('{"message":{"content":"first "},"done":false}\n')
      setTimeout(() => { response.write('{"message":{"content":"second"},"done":false}\n'); response.end('{"done":true}\n') }, 10)
    })
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-ai-ipc-')); directories.push(directory)
    await register(endpoint, directory)
    const webContents = sender()
    const requestId = 'request-one'
    const pending = ipc.handlers.get('ai-assistant:complete')!({ sender: webContents }, { requestId, messages: [{ role: 'user', content: 'hello' }] }) as Promise<unknown>
    await expect(pending).resolves.toMatchObject({ text: 'first second', requestId })
    expect(webContents.send.mock.calls.map(([, event]) => event)).toEqual([
      { type: 'chunk', requestId, text: 'first ' },
      { type: 'chunk', requestId, text: 'second' },
      { type: 'done', requestId }
    ])
  })

  it('aborts the provider stream when the matching requestId is canceled over IPC', async () => {
    let responseClosed = false
    const endpoint = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/x-ndjson' })
      response.write('{"message":{"content":"start"},"done":false}\n')
      const timer = setInterval(() => response.write('{"message":{"content":"more"},"done":false}\n'), 20)
      response.on('close', () => { responseClosed = true; clearInterval(timer) })
    })
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-ai-ipc-')); directories.push(directory)
    await register(endpoint, directory)
    const webContents = sender()
    const requestId = 'cancel-me'
    const pending = ipc.handlers.get('ai-assistant:complete')!({ sender: webContents }, { requestId, messages: [{ role: 'user', content: 'hello' }] }) as Promise<unknown>
    while (!webContents.send.mock.calls.some(([, event]) => event.type === 'chunk')) await new Promise(resolve => setTimeout(resolve, 5))
    await ipc.handlers.get('ai-assistant:cancel')!({ sender: webContents }, requestId)
    await expect(pending).rejects.toThrow('AI request canceled')
    expect(webContents.send.mock.calls.at(-1)?.[1]).toEqual({ type: 'error', requestId, message: 'AI request canceled.' })
    expect(await waitFor(() => responseClosed)).toBe(true)
  })

  it('emits a status-only error event for provider HTTP failures', async () => {
    const endpoint = await serve((_request, response) => { response.writeHead(429); response.end('private provider detail') })
    const directory = await mkdtemp(join(tmpdir(), 'dbforge-ai-ipc-')); directories.push(directory)
    await register(endpoint, directory)
    const webContents = sender()
    await expect(ipc.handlers.get('ai-assistant:complete')!({ sender: webContents }, { requestId: 'rate-limited', messages: [{ role: 'user', content: 'hello' }] }) as Promise<unknown>).rejects.toThrow('HTTP 429')
    expect(webContents.send.mock.calls.at(-1)?.[1]).toEqual({ type: 'error', requestId: 'rate-limited', message: 'AI provider returned HTTP 429.' })
  })
})
