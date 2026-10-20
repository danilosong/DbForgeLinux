import { describe, expect, it } from 'vitest'
import { mapSshError, verifySshHostKey } from '../src/main/db/SshTunnel.js'

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
})
