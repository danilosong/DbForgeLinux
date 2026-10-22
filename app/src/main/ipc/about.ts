import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { AboutInfo, AboutLink } from '../../shared/contracts/about.js'
import { createTuxSqlBrowserWindow } from '../windowOptions.js'

let docsWindow: BrowserWindow | undefined

export function isSafeExternalDocumentationUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

export function isWithinDocumentationRoot(rawFileUrl: string, root: string): boolean {
  try {
    const file = realpathSync(fileURLToPath(rawFileUrl))
    const docs = realpathSync(root)
    const pathFromRoot = relative(docs, file)
    return pathFromRoot !== '' && !isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && file.endsWith('.html')
  } catch { return false }
}

function documentationRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'docs') : join(app.getAppPath(), 'build-resources', 'docs')
}

function chromeLicensesPath(executablePath: string): string | undefined {
  const candidate = join(dirname(executablePath), 'LICENSES.chromium.html')
  if (!existsSync(candidate)) return undefined
  try {
    const path = realpathSync(candidate)
    return dirname(path) === realpathSync(dirname(executablePath)) ? path : undefined
  } catch { return undefined }
}

export async function openChromiumLicenses(executablePath = process.execPath): Promise<boolean> {
  const path = chromeLicensesPath(executablePath)
  if (!path) return false
  await shell.openPath(path)
  return true
}

function openExternalDocumentation(raw: string): void {
  if (isSafeExternalDocumentationUrl(raw)) void shell.openExternal(raw)
}

function createDocumentationWindow(link: 'documentation' | 'license', locale: 'en' | 'pt-BR', theme: 'light' | 'dark'): void {
  const root = documentationRoot()
  const file = join(root, locale, link === 'license' ? 'license.html' : 'index.html')
  if (!isWithinDocumentationRoot(pathToFileURL(file).href, root)) throw new Error('Offline documentation file is missing or outside the packaged documentation directory.')
  if (docsWindow && !docsWindow.isDestroyed()) {
    void docsWindow.loadFile(file, { query: { theme } })
    docsWindow.show()
    docsWindow.focus()
    return
  }
  const window = createTuxSqlBrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 680,
    minHeight: 480,
    show: false,
    title: 'TuxSQL',
    webPreferences: { webviewTag: false, javascript: true, allowRunningInsecureContent: false }
  })
  docsWindow = window
  window.on('closed', () => { if (docsWindow === window) docsWindow = undefined })
  window.webContents.on('will-navigate', (event, url) => {
    if (isWithinDocumentationRoot(url, root)) return
    event.preventDefault()
    if (isSafeExternalDocumentationUrl(url)) openExternalDocumentation(url)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'tuxsql-internal://chromium-license') {
      void openChromiumLicenses()
      return { action: 'deny' }
    }
    if (isSafeExternalDocumentationUrl(url)) openExternalDocumentation(url)
    return { action: 'deny' }
  })
  void window.loadFile(file, { query: { theme } }).then(() => window.show()).catch(() => window.close())
}

export function registerAboutIpc(): void {
  ipcMain.handle('about:info', (): AboutInfo => {
    const packageRequire = createRequire(join(app.getAppPath(), 'package.json'))
    const mysql2Version = String((packageRequire('mysql2/package.json') as { version?: string }).version ?? 'unknown')
    return {
      name: 'TuxSQL',
      version: app.getVersion(),
      creator: 'Danilo Song',
      license: 'MIT',
      electron: process.versions.electron ?? 'unknown',
      chromium: process.versions.chrome ?? 'unknown',
      node: process.versions.node ?? 'unknown',
      mysql2: mysql2Version,
      platform: process.platform,
      architecture: process.arch
    }
  })
  ipcMain.handle('about:open-link', async (_event, link: AboutLink, locale: unknown = 'en', theme: unknown = 'light'): Promise<void> => {
    if (link === 'repository') {
      await shell.openExternal('https://github.com/danilosong/TuxSQL')
      return
    }
    if (link !== 'documentation' && link !== 'license') throw new TypeError('Unsupported About link.')
    const selectedLocale = locale === 'pt-BR' ? 'pt-BR' : 'en'
    const selectedTheme = theme === 'dark' ? 'dark' : 'light'
    createDocumentationWindow(link, selectedLocale, selectedTheme)
  })
}
