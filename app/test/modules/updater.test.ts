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
  const root = await mkdtemp(join(tmpdir(), 'tuxsql-updater-repo-'))
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

function service(root: string, infoPath: string, options: { buildFails?: boolean; dirty?: boolean; release?: boolean; channel?: UpdatePreferences['channel']; isBusy?: boolean; releaseDownloadFails?: boolean; gitMissing?: boolean; releaseNotPublished?: boolean } = {}): UpdateService {
  const settings = { ...preferences, channel: options.channel ?? (options.release ? 'release' as const : 'dev' as const) }
  return new UpdateService({
    appVersion: '0.1.0', buildInfoPath: infoPath, settings: async () => settings, isBusy: () => options.isBusy ?? false,
    release: {
      check: async () => { if (options.releaseNotPublished) throw new Error('HttpError: 404 Not Found'); return { version: '0.2.0', notes: ['release note'], sha512: 'hash' } },
      download: async () => { if (options.releaseDownloadFails) throw new Error('Package updater unavailable.') }, cancel: () => undefined, install: () => undefined, openReleasePage: async () => undefined
    },
    resolvePnpm: async () => ({ file: 'pnpm', prefix: [], path: process.env.PATH ?? '' }),
    runCommand: async (file, args, commandOptions) => {
      if (file === 'git' && options.gitMissing) throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
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
  it('does not run development Git commands while the channel is automatic, even when repo metadata exists', async () => {
    const { infoPath } = await fixture()
    let gitCalls = 0
    const updater = new UpdateService({
      appVersion: '0.1.0', buildInfoPath: infoPath, settings: async () => ({ ...preferences, channel: 'auto' }),
      isBusy: () => false,
      release: { check: async () => ({ version: '0.2.0', notes: [] }), download: async () => undefined, cancel: () => undefined, install: () => undefined, openReleasePage: async () => undefined },
      runCommand: async (file) => { if (file === 'git') gitCalls++; return '' }
    })

    const checked = await updater.check()

    expect(checked.phase).toBe('available')
    expect(checked.channel).toBe('release')
    expect(gitCalls).toBe(0)
  })

  it('blocks the development channel when release build metadata has no repository path', async () => {
    const { infoPath } = await fixture()
    const info = JSON.parse(await readFile(infoPath, 'utf8')) as Record<string, unknown>
    delete info.repoPath
    await writeFile(infoPath, JSON.stringify(info))
    let commandCalls = 0
    const updater = new UpdateService({
      appVersion: '0.1.0', buildInfoPath: infoPath, settings: async () => ({ ...preferences, channel: 'dev' }),
      isBusy: () => false,
      release: { check: async () => null, download: async () => undefined, cancel: () => undefined, install: () => undefined, openReleasePage: async () => undefined },
      runCommand: async () => { commandCalls++; return '' }
    })

    const checked = await updater.check()

    expect(checked.phase).toBe('blocked')
    expect(commandCalls).toBe(0)
  })

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

  it('refuses a buildInfo repository path outside the checkout owning buildInfo', async () => {
    const { root, infoPath } = await fixture()
    const other = await mkdtemp(join(tmpdir(), 'tuxsql-updater-other-')); tempDirs.push(other)
    const info = JSON.parse(await readFile(infoPath, 'utf8')) as Record<string, unknown>
    await writeFile(infoPath, JSON.stringify({ ...info, repoPath: other }))
    const checked = await service(root, infoPath).check()
    expect(checked.phase).toBe('blocked')
    expect(checked.message).toMatch(/does not match this installation/i)
  })

  it('preserves the installed build if a temporary build fails', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { buildFails: true })
    await updater.check()
    const applied = await updater.apply()
    expect(applied.phase).toBe('error')
    expect(await readFile(join(root, 'app', 'out', 'main', 'index.js'), 'utf8')).toBe('old build')
  })

  it('rebuilds a dirty checkout without touching the sources, but refuses to fast-forward over local edits', async () => {
    const { root, infoPath } = await fixture()
    await writeFile(join(root, 'README.md'), 'local edit\n')
    const localOnly = service(root, infoPath)
    await localOnly.check()
    expect((await localOnly.apply()).phase).toBe('ready')
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('local edit\n')

    const { root: behindRoot, infoPath: behindInfo } = await fixture()
    const remote = await mkdtemp(join(tmpdir(), 'tuxsql-updater-remote-'))
    const work = await mkdtemp(join(tmpdir(), 'tuxsql-updater-work-'))
    tempDirs.push(remote, work)
    execFileSync('git', ['clone', '--bare', behindRoot, remote], { stdio: 'ignore' })
    execFileSync('git', ['-C', behindRoot, 'remote', 'add', 'origin', remote])
    execFileSync('git', ['clone', remote, work], { stdio: 'ignore' })
    execFileSync('git', ['-C', work, 'config', 'user.name', 'Updater Test'])
    execFileSync('git', ['-C', work, 'config', 'user.email', 'updater-test@example.invalid'])
    await writeFile(join(work, 'remote.txt'), 'ahead\n')
    execFileSync('git', ['-C', work, 'add', '-A'])
    execFileSync('git', ['-C', work, 'commit', '-m', 'remote change'], { stdio: 'ignore' })
    execFileSync('git', ['-C', work, 'push', 'origin', 'main'], { stdio: 'ignore' })
    await writeFile(join(behindRoot, 'README.md'), 'local edit\n')
    const behind = service(behindRoot, behindInfo)
    await behind.check()
    expect((await behind.apply()).phase).toBe('blocked')
    expect(await readFile(join(behindRoot, 'README.md'), 'utf8')).toBe('local edit\n')
  })

  it('asks for confirmation while SQL work is active', async () => {
    const { root: cleanRoot, infoPath: cleanInfo } = await fixture()
    const busyUpdater = service(cleanRoot, cleanInfo, { isBusy: true })
    await busyUpdater.check()
    expect((await busyUpdater.apply()).phase).toBe('blocked')
  })

  it('explains that Git is required when the development channel runs without it', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { gitMissing: true })
    const checked = await updater.check()
    expect(checked.phase).toBe('blocked')
    expect(checked.message).toMatch(/Git is required/)
    expect(checked.message).toMatch(/release channel/)
  })

  it('treats a missing GitHub release as "nothing to update" instead of an error', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { release: true, releaseNotPublished: true })
    const checked = await updater.check()
    expect(checked.phase).toBe('up-to-date')
    expect(checked.message).toBeUndefined()
  })

  it('downloads and installs a release through the package-specific updater', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { release: true })
    expect((await updater.check()).phase).toBe('available')
    expect((await updater.apply()).phase).toBe('ready')
  })

  it('falls back to a manual release page when the Linux package updater is unavailable', async () => {
    const { root, infoPath } = await fixture()
    const updater = service(root, infoPath, { release: true, releaseDownloadFails: true })
    await updater.check()
    expect((await updater.apply()).phase).toBe(process.platform === 'linux' && !process.env.APPIMAGE ? 'manual' : 'error')
  })

  it('cancels an in-progress artifact download', async () => {
    const { infoPath } = await fixture()
    let notifyStarted!: () => void
    let rejectDownload!: (error: Error) => void
    const started = new Promise<void>((resolve) => { notifyStarted = resolve })
    const updater = new UpdateService({
      appVersion: '0.1.0', buildInfoPath: infoPath, settings: async () => ({ ...preferences, channel: 'release' }), isBusy: () => false,
      release: {
        check: async () => ({ version: '0.2.0', notes: [] }),
        download: () => new Promise<void>((_resolve, reject) => { rejectDownload = reject; notifyStarted() }),
        cancel: () => rejectDownload(new Error('Cancelled')),
        install: () => undefined, openReleasePage: async () => undefined
      },
      relaunch: () => undefined
    })
    await updater.check()
    const applying = updater.apply()
    await started
    updater.cancel()
    expect((await applying).phase).toBe('idle')
  })
})

describe('release artifact verification', () => {
  it('downloads from a local HTTPS release server and rejects a bad sha512', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-updater-https-'))
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
