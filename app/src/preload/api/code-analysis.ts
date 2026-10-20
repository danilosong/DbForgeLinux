import { ipcRenderer } from 'electron'
import type { CodeAnalysisApi } from '../../shared/contracts/code-analysis.js'

export const codeAnalysisApi: CodeAnalysisApi = {
  analyzeSql: (sql) => ipcRenderer.invoke('code-analysis:run', sql)
}
