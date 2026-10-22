import { randomBytes, randomUUID } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ContainerEngine, ContainerEngineStatus, DisposableLocalServer, LocalDatabaseFlavor } from '../../shared/contracts/local-server.js'

const execFile = promisify(execFileCallback)
type Result = { stdout: string; stderr: string }
export type ContainerRunner = (file: string, args: string[], options?: { timeout?: number; maxBuffer?: number }) => Promise<Result>
const nativeRunner: ContainerRunner = (file, args, options = {}) => execFile(file, args, { encoding: 'utf8', timeout: options.timeout ?? 15_000, maxBuffer: options.maxBuffer ?? 1024 * 1024 })
const LABEL = 'io.tuxsql.disposable=true'
const NAME_PREFIX = 'tuxsql-local-'

export function createDisposableServerManager(run: ContainerRunner = nativeRunner, makePassword = () => randomBytes(30).toString('base64url'), makeId = () => randomUUID()) {
  const passwords = new Map<string, string>()
  const profiles = new Set<string>()
  const engines = new Map<string, ContainerEngine>()

  async function inspect(): Promise<ContainerEngineStatus> {
    for (const engine of ['docker', 'podman'] as const) {
      try {
        await run(engine, ['info', '--format', '{{.ServerVersion}}'], { timeout: 5_000 })
        engines.set(engine, engine)
        return { available: true, engine, status: 'available' }
      } catch { /* check the next installed container engine */ }
    }
    return { available: false, status: 'unavailable' }
  }

  async function list(): Promise<DisposableLocalServer[]> {
    const availability = await inspect()
    if (!availability.available || !availability.engine) return []
    const engine = availability.engine
    const { stdout } = await run(engine, ['ps', '--all', '--no-trunc', '--filter', `label=${LABEL}`, '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}'])
    return stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      const [id, name, status, ports = ''] = line.split('\t')
      if (!id || !/^[a-f0-9]{12,64}$/i.test(id) || !name?.startsWith(NAME_PREFIX)) return []
      const mapping = /127\.0\.0\.1:(\d+)->3306\/tcp/.exec(ports)
      const flavor: LocalDatabaseFlavor = name.includes('-mariadb-') ? 'mariadb' : 'mysql'
      const passwordAvailable = passwords.has(id) || passwords.has(name)
      return [{ id, name, engine, flavor, host: '127.0.0.1', ...(mapping ? { port: Number(mapping[1]) } : {}), state: /^Up\b/i.test(status ?? '') ? 'running' as const : /^Created\b/i.test(status ?? '') ? 'starting' as const : 'unknown' as const, profileCreated: profiles.has(id), canCreateProfile: passwordAvailable && !profiles.has(id) && Boolean(mapping) }]
    })
  }

  async function create(flavor: LocalDatabaseFlavor): Promise<DisposableLocalServer> {
    if (flavor !== 'mysql' && flavor !== 'mariadb') throw new Error('localServer.error.flavorInvalid')
    const availability = await inspect()
    if (!availability.available || !availability.engine) throw new Error('localServer.error.engineUnavailable')
    const engine = availability.engine
    const suffix = makeId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()
    if (suffix.length < 8) throw new Error('localServer.error.idGenerationFailed')
    const name = `${NAME_PREFIX}${flavor}-${suffix}`
    const password = makePassword()
    if (password.length < 24 || /[\r\n]/.test(password)) throw new Error('localServer.error.passwordGenerationFailed')
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-container-'))
    try {
      const envKey = flavor === 'mysql' ? 'MYSQL_ROOT_PASSWORD' : 'MARIADB_ROOT_PASSWORD'
      const envFile = join(directory, 'container.env')
      await writeFile(envFile, `${envKey}=${password}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      const image = flavor === 'mysql' ? 'mysql:8.4' : 'mariadb:11.8'
      const { stdout } = await run(engine, ['run', '--detach', '--name', name, '--label', LABEL, `--label=io.tuxsql.flavor=${flavor}`, '--publish', '127.0.0.1::3306', '--mount', 'type=volume,destination=/var/lib/mysql', '--env-file', envFile, image], { timeout: 120_000 })
      const id = stdout.trim()
      if (!/^[a-f0-9]{12,64}$/i.test(id)) throw new Error('localServer.error.containerIdInvalid')
      passwords.set(id, password)
      passwords.set(name, password)
      try {
        await new Promise(resolve => setTimeout(resolve, 350))
        const found = (await list()).find(server => server.id === id)
        return found ?? { id, name, engine, flavor, host: '127.0.0.1', state: 'starting', profileCreated: false, canCreateProfile: false }
      } catch (error) {
        passwords.delete(id); passwords.delete(name)
        try { await run(engine, ['rm', '--force', '--volumes', id], { timeout: 30_000 }) } catch { /* avoid leaving an orphan if listing failed */ }
        throw new Error('localServer.error.containerVerificationFailed', { cause: error })
      }
    } finally { await rm(directory, { recursive: true, force: true }) }
  }

  async function remove(id: string, confirmation: string): Promise<void> {
    if (!/^[a-f0-9]{12,64}$/i.test(id)) throw new Error('localServer.error.containerIdInvalid')
    const server = (await list()).find(item => item.id === id)
    if (!server) throw new Error('localServer.error.containerNotFound')
    if (confirmation !== `REMOVE ${server.name}`) throw new Error('localServer.error.confirmationMismatch')
    await run(server.engine, ['rm', '--force', '--volumes', server.id], { timeout: 30_000 })
    passwords.delete(id); passwords.delete(server.name); profiles.delete(id)
  }

  async function consumeCredentials(id: string): Promise<{ server: DisposableLocalServer; password: string }> {
    const password = passwords.get(id)
    if (!password) throw new Error('localServer.error.passwordExpired')
    const server = (await list()).find(item => item.id === id)
    if (!server) throw new Error('localServer.error.containerNotFound')
    return { server, password }
  }

  function markProfileCreated(id: string): void { profiles.add(id) }
  return { inspect, list, create, remove, consumeCredentials, markProfileCreated }
}

export const disposableServerManager = createDisposableServerManager()
