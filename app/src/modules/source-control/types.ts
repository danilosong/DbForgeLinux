export type SourceControlState = 'added' | 'modified' | 'deleted' | 'conflicted' | 'untracked'
export interface WorkingChange { path: string; state: SourceControlState; staged: boolean }
export interface RepositoryStatus { root: string; branch: string; ahead: number; behind: number; changes: WorkingChange[]; conflicted: boolean }
export interface RepositoryBranch { name: string; current: boolean; remote: boolean }
export interface RepositoryCommit { hash: string; author: string; email: string; date: string; message: string }
export interface RepositoryGraphCommit extends RepositoryCommit { parents: string[]; refs: string[] }
export interface MergeConflictFile { path: string; base: string; ours: string; theirs: string; result: string }
export interface ProjectMetadata { version: 1; name: string; root: string; connections: Array<{ id: string; name: string }>; files: string[]; createdAt: string; linkedDatabase?: { connectionId: string; connectionName: string; database: string; model: 'dedicated' | 'shared' } }
export interface ExportSchemaReport { written: string[]; errors: Array<{ object: string; error: string }> }
export interface ProjectFileStatus { path: string; category: string; state: SourceControlState | 'clean' }
