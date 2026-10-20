import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerDataCompareIpc(deps:IpcDeps):void { void deps; ipcMain.handle('data-compare:initialize',()=>{ throw new Error('not implemented') }) }
