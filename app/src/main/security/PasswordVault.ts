import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export class PasswordVault {
  constructor(private readonly directory: string) {}

  async save(key: string, password: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Armazenamento seguro indisponível. Instale e desbloqueie gnome-keyring ou kwallet.')
    }
    const backend = safeStorage.getSelectedStorageBackend()
    if (backend === 'basic_text' || backend === 'unknown') {
      throw new Error('Backend de armazenamento inseguro. Instale e desbloqueie gnome-keyring ou kwallet.')
    }
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 })
    const encrypted = safeStorage.encryptString(password)
    await fs.writeFile(this.fileFor(key), encrypted, { mode: 0o600 })
  }

  async get(key: string): Promise<string | null> {
    try {
      const encrypted = await fs.readFile(this.fileFor(key))
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Sistema de armazenamento seguro indisponível')
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private fileFor(key: string): string {
    const safeName = Buffer.from(key).toString('hex')
    return join(this.directory, `${safeName}.secret`)
  }
}
