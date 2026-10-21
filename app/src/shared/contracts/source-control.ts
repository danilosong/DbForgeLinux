import type { ExportSchemaReport, MergeConflictFile, ProjectFileStatus, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryGraphCommit, RepositoryStatus } from '../../modules/source-control/types.js'

export interface SourceControlApi {
  chooseRepository(): Promise<string | null>
  chooseProjectFolder(): Promise<string | null>
  cloneSourceRepository(url: string, parent: string, folderName: string): Promise<string>
  linkDatabaseToSourceControl(input: { root: string; name: string; connectionId: string; connectionName: string; database: string; model: 'dedicated' | 'shared' }): Promise<ProjectMetadata>
  sourceControlHasRemote(path: string): Promise<boolean>
  sourceControlStatus(path: string): Promise<RepositoryStatus>
  initializeGitRepository(path: string): Promise<void>
  sourceControlDiff(path: string, file?: string, staged?: boolean): Promise<string>
  sourceControlCommit(path: string, message: string, files: string[]): Promise<RepositoryCommit>
  sourceControlBranches(path: string): Promise<RepositoryBranch[]>
  sourceControlCreateBranch(path: string, name: string): Promise<void>
  sourceControlCheckoutBranch(path: string, name: string): Promise<void>
  sourceControlDeleteBranch(path: string, name: string, confirmed: boolean): Promise<void>
  sourceControlFetch(path: string): Promise<void>
  sourceControlPull(path: string, confirmed: boolean): Promise<void>
  sourceControlPush(path: string, confirmed: boolean): Promise<void>
  sourceControlLog(path: string, limit?: number, file?: string): Promise<RepositoryCommit[]>
  sourceControlCommitDiff(path: string, hash: string, file?: string): Promise<string>
  sourceControlGraph(path: string, limit?: number): Promise<RepositoryGraphCommit[]>
  sourceControlReadConflict(path: string, file: string): Promise<MergeConflictFile>
  sourceControlSaveConflict(path: string, file: string, contents: string): Promise<void>
  sourceControlMarkConflictResolved(path: string, file: string): Promise<void>
  createSourceProject(name: string): Promise<ProjectMetadata | null>
  openSourceProject(): Promise<ProjectMetadata | null>
  openSourceProjectPath(root: string): Promise<ProjectMetadata>
  recentSourceProjects(): Promise<string[]>
  closeSourceProject(root: string): Promise<void>
  sourceProjectFiles(root: string): Promise<ProjectFileStatus[]>
  readSourceProjectScripts(root: string, files: string[]): Promise<Array<{ path: string; contents: string }>>
  applySourceProjectScripts(connectionId: string, database: string, scripts: Array<{ path: string; contents: string }>, confirmed: boolean): Promise<void>
  addSourceProjectFile(root: string): Promise<ProjectMetadata | null>
  writeSourceProjectScript(root: string, file: string, contents: string): Promise<ProjectMetadata>
  exportDatabaseSchema(connectionId: string, database: string, folder?: string): Promise<ExportSchemaReport | null>
}
