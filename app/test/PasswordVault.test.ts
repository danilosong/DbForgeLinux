import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(),
  getSelectedStorageBackend: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn()
}))

vi.mock('electron', () => ({ safeStorage: safeStorageMock }))

import { PasswordVault } from '../src/main/security/PasswordVault.js'

describe('PasswordVault', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dbforge-vault-'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    safeStorageMock.getSelectedStorageBackend.mockReturnValue('gnome_libsecret')
    safeStorageMock.encryptString.mockImplementation((password: string) =>
      Buffer.from([...Buffer.from(password)].map((byte) => byte ^ 0xff))
    )
    safeStorageMock.decryptString.mockImplementation((encrypted: Buffer) =>
      Buffer.from([...encrypted].map((byte) => byte ^ 0xff)).toString()
    )
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it.each(['basic_text', 'unknown'] as const)('recusa o backend %s', async (backend) => {
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(backend)
    const vault = new PasswordVault(directory)

    await expect(vault.save('connection-1', 'secret')).rejects.toThrow(/gnome-keyring ou kwallet/)
    expect(safeStorageMock.encryptString).not.toHaveBeenCalled()
  })

  it('persiste apenas o conteúdo cifrado e permite leitura pelo processo principal', async () => {
    const vault = new PasswordVault(directory)

    await vault.save('connection-1', 'secret')
    const stored = await readFile(join(directory, `${Buffer.from('connection-1').toString('hex')}.secret`))

    expect(stored.toString()).not.toContain('secret')
    await expect(vault.get('connection-1')).resolves.toBe('secret')
    expect(safeStorageMock.decryptString).toHaveBeenCalledWith(stored)
  })

  it('recusa salvar quando a criptografia do sistema está indisponível', async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false)
    const vault = new PasswordVault(directory)

    await expect(vault.save('connection-1', 'secret')).rejects.toThrow(/Instale e desbloqueie/)
  })
})
