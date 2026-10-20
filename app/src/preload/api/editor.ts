import { ipcRenderer } from 'electron'
import type { EditorApi } from '../../shared/contracts/editor.js'

export const editorApi: EditorApi = {
  getEditorMetadata: (connectionId, database, refresh) => ipcRenderer.invoke('editor:metadata', connectionId, database, refresh),
  invalidateEditorMetadata: (connectionId, database) => ipcRenderer.invoke('editor:invalidate-metadata', connectionId, database)
}
