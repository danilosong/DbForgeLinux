import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerSchemaCompareIpc(deps:IpcDeps):void { void deps; ipcMain.handle('schema-compare:initialize',()=>{ throw new Error('not implemented') }) }
