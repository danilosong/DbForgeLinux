import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import type { UpdateCheckResult } from 'electron-updater'
import type { SettingsStore } from '../../modules/options/index.js'
import { UpdateService } from '../../modules/updater/UpdateService.js'
import type { UpdatePreferences, ReleaseUpdate } from '../../modules/updater/types.js'
import type { MysqlDriver } from '../db/MysqlDriver.js'

function releaseNotes(result: UpdateCheckResult): string[] {
  const notes = result.updateInfo.releaseNotes
  if (typeof notes === 'string') return notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 200)
  if (Array.isArray(notes)) return notes.flatMap((item) => typeof item === 'string' ? [item] : item.note ? [item.note] : []).slice(0, 200)
  return []
}

export function registerUpdaterIpc(store: SettingsStore, driver: MysqlDriver): UpdateService {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  const preferences = async (): Promise<UpdatePreferences> => (await store.load()).settings.updater
  type DownloadToken = NonNullable<Parameters<typeof autoUpdater.downloadUpdate>[0]>
  const updaterRequire = createRequire(require.resolve('electron-updater'))
  const CancellationTokenCtor = updaterRequire('builder-util-runtime').CancellationToken as new () => DownloadToken
  let downloadToken: DownloadToken | undefined
  const release = {
    async check(): Promise<ReleaseUpdate | null> {
      try {
        const result = await autoUpdater.checkForUpdates()
        if (!result?.updateInfo?.version) return null
        return { version: result.updateInfo.version, notes: releaseNotes(result), sha512: result.updateInfo.sha512 }
      } catch (error) {
        const response = await fetch('https://api.github.com/repos/danilosong/DbForgeLinux/releases/latest', {
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'dbForgeLinux-updater', ...(process.env.GH_TOKEN || process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN}` } : {}) },
          redirect: 'error', signal: AbortSignal.timeout(10_000)
        }).catch(() => undefined)
        if (!response?.ok) throw error
        const metadata: unknown = await response.json()
        if (!metadata || typeof metadata !== 'object') return null
        const latest = metadata as { tag_name?: unknown; body?: unknown }
        if (typeof latest.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+/.test(latest.tag_name)) return null
        const notes = typeof latest.body === 'string' ? latest.body.split(/\r?\n/).filter(Boolean).slice(0, 200) : []
        return { version: latest.tag_name.replace(/^v/, ''), notes }
      }
    },
    async download(): Promise<void> { downloadToken = new CancellationTokenCtor(); await autoUpdater.downloadUpdate(downloadToken) },
    cancel(): void { downloadToken?.cancel(); downloadToken = undefined },
    install(): void { autoUpdater.quitAndInstall(false, true) },
    async openReleasePage(): Promise<void> { await shell.openExternal('https://github.com/danilosong/DbForgeLinux/releases/latest') }
  }
  const service = new UpdateService({
    appVersion: app.getVersion(),
    buildInfoPath: join(app.getAppPath(), 'out', 'buildInfo.json'),
    statePath: join(app.getPath('userData'), 'updater-last-check'),
    settings: preferences,
    release,
    isBusy: () => driver.hasActiveWork(),
    relaunch: () => { app.relaunch(); app.exit(0) },
    emit: (status) => { for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('updater:status-event', status) }
  })
  autoUpdater.on('download-progress', (event) => service.reportDownloadProgress(event.percent))
  autoUpdater.on('error', (error) => { if (service.status().channel === 'release') service.setError(error.message) })
  ipcMain.handle('updater:check', () => service.check())
  ipcMain.handle('updater:apply', (_event, input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'confirmBusy') || typeof (input as { confirmBusy?: unknown }).confirmBusy !== 'boolean') throw new TypeError('Invalid updater apply request.')
    return service.apply((input as { confirmBusy: boolean }).confirmBusy)
  })
  ipcMain.handle('updater:cancel', () => service.cancel())
  ipcMain.handle('updater:status', () => service.status())
  const startupTimer = setTimeout(() => { void service.checkStartup() }, 3000)
  startupTimer.unref?.()
  return service
}
