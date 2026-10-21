import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { resolvePnpm } from './toolchain.js'
import type { BuildInfo, ReleaseUpdate, UpdatePreferences, UpdateServiceOptions, UpdateStatus } from './types.js'

const execFileAsync = promisify(execFile)
const commandTimeout = 15_000
const buildTimeout = 15 * 60_000
const maxLogEntries = 500

async function runCommand(file: string, args: string[], options: { cwd: string; timeout: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv }): Promise<string> {
  const result = await execFileAsync(file, args, { cwd: options.cwd, timeout: options.timeout, signal: options.signal, env: options.env, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' })
  return result.stdout.trim()
}

function textError(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { stderr?: unknown; message?: unknown }
    const detail = typeof candidate.stderr === 'string' && candidate.stderr.trim() ? candidate.stderr.trim() : candidate.message
    if (typeof detail === 'string') return sanitize(detail).slice(0, 2000)
  }
  return 'Update operation failed.'
}

function sanitize(value: string): string {
  return value.replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/gi, '$1[redacted]@')
    .replace(/\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+\b/g, '[redacted-token]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
}

function validBuildInfo(value: unknown): value is BuildInfo {
  if (!value || typeof value !== 'object') return false
  const info = value as Partial<BuildInfo>
  return typeof info.commit === 'string' && /^[a-f0-9]{7,64}$/i.test(info.commit)
    && typeof info.branch === 'string' && info.branch.length < 256
    && typeof info.builtAt === 'string' && (!info.repoPath || (typeof info.repoPath === 'string' && isAbsolute(info.repoPath)))
}

export class UpdateService {
  private state: UpdateStatus
  private controller?: AbortController
  private releaseInfo?: ReleaseUpdate

  constructor(private readonly options: UpdateServiceOptions & { statePath?: string }) {
    this.state = { phase: 'idle', currentVersion: options.appVersion, summary: [], log: [] }
  }

  status(): UpdateStatus { return structuredClone(this.state) }
  reportDownloadProgress(percent: number): UpdateStatus {
    const progress = Math.max(0, Math.min(100, Math.round(percent)))
    return this.update({ phase: 'downloading', progress }, `Download progress: ${progress}%.`)
  }
  setError(message: string): UpdateStatus {
    const safe = sanitize(message).slice(0, 2000)
    return this.update({ phase: 'error', message: safe, progress: undefined }, safe)
  }

  private update(patch: Partial<UpdateStatus>, logLine?: string): UpdateStatus {
    this.state = {
      ...this.state,
      ...patch,
      summary: patch.summary ? [...patch.summary] : this.state.summary,
      log: logLine ? [...this.state.log, logLine].slice(-maxLogEntries) : this.state.log
    }
    this.options.emit?.(this.status())
    return this.status()
  }

  async checkStartup(): Promise<UpdateStatus> {
    const preferences = await this.options.settings()
    if (!preferences.checkOnStartup) return this.status()
    if (preferences.interval === 'daily' && this.options.statePath) {
      try {
        const last = Number(await readFile(this.options.statePath, 'utf8'))
        if (Number.isFinite(last) && Date.now() - last < 24 * 60 * 60 * 1000) return this.status()
      } catch { /* First launch or unreadable cache: check once. */ }
    }
    try {
      const status = await this.check()
      if (status.phase === 'available' && preferences.automatic) return await this.apply(false)
      if (this.options.statePath && status.phase !== 'error') {
        await writeFile(this.options.statePath, String(Date.now()), { encoding: 'utf8', mode: 0o600 })
      }
      return status
    } catch { return this.status() }
  }

  async check(): Promise<UpdateStatus> {
    if (this.controller) return this.status()
    const controller = new AbortController()
    this.controller = controller
    const timer = setTimeout(() => controller.abort(new Error('Update check timed out.')), 10_000)
    timer.unref?.()
    this.releaseInfo = undefined
    this.update({ phase: 'checking', message: undefined, progress: undefined, summary: [] }, 'Checking for updates…')
    try {
      const preferences = await this.options.settings()
      const buildInfo = await this.readBuildInfo()
      const channel = preferences.channel === 'auto' ? buildInfo?.repoPath ? 'dev' : 'release' : preferences.channel
      if (channel === 'dev' && buildInfo?.repoPath) return await this.checkDev(buildInfo, preferences, controller.signal)
      if (channel === 'dev') throw new Error('The development update channel is unavailable because this build has no local repository metadata.')
      return await this.checkRelease(preferences)
    } catch (error) {
      if (controller.signal.aborted) return this.update({ phase: 'idle', message: 'Update check cancelled.' }, 'Update check cancelled.')
      const message = textError(error)
      this.update({ phase: 'error', message }, message)
      return this.status()
    } finally {
      clearTimeout(timer)
      if (this.controller === controller) this.controller = undefined
    }
  }

  private async readBuildInfo(): Promise<BuildInfo | undefined> {
    try {
      const source = await readFile(this.options.buildInfoPath, 'utf8')
      if (source.length > 16_384) return undefined
      const value: unknown = JSON.parse(source)
      return validBuildInfo(value) ? value : undefined
    } catch { return undefined }
  }

  private command(file: string, args: string[], cwd: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv, timeout = commandTimeout): Promise<string> {
    return (this.options.runCommand ?? runCommand)(file, args, { cwd, timeout, signal, env })
  }

  private async checkDev(build: BuildInfo, preferences: UpdatePreferences, signal: AbortSignal): Promise<UpdateStatus> {
    const repo = resolve(build.repoPath!)
    const localHead = await this.command('git', ['rev-parse', 'HEAD'], repo, signal)
    let target = localHead
    let remote = false
    const remotes = await this.command('git', ['remote'], repo, signal).catch(() => '')
    if (remotes.split(/\r?\n/).includes('origin')) {
      try {
        await this.command('git', ['fetch', '--no-tags', 'origin', build.branch], repo, signal)
        const remoteHead = await this.command('git', ['rev-parse', `origin/${build.branch}`], repo, signal)
        if (remoteHead) { target = remoteHead; remote = remoteHead !== localHead }
      } catch { /* Network checks are best effort. Local commits still count. */ }
    }
    const commits = await this.command('git', ['log', '--oneline', '--max-count=100', `${build.commit}..${target}`], repo, signal).catch(() => '')
    const summary = commits.split(/\r?\n/).filter(Boolean)
    const dirtyOutput = await this.command('git', ['status', '--porcelain'], repo, signal)
    const dirty = Boolean(dirtyOutput.trim())
    if (preferences.ignoredVersion && preferences.ignoredVersion === target.slice(0, 12)) {
      return this.update({ phase: 'up-to-date', channel: 'dev', newVersion: target.slice(0, 12), summary: [], message: undefined }, 'This development revision is ignored.')
    }
    if (target === build.commit || (target === localHead && localHead === build.commit)) {
      return this.update({ phase: 'up-to-date', channel: 'dev', newVersion: undefined, summary: [], message: undefined }, 'Development build is up to date.')
    }
    if (!summary.length && target !== build.commit) summary.push(`New revision ${target.slice(0, 12)}`)
    return this.update({ phase: 'available', channel: 'dev', newVersion: target.slice(0, 12), summary, message: dirty ? 'The repository has local changes. The updater will not pull or replace source files.' : remote ? `origin/${build.branch} has a newer revision.` : 'A newer local commit is available.' }, `Detected ${summary.length} development commit(s).`)
  }

  private async checkRelease(preferences: UpdatePreferences): Promise<UpdateStatus> {
    const info = await this.options.release.check()
    if (!info || info.version === this.options.appVersion || preferences.ignoredVersion === info.version) {
      return this.update({ phase: 'up-to-date', channel: 'release', newVersion: info?.version, summary: [], progress: undefined, message: undefined }, 'No newer release found.')
    }
    this.releaseInfo = info
    return this.update({ phase: 'available', channel: 'release', newVersion: info.version, summary: info.notes, progress: undefined, message: undefined }, `Release ${info.version} is available.`)
  }

  async apply(confirmBusy = false): Promise<UpdateStatus> {
    if (this.options.isBusy() && !confirmBusy) {
      return this.update({ phase: 'blocked', message: 'A SQL query or transaction is active. Confirm that it is safe to continue updating.' }, 'Update paused because SQL work is active.')
    }
    if (this.state.phase !== 'available') return this.update({ phase: 'error', message: 'Check for an update before applying it.' })
    const controller = new AbortController()
    this.controller = controller
    try {
      if (this.state.channel === 'release') return await this.applyRelease()
      return await this.applyDev()
    } finally { if (this.controller === controller) this.controller = undefined }
  }

  private async applyRelease(): Promise<UpdateStatus> {
    if (!this.releaseInfo) return this.update({ phase: 'error', message: 'Release metadata expired. Check for updates again.' })
    this.update({ phase: 'downloading', progress: 0, message: undefined }, `Downloading release ${this.state.newVersion ?? ''}…`)
    try {
      await this.options.release.download()
      this.update({ phase: 'ready', progress: 100, message: 'The update is downloaded and ready to install.' }, 'Update download complete.')
      this.options.release.install()
      return this.status()
    } catch (error) {
      if (this.controller?.signal.aborted) return this.update({ phase: 'idle', message: 'Update cancelled.', progress: undefined }, 'Update cancelled.')
      if (process.platform === 'linux' && !process.env.APPIMAGE) {
        try {
          await this.options.release.openReleasePage()
          return this.update({ phase: 'manual', message: 'This package cannot update itself here. The release page was opened so you can install the new .deb.' }, textError(error))
        } catch { /* Show the original updater failure when the release page cannot be opened either. */ }
      }
      return this.update({ phase: 'error', message: textError(error) }, textError(error))
    }
  }

  private async applyDev(): Promise<UpdateStatus> {
    const build = await this.readBuildInfo()
    if (!build?.repoPath) return this.update({ phase: 'error', message: 'Development repository metadata is missing.' })
    const repo = resolve(build.repoPath)
    const appRoot = join(repo, 'app')
    const dirty = await this.command('git', ['status', '--porcelain'], repo).catch((error) => { throw new Error(textError(error)) })
    if (dirty.trim()) return this.update({ phase: 'blocked', message: 'The repository has uncommitted changes. Commit or save them before updating.' }, 'Update refused: repository is dirty; no source changes were made.')
    const branch = await this.command('git', ['branch', '--show-current'], repo)
    if (branch !== build.branch) return this.update({ phase: 'blocked', message: `Current branch (${branch || 'detached'}) differs from the build branch (${build.branch}). No source changes were made.` })
    const current = this.state.newVersion
    const log = [...this.state.log]
    const run = (file: string, args: string[], cwd = appRoot, env?: NodeJS.ProcessEnv): Promise<string> => this.command(file, args, cwd, this.controller?.signal, env)
    let backupPath: string | undefined
    try {
      const tool = await (this.options.resolvePnpm ?? (() => resolvePnpm(build)))()
      const pnpm = (args: string[], env?: NodeJS.ProcessEnv): Promise<string> => this.command(tool.file, [...tool.prefix, ...args], appRoot, this.controller?.signal, { ...process.env, ...env, PATH: tool.path }, buildTimeout)
      const remoteTarget = await run('git', ['rev-parse', `origin/${branch}`], repo).catch(() => '')
      const localHead = await run('git', ['rev-parse', 'HEAD'], repo)
      const target = remoteTarget && remoteTarget !== localHead ? remoteTarget : localHead
      if (target !== localHead) {
        await run('git', ['pull', '--ff-only', 'origin', branch], repo)
        log.push(`Fast-forwarded origin/${branch}.`)
      }
      const lockFiles = await run('git', ['diff', '--name-only', build.commit, target], repo)
      if (lockFiles.split(/\r?\n/).some((file) => basename(file) === 'pnpm-lock.yaml')) {
        this.update({ phase: 'building', progress: 5, message: undefined }, 'Installing locked dependencies…')
        await pnpm(['install', '--frozen-lockfile'])
      }
      const output = join(appRoot, 'out')
      const next = join(appRoot, 'out.next')
      backupPath = join(appRoot, 'out.previous')
      await rm(next, { recursive: true, force: true })
      await rm(backupPath, { recursive: true, force: true })
      this.update({ phase: 'building', progress: 10, message: undefined }, 'Building into the isolated out.next directory…')
      await pnpm(['build'], { DBFORGE_BUILD_DIR: 'out.next' })
      for (const relative of ['main/index.js', 'preload/index.js', 'renderer/index.html', 'buildInfo.json']) {
        await stat(join(next, relative))
      }
      this.update({ phase: 'building', progress: 90 }, 'Build validated. Swapping output directories…')
      await rename(output, backupPath)
      try { await rename(next, output) } catch (error) { await rename(backupPath, output); backupPath = undefined; throw error }
      await rm(backupPath, { recursive: true, force: true })
      backupPath = undefined
      this.update({ phase: 'ready', progress: 100, message: 'Update built successfully. Restarting the application.' }, `Built revision ${current ?? 'latest'} and atomically replaced the bundle.`)
      this.options.relaunch?.()
      return this.status()
    } catch (error) {
      if (this.controller?.signal.aborted) return this.update({ phase: 'idle', message: 'Update cancelled.', progress: undefined }, 'Update cancelled.')
      if (backupPath) {
        const output = join(appRoot, 'out')
        try { await stat(output) } catch { await rename(backupPath, output).catch(() => undefined) }
        await rm(backupPath, { recursive: true, force: true }).catch(() => undefined)
      }
      await rm(join(appRoot, 'out.next'), { recursive: true, force: true }).catch(() => undefined)
      return this.update({ phase: 'error', message: textError(error), progress: undefined, log }, `Update failed; current build preserved: ${textError(error)}`)
    }
  }

  cancel(): UpdateStatus {
    this.controller?.abort(new Error('Update operation cancelled.'))
    this.options.release.cancel()
    return this.update({ phase: this.state.phase === 'available' ? 'available' : 'idle', progress: undefined, message: 'Update cancelled.' }, 'Update cancelled.')
  }
}
