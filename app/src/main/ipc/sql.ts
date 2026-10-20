import { ipcMain, BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import type { IpcDeps } from './registry.js'
import type { ConnectionRecord } from '../../shared/contracts.js'
import { editorMetadataCache } from './editor.js'
export function registerSqlIpc({driver,resolveConnectionConfig}:IpcDeps):void {
 ipcMain.handle('db:test',async(_e,r:ConnectionRecord)=>driver.testConnection(await resolveConnectionConfig(r)))
 ipcMain.handle('db:connect',async(_e,r:ConnectionRecord)=>{const id=await driver.connect(await resolveConnectionConfig(r));return {id,recordId:r.id,name:r.name,host:r.host,port:r.port,user:r.user,database:r.database,environment:r.environment,color:r.color}})
 ipcMain.handle('db:disconnect',async(_e,id:string)=>{editorMetadataCache.invalidate(id);await driver.disconnect(id)}); ipcMain.handle('db:databases',(_e,id:string)=>driver.listDatabases(id))
 ipcMain.handle('db:execute',async(_e,id:string,sql:string,executionId?:string)=>{const result=await driver.executeSql(id,sql,executionId);if(/\b(CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(sql))editorMetadataCache.invalidate(id);return result}); ipcMain.handle('db:cancel',(_e,id:string,eid:string)=>driver.cancelQuery(id,eid))
 ipcMain.handle('db:transaction-begin',(_e,id:string)=>driver.beginTransaction(id)); ipcMain.handle('db:transaction-commit',(_e,id:string)=>driver.commitTransaction(id)); ipcMain.handle('db:transaction-rollback',(_e,id:string)=>driver.rollbackTransaction(id))
 ipcMain.handle('file:open-sql',async()=>{const w=BrowserWindow.getFocusedWindow()??undefined;const o:OpenDialogOptions={properties:['openFile'],filters:[{name:'SQL',extensions:['sql']},{name:'All files',extensions:['*']}]};const r=w?await dialog.showOpenDialog(w,o):await dialog.showOpenDialog(o);if(r.canceled||!r.filePaths[0])return null;return {path:r.filePaths[0],contents:await readFile(r.filePaths[0],'utf8')}})
 ipcMain.handle('file:save-sql',async(_e,path:string|undefined,contents:string)=>{const w=BrowserWindow.getFocusedWindow()??undefined;let dest=path;if(!dest){const o:SaveDialogOptions={defaultPath:'query.sql',filters:[{name:'SQL',extensions:['sql']}]};const r=w?await dialog.showSaveDialog(w,o):await dialog.showSaveDialog(o);if(r.canceled||!r.filePath)return null;dest=r.filePath}await writeFile(dest,contents,{encoding:'utf8',mode:0o600});return dest})
}
