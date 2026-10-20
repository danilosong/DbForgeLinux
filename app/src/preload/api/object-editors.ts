import { ipcRenderer } from 'electron'
import type { ObjectEditorApi } from '../../shared/contracts/object-editors.js'

export const objectEditorsApi: ObjectEditorApi = {
  loadObjectEditor: (target) => ipcRenderer.invoke('object-editor:load', target),
  applyTableEditor: (connectionId, database, original, target) => ipcRenderer.invoke('object-editor:apply-table', connectionId, database, original, target),
  applyObjectEditor: (target, sql) => ipcRenderer.invoke('object-editor:apply', target, sql),
  mutateDatabaseObject: (target, action, newName) => ipcRenderer.invoke('object-editor:mutate', target, action, newName)
}
