import { BrowserWindow, ipcMain, shell } from 'electron'
import { inspectDatabase } from '../../modules/schema/index.js'
import { generateDocumentation, writeDocumentation, type DocumentFormat, type DocumenterPalette } from '../../modules/documenter/index.js'
import { inspectDocumenterAccounts } from '../../modules/documenter/accounts.js'
import type { IpcDeps } from './registry.js'
import { validateSystemOpenPath } from '../security/systemOpenPath.js'

interface GenerateInput {
  connectionId: string; database: string; title?: string; author?: string; copyright?: string; logo?: string; created?: string
  folderName?: string; descriptions?: Record<string, string>; includeDiagram?: boolean; includeUsers?: boolean
  coverPage?: boolean; breadcrumbs?: boolean; palette?: DocumenterPalette; excludedTables?: string[]; excludedColumns?: string[]; excludedIndexes?: string[]
  pdfOrientation?: 'portrait' | 'landscape'; pdfFontScale?: number; pdfPageNumbers?: boolean
  formats: DocumentFormat[]; outputDirectory: string; confirmed: boolean
}

export function registerDocumenterIpc({ driver }: IpcDeps): void {
  ipcMain.handle('documenter:open', async (_event, path: string) => {
    const target = await validateSystemOpenPath(path, 'file')
    return shell.openPath(target)
  })
  const inspect = (id: string, database: string) => inspectDatabase((sql, parameters) => driver.queryRows(id, sql, parameters), database)
  ipcMain.handle('documenter:tree', async (_event, id: string, database: string) => {
    const schema = await inspect(id, database)
    return schema.tables.map((table) => ({ name: table.name, columns: table.columns.map((column) => column.name), indexes: table.indexes.map((index) => index.name) }))
  })
  ipcMain.handle('documenter:preview', async (_event, id: string, database: string, title?: string) => generateDocumentation(await inspect(id, database), { title }))
  ipcMain.handle('documenter:generate', async (_event, input: GenerateInput) => {
    if (input.confirmed !== true) throw new Error('Confirme a geração da documentação.')
    if (!input.outputDirectory.trim()) throw new Error('Documentation has not been saved. The path is invalid.')
    for (const list of [input.excludedTables, input.excludedColumns, input.excludedIndexes]) if (list !== undefined && (!Array.isArray(list) || list.length > 20_000 || list.some((item) => typeof item !== 'string' || item.length > 512))) throw new Error('A seleção granular da documentação é inválida.')
    if (input.palette !== undefined && !['default', 'bootstrap', 'cerulean', 'cyborg', 'default-dark', 'flatly', 'journal', 'paper', 'yeti', 'metro-light', 'ocean', 'forest'].includes(input.palette)) throw new Error('A paleta da capa não é válida.')
    if (input.pdfOrientation !== undefined && !['portrait', 'landscape'].includes(input.pdfOrientation)) throw new Error('A orientação do PDF não é válida.')
    if (input.pdfFontScale !== undefined && (!Number.isFinite(input.pdfFontScale) || input.pdfFontScale < 50 || input.pdfFontScale > 200)) throw new Error('A escala do PDF deve estar entre 50% e 200%.')
    if (input.pdfPageNumbers !== undefined && typeof input.pdfPageNumbers !== 'boolean') throw new Error('A opção de numeração do PDF é inválida.')
    const schema = await inspect(input.connectionId, input.database)
    const accounts = input.includeUsers ? await inspectDocumenterAccounts((sql, parameters) => driver.queryRows(input.connectionId, sql, parameters ? [...parameters] : undefined), input.database) : undefined
    return writeDocumentation(schema, {
      ...input,
      accounts,
      outputDirectory: input.outputDirectory,
      pdfPrinter: {
        printToPDF: async (html, options) => {
          const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
          try {
            await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
            return await window.webContents.printToPDF({ printBackground: options?.printBackground, pageSize: options?.pageSize, landscape: options?.landscape, displayHeaderFooter: options?.displayHeaderFooter, footerTemplate: options?.footerTemplate })
          } finally { window.destroy() }
        }
      }
    })
  })
}
