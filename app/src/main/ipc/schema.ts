import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import type { DatabaseObject } from '../../shared/contracts.js'
export function registerSchemaIpc({driver}:IpcDeps):void { ipcMain.handle('db:tables',(_e,id:string,db:string)=>driver.listTables(id,db)); ipcMain.handle('db:objects',(_e,id:string,db:string)=>driver.listDatabaseObjects(id,db)); ipcMain.handle('db:show-create',(_e,id:string,db:string,obj:DatabaseObject)=>driver.showCreateObject(id,db,obj)); ipcMain.handle('db:set-database',(_e,id:string,db:string)=>driver.setDatabase(id,db)) }
