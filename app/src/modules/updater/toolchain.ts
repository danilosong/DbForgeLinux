import { constants } from 'node:fs'
import { access, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import type { BuildInfo } from './types.js'

export interface PnpmCommand { file: string; prefix: string[]; path: string }

async function isExecutable(path: string): Promise<boolean> {
  try { await access(path, constants.X_OK); return true } catch { return false }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path, constants.R_OK); return true } catch { return false }
}

async function nvmCandidates(home: string): Promise<string[]> {
  try {
    const root = join(home, '.nvm', 'versions', 'node')
    const versions = (await readdir(root)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    return versions.map((version) => join(root, version, 'bin', 'pnpm'))
  } catch { return [] }
}

/**
 * Finds pnpm when the app was started from a desktop launcher (no shell profile, so no nvm/volta PATH).
 * Order: toolchain recorded at build time -> DBFORGE_PNPM -> PATH -> common install locations.
 */
export async function resolvePnpm(build: BuildInfo | undefined, env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<PnpmCommand> {
  const basePath = env.PATH ?? ''
  const recorded = build?.toolchain
  if (recorded?.nodePath && recorded.pnpmExecPath && isAbsolute(recorded.nodePath) && isAbsolute(recorded.pnpmExecPath)
    && await isExecutable(recorded.nodePath) && await exists(recorded.pnpmExecPath)) {
    return { file: recorded.nodePath, prefix: [recorded.pnpmExecPath], path: `${dirname(recorded.nodePath)}${delimiter}${basePath}` }
  }
  const candidates: string[] = []
  if (env.DBFORGE_PNPM && isAbsolute(env.DBFORGE_PNPM)) candidates.push(env.DBFORGE_PNPM)
  for (const dir of basePath.split(delimiter).filter(Boolean)) candidates.push(join(dir, 'pnpm'))
  if (env.PNPM_HOME) candidates.push(join(env.PNPM_HOME, 'pnpm'))
  candidates.push(...await nvmCandidates(home), join(home, '.local', 'share', 'pnpm', 'pnpm'), join(home, '.local', 'bin', 'pnpm'), '/usr/local/bin/pnpm', '/usr/bin/pnpm')
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return { file: candidate, prefix: [], path: `${dirname(candidate)}${delimiter}${basePath}` }
  }
  throw new Error('pnpm was not found. Install it, set DBFORGE_PNPM to its full path, or rebuild with pnpm so the toolchain is recorded in buildInfo.json.')
}
