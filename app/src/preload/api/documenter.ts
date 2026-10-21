import { ipcRenderer } from 'electron'
import type { DbForgeApi } from '../../shared/contracts.js'
export const documenterApi:Pick<DbForgeApi,'previewDatabaseDocumentation'|'generateDatabaseDocumentation'|'openDocumentationPath'>={previewDatabaseDocumentation:(id,database,title)=>ipcRenderer.invoke('documenter:preview',id,database,title),generateDatabaseDocumentation:input=>ipcRenderer.invoke('documenter:generate',input),openDocumentationPath:path=>ipcRenderer.invoke('documenter:open',path)}
