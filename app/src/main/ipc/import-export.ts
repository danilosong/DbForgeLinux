import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerImportExportIpc(deps:IpcDeps):void { void deps; ipcMain.handle('import-export:initialize',()=>{ throw new Error('not implemented') }) }
