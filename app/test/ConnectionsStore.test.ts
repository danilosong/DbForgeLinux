import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { ConnectionsStore } from '../src/main/connections/ConnectionsStore.js'

describe('ConnectionsStore', () => {
  let directory: string
  let store: ConnectionsStore

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dbforge-connections-'))
    store = new ConnectionsStore(join(directory, 'config', 'connections.json'))
  })

  afterEach(async () => rm(directory, { recursive: true, force: true }))

  it('persists CRUD metadata with private file permissions', async () => {
    const record = createDefaultConnection('one', 'Development')
    await store.save(record)
    expect(await store.list()).toEqual([record])
    expect((await stat(join(directory, 'config', 'connections.json'))).mode & 0o777).toBe(0o600)

    await store.save({ ...record, name: 'Renamed' })
    expect((await store.list())[0].name).toBe('Renamed')
    await store.delete(record.id)
    expect(await store.list()).toEqual([])
  })

  it('never serializes inline secrets but retains vault references', async () => {
    const record = createDefaultConnection('one', 'Connection') as ReturnType<typeof createDefaultConnection> & {
      password: string
      ssh: { password: string; passphrase: string }
    }
    record.password = 'database-secret'
    Object.assign(record, { apiToken: 'token-secret', credential: 'credential-secret' })
    record.passwordRef = 'vault-db-1'
    record.ssh = { ...record.ssh, password: 'ssh-secret', passphrase: 'key-secret' }

    await store.save(record)
    const serialized = await readFile(join(directory, 'config', 'connections.json'), 'utf8')
    expect(serialized).not.toContain('database-secret')
    expect(serialized).not.toContain('ssh-secret')
    expect(serialized).not.toContain('key-secret')
    expect(serialized).not.toContain('token-secret')
    expect(serialized).not.toContain('credential-secret')
    expect(serialized).toContain('vault-db-1')
  })

  it('rejects duplicate connection names without regard to case', async () => {
    await store.save(createDefaultConnection('one', 'Production'))
    await expect(store.save(createDefaultConnection('two', 'production'))).rejects.toThrow('Já existe uma conexão')
  })
})
