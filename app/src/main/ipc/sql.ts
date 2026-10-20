import { app, ipcMain, BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { chmod, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { IpcDeps } from './registry.js'
import type { ConnectionRecord } from '../../shared/contracts.js'
import { editorMetadataCache } from './editor.js'
import { maySaveSqlToPath } from '../security/windowPolicy.js'
import { ResultSpoolRegistry } from '../db/ResultSpool.js'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { describeGridResult } from './grid-editing.js'
const openedSqlFiles = new Map<number, Set<string>>()
export function registerSqlIpc({driver,resolveConnectionConfig,userDataDir}:IpcDeps):void {
 const resultSpools=new ResultSpoolRegistry(join(userDataDir,'query-results'))
 const spoolCleanup=resultSpools.cleanStaleFiles().catch(()=>{})
 let cleaningSpools=false
 app.on('before-quit',(event)=>{if(cleaningSpools)return;event.preventDefault();cleaningSpools=true;void resultSpools.disposeAll().finally(()=>app.quit())})
 const streamedJobs=new Map<string,{connectionId:string;senderId:number;controller:AbortController}>()
 const resultOwners=new Map<string,number>()
 const spoolSenders=new Set<number>()
 ipcMain.handle('db:test',async(_e,r:ConnectionRecord)=>driver.testConnection(await resolveConnectionConfig(r)))
 ipcMain.handle('db:connect',async(_e,r:ConnectionRecord)=>{const id=await driver.connect(await resolveConnectionConfig(r));return {id,recordId:r.id,name:r.name,host:r.host,port:r.port,user:r.user,database:r.database,environment:r.environment,color:r.color}})
 ipcMain.handle('db:disconnect',async(_e,id:string)=>{editorMetadataCache.invalidate(id);await driver.disconnect(id)}); ipcMain.handle('db:databases',(_e,id:string)=>driver.listDatabases(id))
 ipcMain.handle('db:execute',async(event,id:string,sql:string,executionId?:string,database?:string)=>{
  await spoolCleanup
  const smallLimit=/\bLIMIT\s+(?:\d+\s*,\s*)?(\d+)\b/i.exec(sql)?.[1]
  const useDiskSpool=/^\s*(SELECT|WITH)\b/i.test(sql.trim())&&!sql.includes(';')&&!(smallLimit&&Number(smallLimit)<=1000)
  if(useDiskSpool){
   const eid=executionId??randomUUID();if(streamedJobs.has(eid))throw new Error('Identificador de execução já está em uso.')
   const controller=new AbortController();streamedJobs.set(eid,{connectionId:id,senderId:event.sender.id,controller})
   const spool=await resultSpools.create();resultOwners.set(spool.id,event.sender.id)
   if(!spoolSenders.has(event.sender.id)){spoolSenders.add(event.sender.id);event.sender.once('destroyed',()=>{spoolSenders.delete(event.sender.id);for(const [rid,owner] of resultOwners)if(owner===event.sender.id){resultOwners.delete(rid);void resultSpools.dispose(rid)}})}
   try{let columns:string[]=[];for await(const row of driver.streamRows(id,sql,[],controller.signal,undefined,eid)){if(!columns.length)columns=Object.keys(row);await spool.append(row)}
    const editable = await describeGridResult(driver, id, sql, database)
    return [{columns,rows:[],resultStoreId:spool.id,rowCount:spool.rowCount,affectedRows:0,insertId:0,warningStatus:0,editable}]
   }catch(error){await resultSpools.dispose(spool.id);resultOwners.delete(spool.id);throw error}
   finally{streamedJobs.delete(eid)}
  }
  const result=await driver.executeSql(id,sql,executionId);if(/^\s*SELECT\b/i.test(sql.trim())){const editable=await describeGridResult(driver,id,sql,database);for(const item of result)if(item.columns.length)item.editable=editable}if(/\b(CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(sql))editorMetadataCache.invalidate(id);return result
 });
 ipcMain.handle('db:result-read',async(event,rid:string,offset:number,limit:number)=>{await spoolCleanup;if(resultOwners.get(rid)!==event.sender.id)throw new Error('Resultado expirado ou sem acesso.');const spool=resultSpools.get(rid);if(!spool)throw new Error('Resultado expirado.');return spool.read(offset,limit)})
 ipcMain.handle('db:result-dispose',async(event,rid:string)=>{if(resultOwners.get(rid)!==event.sender.id)return;resultOwners.delete(rid);await resultSpools.dispose(rid)})
 ipcMain.handle('db:cancel',async(event,id:string,eid:string)=>{const job=streamedJobs.get(eid);if(job&&job.senderId===event.sender.id&&job.connectionId===id){job.controller.abort();return}await driver.cancelQuery(id,eid)})
 ipcMain.handle('db:transaction-begin',(_e,id:string)=>driver.beginTransaction(id)); ipcMain.handle('db:transaction-commit',(_e,id:string)=>driver.commitTransaction(id)); ipcMain.handle('db:transaction-rollback',(_e,id:string)=>driver.rollbackTransaction(id))
 ipcMain.handle('file:open-sql',async(event)=>{
  const w=BrowserWindow.getFocusedWindow()??undefined
  const o:OpenDialogOptions={properties:['openFile'],filters:[{name:'SQL',extensions:['sql']},{name:'All files',extensions:['*']}]}
  const r=w?await dialog.showOpenDialog(w,o):await dialog.showOpenDialog(o)
  if(r.canceled||!r.filePaths[0])return null
  const path=r.filePaths[0]
  if((await stat(path)).size>20*1024*1024)throw new Error('SQL file exceeds the 20 MB safety limit.')
  let paths=openedSqlFiles.get(event.sender.id)
  if(!paths){paths=new Set();openedSqlFiles.set(event.sender.id,paths);event.sender.once('destroyed',()=>openedSqlFiles.delete(event.sender.id))}
  paths.add(path)
  return {path,contents:await readFile(path,'utf8')}
 })
 ipcMain.handle('file:open-sql-path',async(event,path:string)=>{
  if(typeof path!=='string'||!path.toLowerCase().endsWith('.sql'))throw new Error('O arquivo não tem extensão .sql.')
  const localPath=path.startsWith('file:')?fileURLToPath(path):path;const resolved=resolve(localPath);const details=await stat(resolved);if(!details.isFile()||details.size>20*1024*1024)throw new Error('Arquivo SQL inválido ou maior que 20 MB.')
  let paths=openedSqlFiles.get(event.sender.id);if(!paths){paths=new Set();openedSqlFiles.set(event.sender.id,paths);event.sender.once('destroyed',()=>openedSqlFiles.delete(event.sender.id))};paths.add(resolved)
  return {path:resolved,contents:await readFile(resolved,'utf8')}
 })
 ipcMain.handle('file:save-sql',async(event,path:string|undefined,contents:string)=>{
  if(typeof contents!=='string'||Buffer.byteLength(contents,'utf8')>20*1024*1024)throw new Error('SQL document exceeds the 20 MB safety limit.')
  const w=BrowserWindow.getFocusedWindow()??undefined
  let dest=path
  if(dest&&!maySaveSqlToPath(openedSqlFiles.get(event.sender.id),dest))dest=undefined
  if(!dest){const o:SaveDialogOptions={defaultPath:path?.split(/[\\/]/).at(-1)??'query.sql',filters:[{name:'SQL',extensions:['sql']}]};const r=w?await dialog.showSaveDialog(w,o):await dialog.showSaveDialog(o);if(r.canceled||!r.filePath)return null;dest=r.filePath}
  await writeFile(dest,contents,{encoding:'utf8',mode:0o600})
  await chmod(dest,0o600)
  let paths=openedSqlFiles.get(event.sender.id)
  if(!paths){paths=new Set();openedSqlFiles.set(event.sender.id,paths);event.sender.once('destroyed',()=>openedSqlFiles.delete(event.sender.id))}
  paths.add(dest)
  return dest
 })
}
