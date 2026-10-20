import { ipcRenderer } from 'electron'
import type { DbForgeApi } from '../../shared/contracts.js'
export const dataGeneratorApi:Pick<DbForgeApi,'inspectGenerationSchema'|'previewGeneration'|'generateTestData'>={inspectGenerationSchema:(id,database)=>ipcRenderer.invoke('data-generator:inspect',id,database),previewGeneration:(id,database,table,generators,seed)=>ipcRenderer.invoke('data-generator:preview',id,database,table,generators,seed),generateTestData:input=>ipcRenderer.invoke('data-generator:generate',input)}
