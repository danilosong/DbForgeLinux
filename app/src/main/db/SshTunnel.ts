import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'
import { Client } from 'ssh2'
import type { VerifyCallback } from 'ssh2'
import type { SshConfig } from '../../shared/contracts.js'
import { buildSshOptions, type ResolvedSshConfig } from './connectionOptions.js'

export interface OpenSshTunnelConfig extends ResolvedSshConfig {
  hostFingerprint?: string
  privateKeyFile?: string
}

export interface ActiveSshTunnel {
  host: string
  port: number
  close(): Promise<void>
}

export async function createSshTunnel(config: OpenSshTunnelConfig): Promise<ActiveSshTunnel> {
  const client = new Client()
  const server = createServer((localSocket) => forwardSocket(client, localSocket, config))
  const sshOptions = buildSshOptions({ ...config, privateKey: config.privateKey ?? await readPrivateKey(config) })
  let fingerprint = ''

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      void closeResources(server, client)
      reject(error)
    }

    client.on('error', (error) => {
      fail(fingerprint ? new Error(`SSH host key não confiável: ${fingerprint}`) : redactSshError(error))
    })
    client.on('ready', () => {
      server.once('error', fail)
      server.listen(config.localPort ?? 0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') return fail(new Error('Não foi possível abrir a porta local do túnel SSH.'))
        settled = true
        resolve({
          host: '127.0.0.1',
          port: address.port,
          close: () => closeResources(server, client)
        })
      })
    })
    client.connect({
      ...sshOptions,
      hostVerifier: (key: Buffer, verify: VerifyCallback) => {
        fingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`
        verify(Boolean(config.hostFingerprint && fingerprint === config.hostFingerprint))
      }
    })
  })
}

function readPrivateKey(config: OpenSshTunnelConfig): Promise<Buffer | undefined> {
  if (config.authMethod !== 'private-key' || !config.privateKeyFile) return Promise.resolve(undefined)
  return readFile(config.privateKeyFile)
}

function forwardSocket(client: Client, localSocket: Socket, config: SshConfig): void {
  client.forwardOut(localSocket.remoteAddress ?? '127.0.0.1', localSocket.remotePort ?? 0, config.remoteHost, config.remotePort,
    (error, stream) => {
      if (error) {
        localSocket.destroy()
        return
      }
      localSocket.pipe(stream).pipe(localSocket)
      localSocket.on('error', () => stream.destroy())
      stream.on('error', () => localSocket.destroy())
    })
}

function closeResources(server: Server, client: Client): Promise<void> {
  return new Promise((resolve) => {
    if (server.listening) server.close(() => resolve())
    else resolve()
    client.end()
  })
}

function redactSshError(error: Error): Error {
  const message = error.message.replace(/(password|passphrase)=\S+/gi, '$1=****')
  return new Error(message)
}
