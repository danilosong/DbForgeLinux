/* global process */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const appRoot = process.cwd()
const repoPath = resolve(appRoot, '..')
const outputRoot = resolve(appRoot, process.env.DBFORGE_BUILD_DIR ?? 'out')
const runGit = (...args) => execFileSync('git', ['-C', repoPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
let commit = '0000000'
let branch = 'unknown'
let dirty = false
let repositoryAvailable = false
try {
  commit = runGit('rev-parse', 'HEAD')
  branch = runGit('branch', '--show-current') || 'detached'
  dirty = Boolean(runGit('status', '--porcelain'))
  repositoryAvailable = true
} catch { /* Source archives can still produce a release build without local Git metadata. */ }
const info = {
  commit,
  branch,
  ...(process.env.DBFORGE_RELEASE_BUILD === '1' || !repositoryAvailable ? {} : { repoPath }),
  dirty,
  builtAt: new Date().toISOString()
}
await mkdir(outputRoot, { recursive: true })
await writeFile(join(outputRoot, 'buildInfo.json'), `${JSON.stringify(info, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 })
