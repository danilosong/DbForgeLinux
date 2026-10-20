import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerDocumenterIpc(deps:IpcDeps):void { void deps; ipcMain.handle('documenter:initialize',()=>{ throw new Error('not implemented') }) }
