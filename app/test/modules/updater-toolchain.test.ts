import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolvePnpm } from '../../src/modules/updater/toolchain.js'

let home: string

beforeEach(async () => { home = await mkdtemp(join(tmpdir(), 'dbforge-toolchain-')) })
afterEach(async () => { await rm(home, { recursive: true, force: true }) })

async function fakeBinary(path: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, '#!/bin/sh\n')
  await chmod(path, 0o755)
}

describe('resolvePnpm', () => {
  it('prefers the toolchain recorded at build time', async () => {
    const node = join(home, 'bin', 'node')
    const pnpmJs = join(home, 'lib', 'pnpm.cjs')
    await fakeBinary(node)
    await mkdir(join(home, 'lib'), { recursive: true })
    await writeFile(pnpmJs, '')
    const command = await resolvePnpm({ commit: 'abcdef1', branch: 'master', builtAt: 'now', toolchain: { nodePath: node, pnpmExecPath: pnpmJs } }, { PATH: '/nonexistent' }, home)
    expect(command.file).toBe(node)
    expect(command.prefix).toEqual([pnpmJs])
  })

  it('finds pnpm under nvm when the launcher PATH has no node tools', async () => {
    const pnpm = join(home, '.nvm', 'versions', 'node', 'v20.1.0', 'bin', 'pnpm')
    await fakeBinary(pnpm)
    const command = await resolvePnpm(undefined, { PATH: '/nonexistent' }, home)
    expect(command.file).toBe(pnpm)
    expect(command.path.startsWith(join(home, '.nvm', 'versions', 'node', 'v20.1.0', 'bin'))).toBe(true)
  })

  it('ignores relative recorded paths and explains when pnpm is missing', async () => {
    await expect(resolvePnpm({ commit: 'abcdef1', branch: 'master', builtAt: 'now', toolchain: { nodePath: 'node', pnpmExecPath: 'pnpm.cjs' } }, { PATH: '/nonexistent' }, home)).rejects.toThrow(/pnpm was not found/)
  })
})
