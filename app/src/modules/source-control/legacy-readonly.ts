import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RepositoryCommit, RepositoryStatus, WorkingChange } from './types.js'

const runFile = promisify(execFile)
const maxBuffer = 8 * 1024 * 1024
type CommandRunner = (command: string, args: string[], cwd?: string) => Promise<string>
export type LegacyVcs = 'Subversion' | 'Mercurial'
export interface LegacyVcsAvailability { system: LegacyVcs; installed: boolean; instruction: string }

const instructions: Record<LegacyVcs, string> = {
  Subversion: 'Install the Subversion client (svn) and select a working copy to inspect status, history, and diffs.',
  Mercurial: 'Install the Mercurial client (hg) and select a repository to inspect status, history, and diffs.'
}

async function exec(command: string, args: string[], cwd?: string): Promise<string> {
  const result = await runFile(command, args, { cwd, encoding: 'utf8', maxBuffer, shell: false, timeout: 15_000, env: { ...process.env, HGPLAIN: '1', HGENCODING: 'UTF-8' } })
  return result.stdout
}

export async function legacyVcsAvailability(system: LegacyVcs): Promise<LegacyVcsAvailability> {
  try { await exec(system === 'Subversion' ? 'svn' : 'hg', ['--version']); return { system, installed: true, instruction: instructions[system] } }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { system, installed: false, instruction: instructions[system] }
    throw new Error(`${system} client could not be started.`, { cause: error })
  }
}

export class LegacyReadOnlyRepository {
  constructor(readonly system: LegacyVcs, readonly path: string, private readonly runner: CommandRunner = exec) {}

  private run(command: string, args: string[]): Promise<string> { return this.runner(command, args, this.path) }

  async status(): Promise<RepositoryStatus> {
    if (this.system === 'Mercurial') {
      const raw = await this.run('hg', ['--cwd', this.path, 'status', '-mard'])
      const changes = raw.split('\n').filter(Boolean).map((line): WorkingChange => {
        const code = line[0] ?? '?'; const file = line.slice(2)
        return { path: file, state: code === 'A' ? 'added' : code === 'R' ? 'deleted' : code === '?' ? 'untracked' : 'modified', staged: false }
      })
      const branch = (await this.run('hg', ['--cwd', this.path, 'branch'])).trim() || 'default'
      return { root: this.path, branch, ahead: 0, behind: 0, changes, conflicted: false }
    }
    const raw = await this.run('svn', ['status', '--xml', this.path])
    const changes = [...raw.matchAll(/<entry\s+path="([^"]*)"><wc-status\s+item="([^"]+)"/g)].map((match): WorkingChange => ({
      path: decodeXml(match[1]!), state: match[2] === 'added' ? 'added' : match[2] === 'deleted' ? 'deleted' : match[2] === 'unversioned' ? 'untracked' : 'modified', staged: false
    }))
    return { root: this.path, branch: 'working copy', ahead: 0, behind: 0, changes, conflicted: /item="conflicted"/.test(raw) }
  }

  async log(limit = 50): Promise<RepositoryCommit[]> {
    const count = Math.max(1, Math.min(200, Math.floor(limit)))
    if (this.system === 'Mercurial') {
      const template = '{node}\x1f{author|person}\x1f{author|email}\x1f{date|isodate}\x1f{desc|firstline}\n'
      const raw = await this.run('hg', ['--cwd', this.path, 'log', '-l', String(count), '-T', template])
      return raw.split('\n').filter(Boolean).map((line) => { const [hash = '', author = '', email = '', date = '', message = ''] = line.split('\x1f'); return { hash, author, email, date, message } })
    }
    const raw = await this.run('svn', ['log', '--xml', '--limit', String(count), this.path])
    return [...raw.matchAll(/<logentry\s+revision="([^"]+)"[\s\S]*?<author>([\s\S]*?)<\/author>[\s\S]*?<date>([\s\S]*?)<\/date>[\s\S]*?<msg>([\s\S]*?)<\/msg>[\s\S]*?<\/logentry>/g)].map((match) => ({ hash: match[1]!, author: decodeXml(match[2]!), email: '', date: decodeXml(match[3]!), message: decodeXml(match[4]!).trim().split('\n')[0]! }))
  }

  async diff(file?: string): Promise<string> {
    if (file && (file.startsWith('/') || file.split(/[\\/]/).includes('..') || /[\0\r\n]/.test(file))) throw new Error('Select a file inside the repository.')
    if (this.system === 'Mercurial') return this.run('hg', ['--cwd', this.path, 'diff', ...(file ? ['--', file] : [])])
    return this.run('svn', ['diff', ...(file ? ['--', file] : [])])
  }
}

function decodeXml(value: string): string { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') }
