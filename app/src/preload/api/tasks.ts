import { ipcRenderer } from 'electron'
import type { TasksApi } from '../../shared/contracts/tasks.js'
export const tasksApi: TasksApi = {
  listRecentTasks: () => ipcRenderer.invoke('tasks:recent:list'),
  recordRecentTask: (task) => ipcRenderer.invoke('tasks:recent:record', task),
  deleteRecentTask: (id) => ipcRenderer.invoke('tasks:recent:delete', id)
}
