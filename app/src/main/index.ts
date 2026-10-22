import { app, BrowserWindow, Menu } from 'electron'
import { mkdirSync } from 'node:fs'
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
import { runScheduledBackup } from './ipc/scheduledBackup.js'

const driver = new MysqlDriver()
let vault: PasswordVault
let connectionsStore: ConnectionsStore
let mainWindow: BrowserWindow | undefined
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
try { mkdirSync(userDataDir, { recursive: true }); migrateLegacyUserData(app.getPath('appData'), userDataDir) } catch { /* best effort: start with a fresh profile */ }
const scheduledBackupArg = process.argv.indexOf('--run-backup-schedule')
const scheduledBackupId = scheduledBackupArg >= 0 ? process.argv[scheduledBackupArg + 1] : undefined
const linuxBackend = process.env.TUXSQL_LINUX_BACKEND
if (process.platform === 'linux' && (linuxBackend === 'x11' || linuxBackend === 'wayland')) app.commandLine.appendSwitch('ozone-platform', linuxBackend)
else if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
async function resolveConnectionConfig(record: ConnectionRecord): Promise<DriverConnectionConfig> {
 const [password,sshPassword,sshPassphrase,httpPassword,proxyPassword]=await Promise.all([resolveSecret(record.passwordRef),resolveSecret(record.ssh.passwordRef),resolveSecret(record.ssh.passphraseRef),resolveSecret(record.http.passwordRef),resolveSecret(record.http.proxyPasswordRef)])
 return {...record,password:password??undefined,ssh:{...record.ssh,password:sshPassword??undefined,passphrase:sshPassphrase??undefined,keyboardInteractivePrompt:requestSshKeyboardInteractive},http:{...record.http,password:httpPassword??undefined,proxyPassword:proxyPassword??undefined}}
}
if (scheduledBackupId !== undefined) {
 app.whenReady().then(async () => {
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
 const hasSingleInstance = app.requestSingleInstanceLock()
 if (!hasSingleInstance) app.quit()
 app.on('second-instance', (_event, argv) => { const file=argv.find((arg)=>arg.toLowerCase().endsWith('.sql'));if(file)queueSqlPath(file);if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()} })
 app.on('open-file', (event, path) => { event.preventDefault(); queueSqlPath(path) })
}
function resolveSecret(ref:string|undefined):Promise<string|null>{return ref?vault.get(ref):Promise.resolve(null)}
function createWindow():void {
 const window=new BrowserWindow({width:1440,height:900,minWidth:1024,minHeight:640,autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}})
 mainWindow=window
 const rendererUrl=process.env.ELECTRON_RENDERER_URL
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.on('will-navigate',(event,url)=>{const current=rendererUrl??pathToFileURL(join(__dirname,'../renderer/index.html')).toString();if(!isTrustedRendererNavigation(current,url))event.preventDefault()})
 window.webContents.on('will-attach-webview',(event)=>event.preventDefault())
 window.webContents.once('did-finish-load',()=>{for(const path of pendingSqlPaths.splice(0))window.webContents.send('app:open-sql-path',path)})
 window.on('closed',()=>{if(mainWindow===window)mainWindow=undefined})
 if(rendererUrl)void window.loadURL(rendererUrl);else void window.loadFile(join(__dirname,'../renderer/index.html'))
}
 if (scheduledBackupId === undefined) app.whenReady().then(()=>{vault=new PasswordVault(join(app.getPath('userData'),'vault'));connectionsStore=new ConnectionsStore(join(app.getPath('userData'),'connections.json'));registerIpcRegistry({driver,vault,connectionsStore,resolveConnectionConfig,userDataDir:app.getPath('userData')});for(const arg of process.argv)if(arg.toLowerCase().endsWith('.sql'))queueSqlPath(arg);Menu.setApplicationMenu(null);createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
