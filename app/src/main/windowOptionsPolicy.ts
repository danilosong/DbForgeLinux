import type { BrowserWindowConstructorOptions } from 'electron'

export interface WindowRuntimeOptions {
  isPackaged: boolean
  devToolsOverride?: string
}

export interface DevToolsKeyboardInput {
  type: string
  key: string
  control: boolean
  meta: boolean
  shift: boolean
  alt: boolean
}

export function shouldEnableDevTools(runtime: WindowRuntimeOptions): boolean {
  return !runtime.isPackaged || runtime.devToolsOverride === '1'
}

export function createWindowWebPreferences(
  overrides: BrowserWindowConstructorOptions['webPreferences'] = {},
  runtime: WindowRuntimeOptions
): NonNullable<BrowserWindowConstructorOptions['webPreferences']> {
  return {
    ...overrides,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: shouldEnableDevTools(runtime)
  }
}

export function isDevToolsShortcut(input: DevToolsKeyboardInput): boolean {
  if (input.type !== 'keyDown') return false
  const key = input.key.toLowerCase()
  return key === 'f12' || ((input.control || input.meta) && input.shift && key === 'i') || (input.meta && input.alt && key === 'i')
}

export function registerDevToolsShortcutGuard(
  webContents: { on: (event: 'before-input-event', listener: (event: { preventDefault: () => void }, input: DevToolsKeyboardInput) => void) => unknown },
  runtime: WindowRuntimeOptions
): void {
  if (shouldEnableDevTools(runtime)) return
  webContents.on('before-input-event', (event, input) => {
    if (isDevToolsShortcut(input)) event.preventDefault()
  })
}
