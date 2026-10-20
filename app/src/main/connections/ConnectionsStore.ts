import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ConnectionRecord } from '../../shared/contracts.js'

export class ConnectionsStore {
  constructor(private readonly filePath: string) {}

  async list(): Promise<ConnectionRecord[]> {
    try {
      const contents = await readFile(this.filePath, 'utf8')
      const records: unknown = JSON.parse(contents)
      if (!Array.isArray(records)) throw new Error('O arquivo de conexões precisa conter uma lista.')
      return records.map((record) => stripInlineSecrets(record) as ConnectionRecord)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new Error(`Não foi possível ler as conexões: ${errorMessage(error)}`, { cause: error })
    }
  }

  async save(record: ConnectionRecord): Promise<void> {
    const safeRecord = stripInlineSecrets(record) as ConnectionRecord
    if (!safeRecord.id || !safeRecord.name.trim()) throw new Error('A conexão precisa de um ID e um nome.')

    const records = await this.list()
    const duplicate = records.find((item) => item.id !== safeRecord.id && item.name.toLocaleLowerCase() === safeRecord.name.trim().toLocaleLowerCase())
    if (duplicate) throw new Error(`Já existe uma conexão chamada "${duplicate.name}".`)
    const updated = records.filter((item) => item.id !== safeRecord.id)
    updated.push(safeRecord)
    await this.write(updated)
  }

  async delete(id: string): Promise<void> {
    const records = await this.list()
    await this.write(records.filter((record) => record.id !== id))
  }

  private async write(records: ConnectionRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.filePath)
    await chmod(this.filePath, 0o600)
  }
}

function stripInlineSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripInlineSecrets)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/(password|passphrase|privatekey|secret|token|api.?key|credential)$/i.test(key))
      .map(([key, nested]) => [key, stripInlineSecrets(nested)])
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'erro desconhecido'
}
