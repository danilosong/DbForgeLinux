import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { execFile as execFileCallback, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https'
import { UpdateService } from '../../src/modules/updater/UpdateService.js'
import { downloadVerifiedArtifact } from '../../src/modules/updater/verify.js'
import type { UpdatePreferences } from '../../src/modules/updater/types.js'

const execFile = promisify(execFileCallback)
const tempDirs: string[] = []
const preferences: UpdatePreferences = { checkOnStartup: true, automatic: false, channel: 'auto', interval: 'startup', ignoredVersion: '' }

afterEach(async () => { await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })

async function fixture(): Promise<{ root: string; infoPath: string; commit: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dbforge-updater-repo-'))
  tempDirs.push(root)
  await mkdir(join(root, 'app', 'out', 'main'), { recursive: true })
  await mkdir(join(root, 'app', 'out', 'preload'), { recursive: true })
  await mkdir(join(root, 'app', 'out', 'renderer'), { recursive: true })
  await writeFile(join(root, '.gitignore'), 'app/out/\napp/out.next/\napp/out.previous/\n')
  await writeFile(join(root, 'README.md'), 'initial\n')
  const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Updater Test')
  git('config', 'user.email', 'updater-test@example.invalid')
  git('add', '-A')
  git('commit', '-m', 'initial')
  const commit = git('rev-parse', 'HEAD')
  const infoPath = join(root, 'app', 'out', 'buildInfo.json')
  await writeFile(infoPath, JSON.stringify({ commit, branch: 'main', repoPath: root, dirty: false, builtAt: new Date().toISOString() }))
  await writeFile(join(root, 'app', 'out', 'main', 'index.js'), 'old build')
  await writeFile(join(root, 'app', 'out', 'preload', 'index.js'), 'preload')
  await writeFile(join(root, 'app', 'out', 'renderer', 'index.html'), '<!doctype html>')
  await writeFile(join(root, 'README.md'), 'second commit\n')
  git('add', 'README.md')
  git('commit', '-m', 'add updater docs')
  return { root, infoPath, commit }
}

function service(root: string, infoPath: string, options: { buildFails?: boolean; dirty?: boolean; release?: boolean; isBusy?: boolean } = {}): UpdateService {
  const settings = { ...preferences, channel: options.release ? 'release' as const : 'auto' as const }
  return new UpdateService({
    appVersion: '0.1.0', buildInfoPath: infoPath, settings: async () => settings, isBusy: () => options.isBusy ?? false,
    release: {
      check: async () => ({ version: '0.2.0', notes: ['release note'], sha512: 'hash' }),
      download: async () => undefined, cancel: () => undefined, install: () => undefined, openReleasePage: async () => undefined
    },
    runCommand: async (file, args, commandOptions) => {
      if (file === 'pnpm' && args[0] === 'build') {
        if (options.buildFails) throw new Error('synthetic build failure')
        const out = join(commandOptions.cwd, 'out.next')
        await mkdir(join(out, 'main'), { recursive: true }); await mkdir(join(out, 'preload'), { recursive: true }); await mkdir(join(out, 'renderer'), { recursive: true })
        await writeFile(join(out, 'main', 'index.js'), 'new build'); await writeFile(join(out, 'preload', 'index.js'), 'new preload')
        await writeFile(join(out, 'renderer', 'index.html'), '<!doctype html>'); await writeFile(join(out, 'buildInfo.json'), '{}')
        return ''
      }
      if (file === 'pnpm') return ''
      const result = await execFile(file, args, { cwd: commandOptions.cwd, timeout: commandOptions.timeout, signal: commandOptions.signal })
      return result.stdout.trim()
    },
    relaunch: () => undefined
  })
}

describe('development updater', () => {
  it('lists new commits and atomically swaps a validated build', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath)
    const checked = await updater.check()
    expect(checked.phase).toBe('available')
    expect(checked.summary.join('\n')).toContain('add updater docs')
    const applied = await updater.apply()
    expect(applied.phase).toBe('ready')
    expect(await readFile(join(root, 'app', 'out', 'main', 'index.js'), 'utf8')).toBe('new build')
  })

  it('preserves the installed build if a temporary build fails', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { buildFails: true })
    await updater.check()
    const applied = await updater.apply()
    expect(applied.phase).toBe('error')
    expect(await readFile(join(root, 'app', 'out', 'main', 'index.js'), 'utf8')).toBe('old build')
  })

  it('refuses to update a dirty repository and asks for confirmation while SQL work is active', async () => {
    const { root, infoPath } = await fixture()
    await writeFile(join(root, 'README.md'), 'local edit\n')
    const dirtyUpdater = service(root, infoPath)
    await dirtyUpdater.check()
    expect((await dirtyUpdater.apply()).phase).toBe('blocked')
    const { root: cleanRoot, infoPath: cleanInfo } = await fixture()
    const busyUpdater = service(cleanRoot, cleanInfo, { isBusy: true })
    await busyUpdater.check()
    expect((await busyUpdater.apply()).phase).toBe('blocked')
  })

  it('downloads and installs a release through the package-specific updater', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { release: true })
    expect((await updater.check()).phase).toBe('available')
    expect((await updater.apply()).phase).toBe('ready')
  })
})

describe('release artifact verification', () => {
  it('downloads from a local HTTPS release server and rejects a bad sha512', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dbforge-updater-https-'))
    tempDirs.push(root)
    const keyPath = join(root, 'key.pem'); const certPath = join(root, 'cert.pem')
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost', '-days', '1'], { stdio: 'ignore' })
    const key = await readFile(keyPath); const cert = await readFile(certPath)
    const body = Buffer.from('release installer bytes')
    const server = createHttpsServer({ key, cert }, (_request, response) => { response.writeHead(200, { 'content-type': 'application/octet-stream' }); response.end(body) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('HTTPS test server did not bind a TCP port.')
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolveResponse, reject) => {
      const request = httpsRequest(new URL(String(input)), { rejectUnauthorized: false, signal: init?.signal ?? undefined }, (response) => {
        const chunks: Buffer[] = []; response.on('data', (chunk: Buffer) => chunks.push(chunk)); response.on('end', () => resolveResponse(new Response(Buffer.concat(chunks), { status: response.statusCode ?? 500 })))
      })
      request.on('error', reject); request.end()
    })) as typeof fetch
    const url = `https://127.0.0.1:${address.port}/latest-linux.yml`
    const sha512 = createHash('sha512').update(body).digest('base64')
    try {
      expect(Buffer.from(await downloadVerifiedArtifact(url, sha512, fetcher)).equals(body)).toBe(true)
      await expect(downloadVerifiedArtifact(url, 'invalid-hash', fetcher)).rejects.toThrow(/integrity check failed/)
      await expect(downloadVerifiedArtifact(url.replace('https:', 'http:'), sha512, fetcher)).rejects.toThrow(/HTTPS/)
    } finally { server.close(); vi.restoreAllMocks() }
  })
})
