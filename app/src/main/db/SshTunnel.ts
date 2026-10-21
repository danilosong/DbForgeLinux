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
  let hostKeyError: Error | undefined

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      void closeResources(server, client)
      reject(error)
    }

    client.on('error', (error) => fail(hostKeyError ?? mapSshError(error)))
    if (config.keyboardInteractive) {
      client.on('keyboard-interactive', (_name, _instructions, _language, prompts, finish) => {
        const response = config.password ?? ''
        if (!response) return fail(new Error('Keyboard Interactive requer uma credencial SSH armazenada no cofre do sistema.'))
        finish(prompts.map(() => response))
      })
    }
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
        const decision = verifySshHostKey(fingerprint, config.hostFingerprint)
        hostKeyError = decision.error
        verify(decision.trusted)
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

export function verifySshHostKey(fingerprint: string, trustedFingerprint?: string): { trusted: boolean; error?: Error } {
  if (!trustedFingerprint) return { trusted: false, error: new Error(`SSH host key não confiável: ${fingerprint}`) }
  if (trustedFingerprint !== fingerprint) return { trusted: false, error: new Error(`Fingerprint SSH mudou. Possível ataque man-in-the-middle. Esperado ${trustedFingerprint}; recebido ${fingerprint}.`) }
  return { trusted: true }
}

export function mapSshError(error: Error): Error {
  if (/auth|authentication|all configured authentication methods failed|permission denied/i.test(error.message) || error.message === 'All configured authentication methods failed') {
    return new Error(`Autenticação SSH falhou: ${redactSshMessage(error.message)}`)
  }
  if (/timed out|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|socket hang up/i.test(error.message)) {
    return new Error(`Falha de rede SSH: ${redactSshMessage(error.message)}`)
  }
  return new Error(`Falha SSH: ${redactSshMessage(error.message)}`)
}

function redactSshMessage(message: string): string {
  return message.replace(/(password|passphrase)=\S+/gi, '$1=****')
}
