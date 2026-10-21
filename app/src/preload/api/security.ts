import { ipcRenderer } from 'electron'
import type { TuxSqlApi } from '../../shared/contracts.js'
export const securityApi:Pick<TuxSqlApi,'savePassword'|'deletePassword'|'listSecurityAccounts'|'getSecurityDetails'|'previewSecurityChanges'|'applySecurityChanges'>={
 savePassword:(key,password)=>ipcRenderer.invoke('vault:save',key,password),
 deletePassword:key=>ipcRenderer.invoke('vault:delete',key),
 listSecurityAccounts:id=>ipcRenderer.invoke('security:accounts',id),
 getSecurityDetails:(id,account)=>ipcRenderer.invoke('security:details',id,account),
 previewSecurityChanges:(id,changes)=>ipcRenderer.invoke('security:preview',id,changes),
 applySecurityChanges:(id,changes,confirm)=>ipcRenderer.invoke('security:apply',id,changes,confirm)
}
