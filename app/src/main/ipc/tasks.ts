import { ipcMain } from 'electron'
import type { RecentTasksStore } from '../modules/tasks/RecentTasksStore.js'
import type { TaskKind } from '../../shared/contracts/tasks.js'

export function registerTasksIpc(store: RecentTasksStore): void {
  ipcMain.handle('tasks:recent:list', () => store.list())
  ipcMain.handle('tasks:recent:record', (_event, task: { kind: TaskKind; title: string; detail: string }) => store.record(task))
  ipcMain.handle('tasks:recent:delete', (_event, id: string) => store.delete(id))
}
