import type { ExportSchemaReport, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryStatus } from '../../modules/source-control/types.js'

export interface SourceControlApi {
  chooseRepository(): Promise<string | null>
  sourceControlStatus(path: string): Promise<RepositoryStatus>
  initializeGitRepository(path: string): Promise<void>
  sourceControlDiff(path: string, file?: string, staged?: boolean): Promise<string>
  sourceControlCommit(path: string, message: string, files: string[]): Promise<RepositoryCommit>
  sourceControlBranches(path: string): Promise<RepositoryBranch[]>
  sourceControlCreateBranch(path: string, name: string): Promise<void>
  sourceControlCheckoutBranch(path: string, name: string): Promise<void>
  sourceControlDeleteBranch(path: string, name: string, confirmed: boolean): Promise<void>
  sourceControlFetch(path: string): Promise<void>
  sourceControlPull(path: string): Promise<void>
  sourceControlPush(path: string): Promise<void>
  sourceControlLog(path: string, limit?: number): Promise<RepositoryCommit[]>
  sourceControlCommitDiff(path: string, hash: string, file?: string): Promise<string>
  createSourceProject(name: string): Promise<ProjectMetadata | null>
  openSourceProject(): Promise<ProjectMetadata | null>
  addSourceProjectFile(root: string): Promise<ProjectMetadata | null>
  writeSourceProjectScript(root: string, file: string, contents: string): Promise<ProjectMetadata>
  exportDatabaseSchema(connectionId: string, database: string, folder?: string): Promise<ExportSchemaReport | null>
}
