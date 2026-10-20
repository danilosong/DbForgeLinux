import { ipcMain } from 'electron'
import { analyzeSql } from '../../modules/code-analysis/index.js'

export function registerCodeAnalysisIpc(): void {
  ipcMain.handle('code-analysis:run', (_event, sql: string) => analyzeSql(sql))
}
