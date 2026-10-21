import { once } from 'node:events'
import { createServer, type Server } from 'node:http'
import { createConnection, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createHttpTunnel } from '../../src/main/db/HttpTunnel.js'

describe('Devart-style HTTP tunnel client', () => {
  let endpoint: Server | undefined
  let tunnel: Awaited<ReturnType<typeof createHttpTunnel>> | undefined
  let socket: Socket | undefined

  afterEach(async () => {
    socket?.destroy(); socket = undefined
    if (tunnel) { await tunnel.close(); tunnel = undefined }
    if (endpoint?.listening) { endpoint.close(); await once(endpoint, 'close') }
    endpoint = undefined
  })

  it('starts a local TCP gateway and transports binary MySQL stream data through the HTTP actions', async () => {
    let received = Buffer.alloc(0)
    const requests: Array<{ action: string | null; query: Record<string, string>; body: Buffer }> = []
    endpoint = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const action = url.searchParams.get('a')
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      const body = Buffer.concat(chunks)
      requests.push({ action, query: Object.fromEntries(url.searchParams), body })
      if (action === 'c') { response.end(''); return }
      if (action === 't') { response.end('OK:23456\n180\n'); return }
      if (action === 'w') {
        received = body
        response.end('OK:')
        return
      }
      if (action === 'r') { response.end(Buffer.concat([Buffer.from('OK:'), received])); received = Buffer.alloc(0); return }
      response.end('OK:')
    })
    endpoint.listen(0, '127.0.0.1')
    await once(endpoint, 'listening')
    const address = endpoint.address()
    if (!address || typeof address === 'string') throw new Error('fake HTTP server did not bind')
    tunnel = await createHttpTunnel({ enabled: true, url: `http://127.0.0.1:${address.port}/tunnel.php`, timeoutSeconds: 3, rejectUnauthorized: true }, 'db.internal', 3306)
    socket = createConnection({ host: tunnel.host, port: tunnel.port })
    await once(socket, 'connect')
    const payload = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x03, 0x53, 0x45, 0x4c, 0x45, 0x43, 0x54])
    const response = once(socket, 'data') as Promise<[Buffer]>
    socket.write(payload)
    expect((await response)[0]).toEqual(payload)
    await tunnel.close(); tunnel = undefined
    expect(requests.some((item) => item.action === 'c' && item.query.s === 'db.internal' && item.query.p === '3306' && item.query.nonblock === '1')).toBe(true)
    expect(requests.some((item) => item.action === 'w' && item.body.equals(payload))).toBe(true)
    expect(requests.some((item) => item.action === 'r')).toBe(true)
    expect(requests.some((item) => item.action === 'x')).toBe(true)
  }, 30_000)
})
