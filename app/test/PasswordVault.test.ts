import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
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
    directory = await mkdtemp(join(tmpdir(), 'tuxsql-vault-'))
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

  it.each(['basic_text', 'unknown'] as const)('usa cofre cifrado quando backend %s não é seguro', async (backend) => {
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(backend)
    const vault = new PasswordVault(directory)

    await vault.save('connection-1', 'secret')
    await expect(vault.get('connection-1')).resolves.toBe('secret')
    expect(vault.getStatus().warning).toMatch(/Keyring indisponível/)
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

  it('cifra localmente quando a criptografia do sistema está indisponível', async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false)
    const vault = new PasswordVault(directory)

    await vault.save('connection-1', 'secret')
    await expect(vault.get('connection-1')).resolves.toBe('secret')
    const stored = await readFile(join(directory, `${Buffer.from('connection-1').toString('hex')}.secret`))
    expect(stored.subarray(0, 9).toString()).toBe('DBFVAULT1')
    expect(stored.toString()).not.toContain('secret')
    expect((await stat(join(directory, 'local-master.key'))).mode & 0o777).toBe(0o600)
  })
})
