import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerSessionsIpc(deps:IpcDeps):void { void deps; ipcMain.handle('sessions:initialize',()=>{ throw new Error('not implemented') }) }
