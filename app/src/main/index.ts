import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { MysqlDriver } from './db/MysqlDriver.js'
import { ConnectionsStore } from './connections/ConnectionsStore.js'
import type { DriverConnectionConfig } from './db/DbDriver.js'
import { PasswordVault } from './security/PasswordVault.js'
import type { ConnectionRecord } from '../shared/contracts.js'
import { registerIpcRegistry } from './ipc/registry.js'

const driver = new MysqlDriver()
let vault: PasswordVault
let connectionsStore: ConnectionsStore
async function resolveConnectionConfig(record: ConnectionRecord): Promise<DriverConnectionConfig> {
 const [password,sshPassword,sshPassphrase,httpPassword,proxyPassword]=await Promise.all([resolveSecret(record.passwordRef),resolveSecret(record.ssh.passwordRef),resolveSecret(record.ssh.passphraseRef),resolveSecret(record.http.passwordRef),resolveSecret(record.http.proxyPasswordRef)])
 return {...record,password:password??undefined,ssh:{...record.ssh,password:sshPassword??undefined,passphrase:sshPassphrase??undefined},http:{...record.http,password:httpPassword??undefined,proxyPassword:proxyPassword??undefined}}
}
function resolveSecret(ref:string|undefined):Promise<string|null>{return ref?vault.get(ref):Promise.resolve(null)}
function createWindow():void { const window=new BrowserWindow({width:1440,height:900,minWidth:1024,minHeight:640,webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});if(process.env.ELECTRON_RENDERER_URL)void window.loadURL(process.env.ELECTRON_RENDERER_URL);else void window.loadFile(join(__dirname,'../renderer/index.html')) }
app.whenReady().then(()=>{vault=new PasswordVault(join(app.getPath('userData'),'vault'));connectionsStore=new ConnectionsStore(join(app.getPath('userData'),'connections.json'));registerIpcRegistry({driver,vault,connectionsStore,resolveConnectionConfig});createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
