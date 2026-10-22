import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, openExternal } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  openExternal: vi.fn(async (url: string) => { void url })
}))
vi.mock('electron', () => ({
  app: { getAppPath: () => process.cwd(), getVersion: () => '1.2.3' },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) },
  shell: { openExternal }
}))
import { registerAboutIpc } from '../src/main/ipc/about.js'
import { aboutEnMessages, aboutPtBrMessages } from '../src/renderer/src/i18n/aboutMessages.js'

describe('About IPC', () => {
  beforeEach(() => { handlers.clear(); openExternal.mockClear(); registerAboutIpc() })

  it('returns product and runtime versions without exposing environment values', async () => {
    const getInfo = handlers.get('about:info')!
    const info = await getInfo() as Record<string, unknown>
    expect(info).toMatchObject({ name: 'TuxSQL', version: '1.2.3', creator: 'Danilo Song', license: 'MIT', electron: process.versions.electron ?? 'unknown', chromium: process.versions.chrome ?? 'unknown', node: process.versions.node ?? 'unknown', platform: process.platform, architecture: process.arch })
    expect(info.mysql2).toMatch(/^\d+\.\d+\.\d+$/)
    expect(JSON.stringify(info)).not.toMatch(/password|secret|token|credential/i)
  })

  it('only opens the fixed documentation, repository and license URLs', async () => {
    const openLink = handlers.get('about:open-link')!
    await openLink({}, 'documentation')
    await openLink({}, 'repository')
    await openLink({}, 'license')
    expect(openExternal.mock.calls.map(([url]) => url)).toEqual([
      'https://github.com/danilosong/TuxSQL/tree/HEAD/document/user-guide',
      'https://github.com/danilosong/TuxSQL',
      'https://github.com/danilosong/TuxSQL/blob/HEAD/LICENSE'
    ])
    await expect(openLink({}, 'https://attacker.example')).rejects.toThrow('Unsupported About link.')
  })

  it('keeps every opened link pointing at a file that exists in the repository and never at a fixed branch', async () => {
    const openLink = handlers.get('about:open-link')!
    for (const link of ['documentation', 'repository', 'license'] as const) await openLink({}, link)
    const repoRoot = join(process.cwd(), '..')
    for (const [url] of openExternal.mock.calls as Array<[string]>) {
      const match = /^https:\/\/github\.com\/danilosong\/TuxSQL(?:\/(?:tree|blob)\/([^/]+)\/(.+))?$/.exec(url)
      expect(match, url).not.toBeNull()
      if (!match?.[1]) continue
      expect(match[1], `${url} must use HEAD so it follows the default branch`).toBe('HEAD')
      expect(existsSync(join(repoRoot, match[2]!)), `${match[2]} must exist in the repository`).toBe(true)
    }
  })

  it('describes the project as an independent client without naming third-party products', () => {
    for (const text of [aboutEnMessages['about.legal'], aboutPtBrMessages['about.legal']]) {
      expect(text).toContain('TuxSQL')
      expect(text).not.toMatch(/dbforge|devart/i)
    }
    expect(aboutEnMessages['about.legal']).toContain('independent database client')
    expect(aboutPtBrMessages['about.legal']).toContain('cliente de banco de dados independente')
  })
})
