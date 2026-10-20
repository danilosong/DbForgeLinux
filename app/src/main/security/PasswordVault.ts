import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

export class PasswordVault {
  constructor(private readonly directory: string) {}

  async save(key: string, password: string): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 })
    const encrypted = this.hasSecureSystemStore() ? safeStorage.encryptString(password) : await this.encryptLocally(password)
    const path = this.fileFor(key)
    await fs.writeFile(path, encrypted, { mode: 0o600 })
    await fs.chmod(path, 0o600)
  }

  async get(key: string): Promise<string | null> {
    try {
      const encrypted = await fs.readFile(this.fileFor(key))
      if (encrypted.subarray(0, 9).toString() === 'DBFVAULT1') return await this.decryptLocally(encrypted)
      if (!this.hasSecureSystemStore()) throw new Error('O cofre do sistema está indisponível e esta senha não foi gravada no cofre local.')
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  getStatus(): { backend: 'system' | 'local-encrypted'; warning?: string } {
    return this.hasSecureSystemStore() ? { backend: 'system' } : {
      backend: 'local-encrypted',
      warning: 'Keyring indisponível. Senhas serão protegidas por cofre local AES-GCM, com chave mestra em arquivo privado da conta; isto não protege contra outros processos executados pela mesma conta. Instale e desbloqueie GNOME Keyring ou KWallet para proteção pelo sistema.'
    }
  }

  private hasSecureSystemStore(): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false
    const backend = safeStorage.getSelectedStorageBackend()
    return backend !== 'basic_text' && backend !== 'unknown'
  }

  private async localKey(salt: Buffer): Promise<Buffer> {
    const keyPath = join(this.directory, 'local-master.key')
    let master: Buffer
    try { master = await fs.readFile(keyPath) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      master = randomBytes(32)
      try { await fs.writeFile(keyPath, master, { flag: 'wx', mode: 0o600 }); await fs.chmod(keyPath, 0o600) }
      catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError
        master = await fs.readFile(keyPath)
      }
    }
    if (master.length !== 32) throw new Error('A chave local do cofre está inválida.')
    return scryptSync(master, salt, 32)
  }

  private async encryptLocally(value: string): Promise<Buffer> {
    const salt = randomBytes(16)
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', await this.localKey(salt), nonce)
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([Buffer.from('DBFVAULT1'), salt, nonce, cipher.getAuthTag(), ciphertext])
  }

  private async decryptLocally(value: Buffer): Promise<string> {
    const salt = value.subarray(9, 25)
    const nonce = value.subarray(25, 37)
    const tag = value.subarray(37, 53)
    const decipher = createDecipheriv('aes-256-gcm', await this.localKey(salt), nonce)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(value.subarray(53)), decipher.final()]).toString('utf8')
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.fileFor(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private fileFor(key: string): string {
    const safeName = Buffer.from(key).toString('hex')
    return join(this.directory, `${safeName}.secret`)
  }
}
