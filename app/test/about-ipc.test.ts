import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockWindowRecord {
  options: Record<string, unknown>
  loaded: Array<{ path: string; opts?: unknown }>
  openHandler?: (details: { url: string }) => unknown
  webContents: { on: ReturnType<typeof vi.fn>; setWindowOpenHandler: ReturnType<typeof vi.fn> }
  loadFile: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
}
const { handlers, openExternal, openPath, windows } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  openExternal: vi.fn(async (url: string) => { void url }),
  openPath: vi.fn(async (path: string) => { void path; return '' }),
  windows: [] as MockWindowRecord[]
}))
vi.mock('electron', () => ({
  app: { getAppPath: () => process.cwd(), getVersion: () => '1.2.3', isPackaged: false },
  BrowserWindow: class {
    options: Record<string, unknown>
    webContents = {
      on: vi.fn(),
      setWindowOpenHandler: vi.fn((handler: (details: { url: string }) => unknown) => { this.windowRecord.openHandler = handler })
    }
    windowRecord: MockWindowRecord
    constructor(options: Record<string, unknown>) {
      this.options = options
      this.windowRecord = { options, webContents: this.webContents, loadFile: vi.fn(async (path: string, opts?: unknown) => { this.windowRecord.loaded.push({ path, opts }) }), loaded: [], show: vi.fn(), focus: vi.fn(), close: vi.fn(), on: vi.fn() }
      windows.push(this.windowRecord)
    }
    loadFile(path: string, opts?: unknown): Promise<void> { return this.windowRecord.loadFile(path, opts) }
    show(): void { this.windowRecord.show() }
    focus(): void { this.windowRecord.focus() }
    close(): void { this.windowRecord.close() }
    isDestroyed(): boolean { return false }
    on(event: string, listener: (...args: unknown[]) => unknown): void { this.windowRecord.on(event, listener) }
  },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) },
  shell: { openExternal, openPath }
}))
import { openChromiumLicenses, registerAboutIpc } from '../src/main/ipc/about.js'
import { shell } from 'electron'
import { aboutEnMessages, aboutPtBrMessages } from '../src/renderer/src/i18n/aboutMessages.js'

describe('About IPC', () => {
  let createdDocFiles: string[] = []
  let docsRoot: string
  beforeEach(async () => {
    handlers.clear(); openExternal.mockClear(); openPath.mockClear(); windows.length = 0
    createdDocFiles = []
    docsRoot = join(process.cwd(), 'build-resources', 'docs')
    await mkdir(join(docsRoot, 'en'), { recursive: true })
    await mkdir(join(docsRoot, 'pt-BR'), { recursive: true })
    for (const file of ['en/index.html', 'en/license.html', 'pt-BR/index.html', 'pt-BR/license.html']) {
      const path = join(docsRoot, file)
      if (!existsSync(path)) {
        await writeFile(path, '<!doctype html>')
        createdDocFiles.push(path)
      }
    }
    registerAboutIpc()
  })
  afterEach(async () => {
    for (const path of createdDocFiles) await rm(path, { force: true })
    createdDocFiles = []
    for (const window of windows) {
      const closeHandler = window.on.mock.calls.find(([event]: [string]) => event === 'closed')?.[1]
      if (typeof closeHandler === 'function') closeHandler()
    }
  })

  it('returns product and runtime versions without exposing environment values', async () => {
    const getInfo = handlers.get('about:info')!
    const info = await getInfo() as Record<string, unknown>
    expect(info).toMatchObject({ name: 'TuxSQL', version: '1.2.3', creator: 'Danilo Song', license: 'MIT', electron: process.versions.electron ?? 'unknown', chromium: process.versions.chrome ?? 'unknown', node: process.versions.node ?? 'unknown', platform: process.platform, architecture: process.arch })
    expect(info.mysql2).toMatch(/^\d+\.\d+\.\d+$/)
    expect(JSON.stringify(info)).not.toMatch(/password|secret|token|credential/i)
  })

  it('opens docs and license in a local window while only the repository opens externally', async () => {
    const openLink = handlers.get('about:open-link')!
    await openLink({}, 'documentation', 'en', 'dark')
    await openLink({}, 'license', 'pt-BR', 'light')
    await openLink({}, 'repository')
    expect(openExternal.mock.calls.map(([url]) => url)).toEqual(['https://github.com/danilosong/TuxSQL'])
    expect(windows).toHaveLength(1)
    expect(windows[0]!.loaded).toEqual([
      { path: join(docsRoot, 'en', 'index.html'), opts: { query: { theme: 'dark' } } },
      { path: join(docsRoot, 'pt-BR', 'license.html'), opts: { query: { theme: 'light' } } }
    ])
    expect(windows[0]!.options).toMatchObject({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    expect(windows[0]!.options.webPreferences).not.toHaveProperty('preload')
    await expect(openLink({}, 'https://attacker.example')).rejects.toThrow('Unsupported About link.')
  })

  it('allows only validated HTTPS links to the system browser from the docs window', async () => {
    await handlers.get('about:open-link')!({}, 'documentation')
    const openHandler = windows[0]!.openHandler as (details: { url: string }) => unknown
    expect(openHandler({ url: 'https://docs.example.test/path' })).toEqual({ action: 'deny' })
    expect(openHandler({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' })
    expect(openExternal.mock.calls.map(([url]) => url)).toEqual(['https://docs.example.test/path'])
  })

  it('blocks file navigation outside the packaged docs directory', async () => {
    await handlers.get('about:open-link')!({}, 'documentation')
    const navigation = windows[0]!.webContents.on.mock.calls.find(([event]) => event === 'will-navigate')?.[1] as ((event: { preventDefault(): void }, url: string) => void) | undefined
    expect(navigation).toBeDefined()
    const preventDefault = vi.fn()
    navigation!({ preventDefault }, pathToFileURL(join(docsRoot, 'en', 'index.html')).href)
    expect(preventDefault).not.toHaveBeenCalled()
    navigation!({ preventDefault }, 'file:///etc/passwd')
    expect(preventDefault).toHaveBeenCalledOnce()
    navigation!({ preventDefault }, 'https://docs.example.test/guide')
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(openExternal).toHaveBeenCalledWith('https://docs.example.test/guide')
  })

  it('opens Electron Chromium notices only when the validated adjacent file exists', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'tuxsql-chromium-notices-'))
    const executable = join(profile, 'tuxsql')
    try {
      expect(await openChromiumLicenses(executable)).toBe(false)
      expect(openPath).not.toHaveBeenCalled()
      const licensePath = join(profile, 'LICENSES.chromium.html')
      await writeFile(licensePath, '<html></html>')
      expect(await openChromiumLicenses(executable)).toBe(true)
      expect(openPath).toHaveBeenCalledWith(licensePath)
      expect(shell.openPath).toBe(openPath)
    } finally { await rm(profile, { recursive: true, force: true }) }
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
