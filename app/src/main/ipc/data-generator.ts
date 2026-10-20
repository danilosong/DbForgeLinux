import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerDataGeneratorIpc(deps:IpcDeps):void { void deps; ipcMain.handle('data-generator:initialize',()=>{ throw new Error('not implemented') }) }
