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
    expect(info).toMatchObject({ name: 'TuxSQL Song', version: '1.2.3', creator: 'Danilo Song', license: 'MIT', electron: process.versions.electron ?? 'unknown', chromium: process.versions.chrome ?? 'unknown', node: process.versions.node ?? 'unknown', platform: process.platform, architecture: process.arch })
    expect(info.mysql2).toMatch(/^\d+\.\d+\.\d+$/)
    expect(JSON.stringify(info)).not.toMatch(/password|secret|token|credential/i)
  })

  it('only opens the fixed documentation, repository and license URLs', async () => {
    const openLink = handlers.get('about:open-link')!
    await openLink({}, 'documentation')
    await openLink({}, 'repository')
    await openLink({}, 'license')
    expect(openExternal.mock.calls.map(([url]) => url)).toEqual([
      'https://github.com/danilosong/TuxSQL/tree/main/document/user-guide',
      'https://github.com/danilosong/TuxSQL',
      'https://github.com/danilosong/TuxSQL/blob/main/app/LICENSE'
    ])
    await expect(openLink({}, 'https://attacker.example')).rejects.toThrow('Unsupported About link.')
  })

  it('provides the independent-project legal notice in English and pt-BR', () => {
    expect(aboutEnMessages['about.legal']).toContain('Independent implementation')
    expect(aboutPtBrMessages['about.legal']).toBe('Implementação independente inspirada em funcionalidades de ferramentas de banco de dados; não contém código nem assets do dbForge e não é afiliada à Devart.')
  })
})
