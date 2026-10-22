import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { createWindowWebPreferences, registerDevToolsShortcutGuard, type WindowRuntimeOptions } from './windowOptionsPolicy.js'

export { createWindowWebPreferences, isDevToolsShortcut, registerDevToolsShortcutGuard, shouldEnableDevTools } from './windowOptionsPolicy.js'
export type { WindowRuntimeOptions }

export function createTuxSqlBrowserWindow(options: BrowserWindowConstructorOptions = {}, runtime: WindowRuntimeOptions = { isPackaged: app.isPackaged, devToolsOverride: process.env.TUXSQL_DEVTOOLS }): BrowserWindow {
  const window = new BrowserWindow({
    ...options,
    webPreferences: createWindowWebPreferences(options.webPreferences, runtime)
  })
  registerDevToolsShortcutGuard(window.webContents, runtime)
  return window
}
