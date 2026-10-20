import { app, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { AboutInfo, AboutLink } from '../../shared/contracts/about.js'

const links: Record<AboutLink, string> = {
  documentation: 'https://github.com/danilosong/DbForgeLinux/tree/main/document/user-guide',
  repository: 'https://github.com/danilosong/DbForgeLinux',
  license: 'https://github.com/danilosong/DbForgeLinux/blob/main/app/LICENSE'
}

export function registerAboutIpc(): void {
  ipcMain.handle('about:info', (): AboutInfo => {
    const packageRequire = createRequire(join(app.getAppPath(), 'package.json'))
    const mysql2Version = String((packageRequire('mysql2/package.json') as { version?: string }).version ?? 'unknown')
    return {
      name: 'dbForgeLinux',
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
  ipcMain.handle('about:open-link', async (_event, link: AboutLink): Promise<void> => {
    const url = links[link]
    if (!url) throw new TypeError('Unsupported About link.')
    await shell.openExternal(url)
  })
}
