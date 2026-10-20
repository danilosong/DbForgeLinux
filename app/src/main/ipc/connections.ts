import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import type { ConnectionRecord } from '../../shared/contracts.js'
function secretRefs(record: ConnectionRecord): string[] { return [record.passwordRef,record.ssh.passwordRef,record.ssh.passphraseRef,record.http.passwordRef,record.http.proxyPasswordRef].filter((ref): ref is string => Boolean(ref)) }
export function registerConnectionsIpc({connectionsStore,vault}: IpcDeps): void {
 ipcMain.handle('connections:list',()=>connectionsStore.list())
 ipcMain.handle('connections:save',async(_e,record:ConnectionRecord)=>{const old=(await connectionsStore.list()).find(x=>x.id===record.id);await connectionsStore.save(record);if(old){const inUse=new Set((await connectionsStore.list()).flatMap(secretRefs));for(const ref of secretRefs(old))if(!inUse.has(ref))await vault.delete(ref)}})
 ipcMain.handle('connections:delete',async(_e,id:string)=>{const all=await connectionsStore.list();const removed=all.find(x=>x.id===id);await connectionsStore.delete(id);if(removed){const inUse=new Set((await connectionsStore.list()).flatMap(secretRefs));for(const ref of secretRefs(removed))if(!inUse.has(ref))await vault.delete(ref)}})
}
