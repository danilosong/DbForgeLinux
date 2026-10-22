import { describe, expect, it } from 'vitest'
import { createWindowWebPreferences, isDevToolsShortcut, registerDevToolsShortcutGuard, shouldEnableDevTools } from '../src/main/windowOptionsPolicy.js'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(resolve(process.cwd(), 'package.json'))
const { applyReleaseFuses } = require('./packaging/afterPack.cjs') as {
  applyReleaseFuses: (context: unknown, dependencies?: Record<string, unknown>) => Promise<boolean>
}

describe('shared BrowserWindow security options', () => {
  it('enables DevTools in unpackaged builds and only opts in for packaged builds', () => {
    expect(shouldEnableDevTools({ isPackaged: false })).toBe(true)
    expect(shouldEnableDevTools({ isPackaged: true })).toBe(false)
    expect(shouldEnableDevTools({ isPackaged: true, devToolsOverride: '1' })).toBe(true)
    expect(shouldEnableDevTools({ isPackaged: true, devToolsOverride: 'true' })).toBe(false)
  })

  it('forces secure preferences while retaining window-specific preload settings', () => {
    expect(createWindowWebPreferences({ preload: '/tmp/preload.js', sandbox: false, contextIsolation: false, nodeIntegration: true }, { isPackaged: true })).toEqual({
      preload: '/tmp/preload.js', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, devTools: false
    })
  })

  it('blocks DevTools keyboard shortcuts only on key-down events', () => {
    expect(isDevToolsShortcut({ type: 'keyDown', key: 'F12', control: false, meta: false, shift: false, alt: false })).toBe(true)
    expect(isDevToolsShortcut({ type: 'keyDown', key: 'I', control: true, meta: false, shift: true, alt: false })).toBe(true)
    expect(isDevToolsShortcut({ type: 'keyDown', key: 'i', control: false, meta: true, shift: false, alt: true })).toBe(true)
    expect(isDevToolsShortcut({ type: 'keyUp', key: 'F12', control: false, meta: false, shift: false, alt: false })).toBe(false)
    expect(isDevToolsShortcut({ type: 'keyDown', key: 'I', control: true, meta: false, shift: false, alt: false })).toBe(false)
  })

  it('attaches the release shortcut guard and prevents DevTools accelerators', () => {
    let listener: ((event: { preventDefault: () => void }, input: { type: string; key: string; control: boolean; meta: boolean; shift: boolean; alt: boolean }) => void) | undefined
    const webContents = { on: (_event: 'before-input-event', callback: typeof listener) => { listener = callback } }
    registerDevToolsShortcutGuard(webContents, { isPackaged: true })
    expect(listener).toBeDefined()
    let prevented = false
    listener?.({ preventDefault: () => { prevented = true } }, { type: 'keyDown', key: 'I', control: true, meta: false, shift: true, alt: false })
    expect(prevented).toBe(true)
    const devWebContents = { on: () => { throw new Error('Dev build must preserve shortcuts.') } }
    registerDevToolsShortcutGuard(devWebContents, { isPackaged: false })
  })
})

describe('release Electron fuses', () => {
  const context = { electronPlatformName: 'linux', appOutDir: '/tmp/tuxsql', packager: { executableName: 'tuxsql' } }
  const fuses = {
    FuseVersion: { V1: 'v1' },
    FuseV1Options: {
      RunAsNode: 'runAsNode', EnableNodeOptionsEnvironmentVariable: 'nodeOptions', EnableNodeCliInspectArguments: 'nodeInspect',
      EnableCookieEncryption: 'cookieEncryption', OnlyLoadAppFromAsar: 'onlyAsar'
    },
    flipFuses: async () => undefined
  }

  it('leaves electron-builder test builds untouched without the explicit release flag', async () => {
    let called = false
    const wasApplied = await applyReleaseFuses(context, { env: {}, fuses: { ...fuses, flipFuses: async () => { called = true } } })
    expect(wasApplied).toBe(false)
    expect(called).toBe(false)
  })

  it('applies only the intended release fuses to the packaged Linux executable', async () => {
    let invocation: { path: string; options: Record<string, unknown> } | undefined
    const wasApplied = await applyReleaseFuses(context, {
      env: { TUXSQL_RELEASE_BUILD: '1' },
      fuses: { ...fuses, flipFuses: async (path: string, options: Record<string, unknown>) => { invocation = { path, options } } }
    })
    expect(wasApplied).toBe(true)
    expect(invocation).toEqual({
      path: '/tmp/tuxsql/tuxsql',
      options: { version: 'v1', runAsNode: false, nodeOptions: false, nodeInspect: false, cookieEncryption: true, onlyAsar: true }
    })
  })
})
