export type TaskKind = 'backup' | 'export' | 'import' | 'schema-compare' | 'data-compare'
export interface RecentTask { id: string; kind: TaskKind; title: string; detail: string; updatedAt: string }
export interface TasksApi {
  listRecentTasks(): Promise<RecentTask[]>
  recordRecentTask(task: Omit<RecentTask, 'id' | 'updatedAt'>): Promise<RecentTask>
  deleteRecentTask(id: string): Promise<void>
}
