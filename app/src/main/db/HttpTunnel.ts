import { randomUUID } from 'node:crypto'
import { createServer, type Socket } from 'node:net'
import { Agent, ProxyAgent, fetch, type RequestInit, type Response } from 'undici'
import type { HttpTunnelConfig } from '../../shared/contracts.js'

const RESPONSE_PREFIX = Buffer.from('OK:')
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024

export type ResolvedHttpTunnelConfig = HttpTunnelConfig & { password?: string; proxyPassword?: string }

export interface ActiveHttpTunnel {
  host: string
  port: number
  close(): Promise<void>
}

export async function createHttpTunnel(config: ResolvedHttpTunnelConfig, targetHost: string, targetPort: number): Promise<ActiveHttpTunnel> {
  if (!config.enabled) throw new Error('HTTP tunneling está desativado.')
  let endpoint: URL
  try { endpoint = new URL(config.url) } catch { throw new Error('URL inválida para o HTTP tunnel.') }
  if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('O HTTP tunnel aceita somente URLs HTTP ou HTTPS.')
  const dispatcher = config.proxyHost
    ? new ProxyAgent({ uri: `http://${config.proxyHost}:${config.proxyPort ?? 8080}`, requestTls: { rejectUnauthorized: config.rejectUnauthorized }, ...(config.proxyUser ? { token: `Basic ${Buffer.from(`${config.proxyUser}:${config.proxyPassword ?? ''}`).toString('base64')}` } : {}) })
    : new Agent({ connect: { rejectUnauthorized: config.rejectUnauthorized } })
  const controller = new AbortController()
  const serverController = new AbortController()
  const sockets = new Set<Socket>()
  const sessions = new Set<TunnelSession>()
  const requestFor = () => (action: string, parameters: Record<string, string> = {}, body?: Buffer): Promise<Response> => {
    const url = new URL(endpoint)
    url.searchParams.set('a', action)
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)
    const headers = new Headers({ 'cache-control': 'no-cache', pragma: 'no-cache' })
    if (config.user) headers.set('authorization', `Basic ${Buffer.from(`${config.user}:${config.password ?? ''}`).toString('base64')}`)
    if (body) headers.set('content-type', 'application/octet-stream')
    return fetch(url, {
      method: body ? 'POST' : 'GET', headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, config.timeoutSeconds) * 1000)]),
      dispatcher
    } as unknown as RequestInit)
  }
  const server = createServer((socket) => {
    sockets.add(socket)
    const sessionId = randomUUID().replaceAll('-', '')
    const matchingSession = new TunnelSession(endpoint, dispatcher, sessionId, targetHost, targetPort, config, socket, serverController.signal, requestFor())
    sessions.add(matchingSession)
    void matchingSession.run().catch((error: unknown) => socket.destroy(error instanceof Error ? error : new Error('HTTP tunnel failed.'))).finally(() => {
      sockets.delete(socket)
      sessions.delete(matchingSession)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Não foi possível abrir o gateway HTTP local.')

  return {
    host: '127.0.0.1',
    port: address.port,
    close: async () => {
      await Promise.all([...sessions].map((session) => session.close()))
      for (const socket of sockets) socket.destroy()
      controller.abort()
      serverController.abort()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await dispatcher.close()
    }
  }
}

class TunnelSession {
  private closed = false
  private lastLeaseRefresh = Date.now()
  private writeChain: Promise<void> = Promise.resolve()
  constructor(
    private readonly endpoint: URL,
    private readonly dispatcher: Agent | ProxyAgent,
    private readonly id: string,
    private readonly targetHost: string,
    private readonly targetPort: number,
    private readonly config: ResolvedHttpTunnelConfig,
    private readonly socket?: Socket,
    private readonly signal?: AbortSignal,
    private readonly requestFn?: (action: string, parameters?: Record<string, string>, body?: Buffer) => Promise<Response>,
    private leaseSeconds = 180
  ) {}

  async run(): Promise<void> {
    const request = this.requestFn ?? this.createRequest()
    await this.openSession(request)
    const socket = this.socket
    if (!socket) throw new Error('HTTP tunnel stream is unavailable.')
    socket.on('data', (chunk: Buffer) => {
      this.writeChain = this.writeChain.then(async () => {
        const response = await request('w', { id: this.id, port: String(await this.getRemotePort(request)) }, chunk)
        const payload = await response.arrayBuffer()
        this.assertOk(Buffer.from(payload))
      }).catch((error: unknown) => { socket.destroy(error instanceof Error ? error : new Error('HTTP tunnel write failed.')) })
    })
    await new Promise<void>((resolve, reject) => {
      let reading = false
      const cleanup = (): void => { void this.close(); resolve() }
      socket.once('close', cleanup)
      socket.once('error', reject)
      const poll = async (): Promise<void> => {
        if (this.closed || socket.destroyed) return cleanup()
        if (reading) { setTimeout(() => void poll(), 20); return }
        reading = true
        try {
          if (Date.now() - this.lastLeaseRefresh > Math.max(10, this.leaseSeconds / 2) * 1000) {
            await request('l', { id: this.id, port: String(await this.getRemotePort(request)) })
            this.lastLeaseRefresh = Date.now()
          }
          const response = await request('r', { id: this.id, port: String(await this.getRemotePort(request)) })
          const body = Buffer.from(await response.arrayBuffer())
          const bytes = this.assertOk(body)
          if (bytes.length) socket.write(bytes)
        } catch (error) { if (!socket.destroyed) socket.destroy(error instanceof Error ? error : new Error('HTTP tunnel read failed.')); return }
        finally { reading = false }
        setTimeout(() => void poll(), 10)
      }
      void poll()
    })
  }

  private closePromise?: Promise<void>
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise
    this.closed = true
    if (!this.remotePort) return Promise.resolve()
    const request = this.requestFn ?? this.createRequest()
    this.closePromise = request('x', { id: this.id, port: String(this.remotePort) }).then(async (response) => { await response.arrayBuffer() }).catch(() => undefined)
    return this.closePromise
  }

  private remotePort?: number
  private async getRemotePort(request: (action: string, parameters?: Record<string, string>, body?: Buffer) => Promise<Response>): Promise<number> {
    if (this.remotePort) return this.remotePort
    const response = await request('t', { id: this.id })
    const body = await response.text()
    this.assertOk(Buffer.from(body))
    this.remotePort = Number(body.slice(3).split(/\s+/)[0])
    return this.remotePort
  }

  private async openSession(request: (action: string, parameters?: Record<string, string>, body?: Buffer) => Promise<Response>): Promise<void> {
    const start = new URL(this.endpoint)
    start.searchParams.set('a', 'c'); start.searchParams.set('s', this.targetHost); start.searchParams.set('p', String(this.targetPort)); start.searchParams.set('id', this.id); start.searchParams.set('nonblock', '1')
    const headers = this.headers()
    const startPromise = fetch(start, { headers, signal: this.signal, dispatcher: this.dispatcher } as RequestInit)
    void startPromise.catch(() => undefined)
    const deadline = Date.now() + Math.max(1, this.config.timeoutSeconds) * 1000
    while (Date.now() < deadline && !this.signal?.aborted) {
      const response = await request('t', { id: this.id })
      const body = await response.text()
      if (response.ok && body.startsWith('OK:')) { this.remotePort = Number(body.slice(3).split(/\s+/)[0]); this.leaseSeconds = Number(body.split(/\s+/)[1]) || this.leaseSeconds; return }
      if (body.startsWith('ER:') && !/connection entry not found/i.test(body)) throw new Error(`HTTP tunnel: ${body.slice(3).trim()}`)
      await delay(200)
    }
    throw new Error('Tempo esgotado aguardando a sessão do HTTP tunnel.')
  }

  private createRequest(): (action: string, parameters?: Record<string, string>, body?: Buffer) => Promise<Response> {
    return (action, parameters = {}, body) => {
      const url = new URL(this.endpoint)
      url.searchParams.set('a', action)
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)
      return fetch(url, {
        method: body ? 'POST' : 'GET', headers: body ? new Headers([...this.headers(), ['content-type', 'application/octet-stream']]) : this.headers(),
        body: body ? new Uint8Array(body) : undefined,
        signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(Math.max(1, this.config.timeoutSeconds) * 1000)]) : AbortSignal.timeout(Math.max(1, this.config.timeoutSeconds) * 1000),
        dispatcher: this.dispatcher
      } as unknown as RequestInit)
    }
  }

  private headers(): Headers {
    const headers = new Headers({ 'cache-control': 'no-cache', pragma: 'no-cache' })
    if (this.config.user) headers.set('authorization', `Basic ${Buffer.from(`${this.config.user}:${this.config.password ?? ''}`).toString('base64')}`)
    return headers
  }

  private assertOk(response: Buffer): Buffer {
    if (response.length > MAX_RESPONSE_BYTES) throw new Error('A resposta do HTTP tunnel excede o limite permitido.')
    if (!response.subarray(0, RESPONSE_PREFIX.length).equals(RESPONSE_PREFIX)) throw new Error(`Resposta inválida do HTTP tunnel: ${response.subarray(0, 200).toString('utf8')}`)
    return response.subarray(RESPONSE_PREFIX.length)
  }
}

function delay(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
