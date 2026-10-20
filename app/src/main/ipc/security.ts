import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerSecurityIpc({vault}:IpcDeps):void { ipcMain.handle('vault:save',(_e,key:string,password:string)=>vault.save(key,password)); ipcMain.handle('vault:delete',(_e,key:string)=>vault.delete(key)) }
