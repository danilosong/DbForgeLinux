import { initializeStartupTrace, isStartupRendererMilestone, markStartup } from './startupTrace.js'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MysqlDriver } from './db/MysqlDriver.js'
import { ConnectionsStore } from './connections/ConnectionsStore.js'
import type { DriverConnectionConfig } from './db/DbDriver.js'
import { PasswordVault } from './security/PasswordVault.js'
import type { ConnectionRecord } from '../shared/contracts.js'
import { registerIpcRegistry } from './ipc/registry.js'
import { requestSshKeyboardInteractive } from './ipc/keyboard-interactive.js'
import { isTrustedRendererNavigation } from './security/windowPolicy.js'
import { migrateLegacyUserData } from './legacyData.js'
import { ensurePrivateDirectory } from './security/privateDirectory.js'
import { runScheduledBackup } from './ipc/scheduledBackup.js'
import { createTuxSqlBrowserWindow } from './windowOptions.js'
import { SettingsStore } from '../modules/options/index.js'
import { SplashProgressModel, type SplashPhase, type SplashCompletionReason } from '../modules/startup/splashProgress.js'
import { splashEnMessages } from '../shared/splashMessages.js'
import { ptBrModulesSplash } from '../shared/ptBrSplashMessages.js'

const driver = new MysqlDriver()
let vault: PasswordVault
let connectionsStore: ConnectionsStore
let mainWindow: BrowserWindow | undefined
let splashWindow: BrowserWindow | undefined
let splashProgressModel: SplashProgressModel | undefined
let splashTimeout: NodeJS.Timeout | undefined
let splashLocale: 'en' | 'pt-BR' = 'en'
let splashEnabled = false
let splashHasBeenShown = false
let splashDidFinishLoad = false
let splashReadyToShow = false
let splashPreferenceResolved = false
let mainReadyToShow = false
let ownsSingleInstance = false
let lastSplashPayload: { percent: number; label: string; version: string; kicker: string } | undefined
const pendingSqlPaths: string[] = []
function queueSqlPath(path: string): void {
 if (path.startsWith('file:')) { try { path=fileURLToPath(path) } catch { return } }
 if (!path.toLowerCase().endsWith('.sql')) return
 if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:open-sql-path', path)
 else pendingSqlPaths.push(path)
}
// Pin the data directory so it no longer depends on the product name, and bring over data from the old name.
const userDataDir = join(app.getPath('appData'), 'tuxsql')
app.setPath('userData', userDataDir)
markStartup('user-data-preparation-start')
try { ensurePrivateDirectory(userDataDir); markStartup('ensure-private-directory-complete') } catch { markStartup('ensure-private-directory-failed') }
try { migrateLegacyUserData(app.getPath('appData'), userDataDir); markStartup('legacy-user-data-migration-complete') } catch { markStartup('legacy-user-data-migration-failed') }
initializeStartupTrace(userDataDir)
const scheduledBackupArg = process.argv.indexOf('--run-backup-schedule')
const scheduledBackupId = scheduledBackupArg >= 0 ? process.argv[scheduledBackupArg + 1] : undefined
const splashPreviewEnv = process.env.TUXSQL_SPLASH_PREVIEW
const splashPreviewPercent = splashPreviewEnv === '0' || splashPreviewEnv === '45' || splashPreviewEnv === '100' ? Number(splashPreviewEnv) : undefined
const startupRequiresEditor = process.argv.some((arg) => arg.toLowerCase().endsWith('.sql'))
function splashLaunchOptedOut(): boolean {
 return scheduledBackupId !== undefined || process.env.TUXSQL_NO_SPLASH === '1' || process.argv.includes('--no-splash')
  || process.argv.some((arg) => /^--(?:remote-debugging-port|inspect(?:-brk|-port)?)(?:=|$)/.test(arg))
}
function splashPayload(phase: SplashPhase, percent: number): { percent: number; label: string; version: string; kicker: string } {
 const key = `splash.stage.${phase}` as keyof typeof splashEnMessages
 const labels: Record<keyof typeof splashEnMessages, string> = splashLocale === 'pt-BR' ? ptBrModulesSplash : splashEnMessages
 return { percent, label: labels[key], version: app.getVersion(), kicker: labels['splash.brand.kicker'] }
}
function sendSplashPayload(payload: { percent: number; label: string; version: string; kicker: string }): void {
 lastSplashPayload = payload
 if (splashDidFinishLoad && splashWindow && !splashWindow.isDestroyed()) splashWindow.webContents.send('splash:progress', payload)
}
function advanceSplash(phase: SplashPhase): void {
 const snapshot = splashProgressModel?.advance(phase)
 if (snapshot) sendSplashPayload(splashPayload(snapshot.phase, snapshot.percent))
}
function finishSplash(reason: SplashCompletionReason = 'ready'): void {
 if (splashTimeout) clearTimeout(splashTimeout)
 splashTimeout = undefined
 const snapshot = splashProgressModel?.complete(reason)
 const window = splashWindow
 if (snapshot) {
  const payload = splashPayload(snapshot.phase, snapshot.percent)
  if (reason === 'timeout' || reason === 'error') payload.label = (splashLocale === 'pt-BR' ? ptBrModulesSplash : splashEnMessages)['splash.stage.error']
  sendSplashPayload(payload)
 }
 if (!window || window.isDestroyed()) { splashWindow = undefined; return }
 const close = (): void => { if (splashWindow === window) splashWindow = undefined; if (!window.isDestroyed()) window.close(); markStartup('splash-closed') }
 if ((reason === 'timeout' || reason === 'error') && splashDidFinishLoad) setTimeout(close, 1200).unref?.()
 else close()
}
function revealSplashWhenReady(): void {
 if (!splashEnabled || !splashReadyToShow || !splashWindow || splashWindow.isDestroyed() || splashHasBeenShown) return
 splashWindow.show()
 splashHasBeenShown = true
 markStartup('splash-window-shown')
 showMainWindowWhenReady()
}
function showMainWindowWhenReady(): void {
 if (!splashPreferenceResolved || !mainReadyToShow || !mainWindow || mainWindow.isDestroyed() || (splashEnabled && !splashHasBeenShown)) return
 mainWindow.show()
 markStartup('main-window-shown')
}
function createSplashWindow(): void {
 try {
  splashProgressModel = new SplashProgressModel()
  splashProgressModel.advance('starting')
  const options = {
   width: 560, height: 340, minWidth: 560, maxWidth: 560, minHeight: 340, maxHeight: 340,
   frame: false, transparent: false, backgroundColor: '#13191c', resizable: false, maximizable: false,
   minimizable: false, alwaysOnTop: true, skipTaskbar: true, show: false, autoHideMenuBar: true,
   title: 'TuxSQL Startup', webPreferences: { preload: join(__dirname, '../preload/splash.js') }
  }
  const window = createTuxSqlBrowserWindow(options)
  splashWindow = window
  markStartup('splash-window-created')
  window.center()
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const splashFile = join(__dirname, '../renderer/splash.html')
  window.webContents.on('will-navigate', (event, target) => {
   try { if (fileURLToPath(target) !== splashFile) event.preventDefault() } catch { event.preventDefault() }
  })
  window.once('ready-to-show', () => {
   splashReadyToShow = true
   markStartup('splash-ready-to-show')
   revealSplashWhenReady()
  })
  window.webContents.once('did-finish-load', () => {
   splashDidFinishLoad = true
   markStartup('splash-did-finish-load')
   if (lastSplashPayload) sendSplashPayload(lastSplashPayload)
  })
  window.webContents.on('did-fail-load', () => { markStartup('splash-load-failed'); finishSplash('error') })
  window.webContents.on('render-process-gone', () => { markStartup('splash-renderer-gone'); finishSplash('error') })
  window.on('closed', () => { if (splashWindow === window) splashWindow = undefined })
  const query = splashPreviewPercent === undefined ? undefined : { preview: String(splashPreviewPercent) }
  void window.loadFile(splashFile, query ? { query } : undefined).catch(() => finishSplash('error'))
  splashTimeout = setTimeout(() => { markStartup('splash-safety-timeout'); finishSplash('timeout') }, 25_000)
  splashTimeout.unref?.()
 } catch { finishSplash('error') }
}
const linuxBackend = process.env.TUXSQL_LINUX_BACKEND
if (process.platform === 'linux' && (linuxBackend === 'x11' || linuxBackend === 'wayland')) app.commandLine.appendSwitch('ozone-platform', linuxBackend)
else if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
async function resolveConnectionConfig(record: ConnectionRecord): Promise<DriverConnectionConfig> {
 const [password,sshPassword,sshPassphrase,httpPassword,proxyPassword]=await Promise.all([resolveSecret(record.passwordRef),resolveSecret(record.ssh.passwordRef),resolveSecret(record.ssh.passphraseRef),resolveSecret(record.http.passwordRef),resolveSecret(record.http.proxyPasswordRef)])
 return {...record,password:password??undefined,ssh:{...record.ssh,password:sshPassword??undefined,passphrase:sshPassphrase??undefined,keyboardInteractivePrompt:requestSshKeyboardInteractive},http:{...record.http,password:httpPassword??undefined,proxyPassword:proxyPassword??undefined}}
}
if (scheduledBackupId !== undefined) {
 app.whenReady().then(async () => {
  markStartup('app-ready-scheduled-mode')
  try {
   if (!/^[a-f\d-]{36}$/i.test(scheduledBackupId)) throw new Error('Invalid schedule identifier.')
   vault = new PasswordVault(join(app.getPath('userData'), 'vault'))
   connectionsStore = new ConnectionsStore(join(app.getPath('userData'), 'connections.json'))
   await runScheduledBackup({ connectionStore: connectionsStore, userDataDir: app.getPath('userData'), driver, resolveConnectionConfig }, scheduledBackupId)
   app.exit(0)
  } catch {
   process.stderr.write('Scheduled backup failed. Check the TuxSQL connection, unlocked credential vault, and backup folder.\n')
   app.exit(1)
  }
 })
} else {
 ownsSingleInstance = app.requestSingleInstanceLock()
 if (!ownsSingleInstance) app.quit()
 else {
  app.on('second-instance', (_event, argv) => { const file=argv.find((arg)=>arg.toLowerCase().endsWith('.sql'));if(file)queueSqlPath(file);if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()} })
  app.on('open-file', (event, path) => { event.preventDefault(); queueSqlPath(path) })
 }
}
function resolveSecret(ref:string|undefined):Promise<string|null>{return ref?vault.get(ref):Promise.resolve(null)}
function createWindow():void {
 const window=createTuxSqlBrowserWindow({width:1440,height:900,minWidth:1024,minHeight:640,autoHideMenuBar:true,show:false,webPreferences:{preload:join(__dirname,'../preload/index.js')}})
 mainWindow=window
 markStartup('main-window-created')
 window.once('ready-to-show',()=>{mainReadyToShow=true;markStartup('main-window-ready-to-show');advanceSplash('editor');showMainWindowWhenReady()})
  window.webContents.once('did-finish-load',()=>markStartup('main-window-did-finish-load'))
 window.webContents.on('did-fail-load',()=>finishSplash('error'))
 window.webContents.on('render-process-gone',()=>finishSplash('error'))
 const rendererUrl=process.env.ELECTRON_RENDERER_URL
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.on('will-navigate',(event,url)=>{const current=rendererUrl??pathToFileURL(join(__dirname,'../renderer/index.html')).toString();if(!isTrustedRendererNavigation(current,url))event.preventDefault()})
 window.webContents.on('will-attach-webview',(event)=>event.preventDefault())
 window.webContents.once('did-finish-load',()=>{for(const path of pendingSqlPaths.splice(0))window.webContents.send('app:open-sql-path',path)})
 window.on('closed',()=>{if(mainWindow===window)mainWindow=undefined})
 if(rendererUrl)void window.loadURL(rendererUrl);else void window.loadFile(join(__dirname,'../renderer/index.html'))
}
if (scheduledBackupId === undefined && ownsSingleInstance) {
 ipcMain.on('startup:trace', (event, milestone: unknown) => {
  if (event.sender !== mainWindow?.webContents || !isStartupRendererMilestone(milestone)) return
  markStartup(milestone)
  if (milestone === 'renderer-settings-loaded') advanceSplash('interface')
  if (milestone === 'renderer-first-paint') advanceSplash('editor')
  if (milestone === 'renderer-editor-interactive' || (milestone === 'renderer-app-interactive' && !startupRequiresEditor)) finishSplash('ready')
 })
 app.whenReady().then(()=>{
  markStartup('app-ready')
  if (splashPreviewPercent !== undefined) {
   splashLocale = 'en'
   splashEnabled = true
   createSplashWindow()
   const phase: SplashPhase = splashPreviewPercent >= 100 ? 'ready' : splashPreviewPercent >= 45 ? 'interface' : 'starting'
   sendSplashPayload(splashPayload(phase, splashPreviewPercent))
   return
  }
  if (!splashLaunchOptedOut()) {
   createSplashWindow()
   void new SettingsStore(join(userDataDir, 'settings.json')).load().then(({ settings }) => {
    const configuredLocale = settings.language.locale === 'system' ? app.getLocale() : settings.language.locale
    splashLocale = configuredLocale.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
    splashPreferenceResolved = true
    if (!settings.environment.showSplash) { finishSplash('ready'); showMainWindowWhenReady(); return }
    splashEnabled = true
    revealSplashWhenReady()
    showMainWindowWhenReady()
    const current = splashProgressModel?.snapshot()
    if (current) sendSplashPayload(splashPayload(current.phase, current.percent))
   }).catch(() => {
    splashLocale = app.getLocale().toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
    splashPreferenceResolved = true
    splashEnabled = true
    revealSplashWhenReady()
    showMainWindowWhenReady()
   })
  } else splashPreferenceResolved = true
  advanceSplash('vault')
  markStartup('password-vault-construction-start')
  vault=new PasswordVault(join(app.getPath('userData'),'vault'))
  markStartup('password-vault-constructed')
  advanceSplash('settings')
  connectionsStore=new ConnectionsStore(join(app.getPath('userData'),'connections.json'))
  markStartup('connections-store-constructed')
  markStartup('ipc-registry-start')
  registerIpcRegistry({driver,vault,connectionsStore,resolveConnectionConfig,userDataDir:app.getPath('userData')})
  markStartup('ipc-registry-complete')
  for(const arg of process.argv)if(arg.toLowerCase().endsWith('.sql'))queueSqlPath(arg)
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})
 })
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
