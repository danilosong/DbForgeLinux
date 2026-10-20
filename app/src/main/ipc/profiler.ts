import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
export function registerProfilerIpc(deps:IpcDeps):void { void deps; ipcMain.handle('profiler:initialize',()=>{ throw new Error('not implemented') }) }
