import { ipcRenderer } from 'electron'
import type { DbForgeApi } from '../../shared/contracts.js'
export const securityApi:Pick<DbForgeApi,'savePassword'|'deletePassword'>={savePassword:(key,password)=>ipcRenderer.invoke('vault:save',key,password),deletePassword:key=>ipcRenderer.invoke('vault:delete',key)}
