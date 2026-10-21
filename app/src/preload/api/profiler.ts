import { ipcRenderer } from 'electron'
import type { TuxSqlApi } from '../../shared/contracts.js'
export const profilerApi:Pick<TuxSqlApi,'profile'|'explain'|'history'|'clearHistory'>={profile:(id,query)=>ipcRenderer.invoke('profiler:profile',id,query),explain:(id,query)=>ipcRenderer.invoke('profiler:explain',id,query),history:id=>ipcRenderer.invoke('profiler:history',id),clearHistory:(id,confirmed)=>ipcRenderer.invoke('profiler:clear-history',id,confirmed)}
