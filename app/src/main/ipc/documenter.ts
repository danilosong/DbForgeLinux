import { ipcMain, BrowserWindow } from 'electron'
import { inspectDatabase } from '../../modules/schema/index.js'
import { generateDocumentation, writeDocumentation, type DocumentFormat } from '../../modules/documenter/index.js'
import type { IpcDeps } from './registry.js'
export function registerDocumenterIpc({driver}:IpcDeps):void {
 const inspect=(id:string,database:string)=>inspectDatabase((sql,parameters)=>driver.queryRows(id,sql,parameters),database)
 ipcMain.handle('documenter:preview',async(_event,id:string,database:string,title?:string)=>generateDocumentation(await inspect(id,database),{title}))
 ipcMain.handle('documenter:generate',async(_event,input:{connectionId:string;database:string;title?:string;descriptions?:Record<string,string>;includeDiagram?:boolean;formats:DocumentFormat[];outputDirectory:string;confirmed:boolean})=>{if(input.confirmed!==true)throw new Error('Confirme a geração da documentação.');if(!input.outputDirectory.trim())throw new Error('Documentation has not been saved. The path is invalid.');const schema=await inspect(input.connectionId,input.database);return writeDocumentation(schema,{...input,outputDirectory:input.outputDirectory,pdfPrinter:{printToPDF:async(html,options)=>{const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});try{await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);return await window.webContents.printToPDF({printBackground:options?.printBackground,pageSize:options?.pageSize})}finally{window.destroy()}}}})})
}
