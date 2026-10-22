import { ipcMain } from 'electron'
import { profileQuery, type ProfileResult } from '../../modules/profiler/index.js'
import { getServerStatus } from '../../modules/sessions/index.js'
import type { IpcDeps } from './registry.js'
const histories = new Map<string, ProfileResult[]>()
export function registerProfilerIpc({driver}:IpcDeps):void {
 const client=(id:string)=>({query:(sql:string,parameters?:readonly unknown[])=>driver.queryRows(id,sql,parameters as unknown[]|undefined),execute:async(sql:string)=>{await driver.executeSql(id,sql)}})
 ipcMain.handle('profiler:profile',async(_event,id:string,query:string)=>{if(!id||!query.trim())throw new Error('Enter the connection and query.');const result=await profileQuery(client(id),query);const list=histories.get(id)??[];list.unshift(result);list.length=Math.min(list.length,100);histories.set(id,list);return result})
 ipcMain.handle('profiler:explain',async(_event,id:string,query:string)=>{const result=await profileQuery(client(id),query);return result.plan})
 ipcMain.handle('profiler:history',(_event,id:string)=>histories.get(id)??[])
 ipcMain.handle('profiler:clear-history',(_event,id:string,confirmed:boolean)=>{if(!confirmed)throw new Error('Confirm removing the history.');histories.delete(id)})
 ipcMain.handle('profiler:status',(_event,id:string)=>getServerStatus(client(id),'SESSION'))
}
