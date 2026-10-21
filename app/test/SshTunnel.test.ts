import { describe, expect, it, vi } from 'vitest'

const sshMock = vi.hoisted(() => ({ instances: [] as Array<{ connect(options: Record<string, unknown>): void; end(): void; emit(event: string, ...args: unknown[]): boolean }> }))
vi.mock('ssh2', async () => {
  const { EventEmitter } = await import('node:events')
  class FakeClient extends EventEmitter {
    connect(options: Record<string, unknown>): void { void options }
    end(): void {}
  }
  return { Client: class extends FakeClient { constructor() { super(); sshMock.instances.push(this) } } }
})

import { createSshTunnel, mapSshError, verifySshHostKey } from '../src/main/db/SshTunnel.js'

describe('SSH host trust and errors', () => {
  it('requests trust for an unknown key and blocks changed keys', () => {
    expect(verifySshHostKey('SHA256:new')).toEqual({ trusted: false, error: new Error('SSH host key não confiável: SHA256:new') })
    const changed = verifySshHostKey('SHA256:new', 'SHA256:old')
    expect(changed.trusted).toBe(false)
    expect(changed.error?.message).toContain('Possível ataque man-in-the-middle')
  })

  it('accepts the pinned fingerprint and classifies auth and network errors', () => {
    expect(verifySshHostKey('SHA256:pinned', 'SHA256:pinned')).toEqual({ trusted: true })
    expect(mapSshError(new Error('All configured authentication methods failed')).message).toContain('Autenticação SSH falhou')
    expect(mapSshError(new Error('connect ETIMEDOUT 10.0.0.1:22')).message).toContain('Falha de rede SSH')
    expect(mapSshError(new Error('bad password=secret')).message).not.toContain('secret')
  })

  it('uses the vault password only for password prompts and requests OTP answers interactively', async () => {
    let requestedPrompts: Array<{ prompt: string; echo: boolean }> = []
    let answerChallenge!: (answers: string[] | null) => void
    const tunnelPromise = createSshTunnel({
      host: 'ssh.example.test', port: 22, user: 'app', authMethod: 'password', keyboardInteractive: true,
      password: 'vault-password', keepAliveSeconds: 0, remoteHost: 'mysql.example.test', remotePort: 3306,
      keyboardInteractivePrompt: async (challenge) => {
        requestedPrompts = challenge.prompts
        return new Promise((resolve) => { answerChallenge = resolve })
      }
    })
    const client = sshMock.instances.at(-1)!
    await new Promise((resolve) => setTimeout(resolve, 0))
    let finished: string[] | undefined
    client.emit('keyboard-interactive', 'login', 'Enter your OTP', 'en', [
      { prompt: 'Password: ', echo: false },
      { prompt: 'Verification code: ', echo: false }
    ], (answers: string[]) => { finished = answers })

    expect(requestedPrompts).toEqual([{ prompt: 'Verification code: ', echo: false }])
    answerChallenge(['123456'])
    await vi.waitFor(() => expect(finished).toEqual(['vault-password', '123456']))
    client.emit('ready')
    const tunnel = await tunnelPromise
    await tunnel.close()
  })
})
