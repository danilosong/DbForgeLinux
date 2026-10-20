import { ipcRenderer } from 'electron'
import type { DbForgeApi } from '../../shared/contracts.js'
export const documenterApi:Pick<DbForgeApi,'previewDatabaseDocumentation'|'generateDatabaseDocumentation'>={previewDatabaseDocumentation:(id,database,title)=>ipcRenderer.invoke('documenter:preview',id,database,title),generateDatabaseDocumentation:input=>ipcRenderer.invoke('documenter:generate',input)}
