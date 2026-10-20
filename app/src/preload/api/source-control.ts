import { ipcRenderer } from 'electron'
import type { SourceControlApi } from '../../shared/contracts/source-control.js'

export const sourceControlApi: SourceControlApi = {
  chooseRepository: () => ipcRenderer.invoke('source-control:choose-repository'),
  sourceControlStatus: (path) => ipcRenderer.invoke('source-control:status', path),
  initializeGitRepository: (path) => ipcRenderer.invoke('source-control:init', path),
  sourceControlDiff: (path, file, staged) => ipcRenderer.invoke('source-control:diff', path, file, staged),
  sourceControlCommit: (path, message, files) => ipcRenderer.invoke('source-control:commit', path, message, files),
  sourceControlBranches: (path) => ipcRenderer.invoke('source-control:branches', path),
  sourceControlCreateBranch: (path, name) => ipcRenderer.invoke('source-control:create-branch', path, name),
  sourceControlCheckoutBranch: (path, name) => ipcRenderer.invoke('source-control:checkout-branch', path, name),
  sourceControlDeleteBranch: (path, name, confirmed) => ipcRenderer.invoke('source-control:delete-branch', path, name, confirmed),
  sourceControlFetch: (path) => ipcRenderer.invoke('source-control:fetch', path),
  sourceControlPull: (path) => ipcRenderer.invoke('source-control:pull', path),
  sourceControlPush: (path) => ipcRenderer.invoke('source-control:push', path),
  sourceControlLog: (path, limit) => ipcRenderer.invoke('source-control:log', path, limit),
  sourceControlCommitDiff: (path, hash, file) => ipcRenderer.invoke('source-control:commit-diff', path, hash, file),
  createSourceProject: (name) => ipcRenderer.invoke('source-control:create-project', name),
  openSourceProject: () => ipcRenderer.invoke('source-control:open-project'),
  addSourceProjectFile: (root) => ipcRenderer.invoke('source-control:add-file', root),
  writeSourceProjectScript: (root, file, contents) => ipcRenderer.invoke('source-control:write-script', root, file, contents),
  exportDatabaseSchema: (connectionId, database, folder) => ipcRenderer.invoke('source-control:export-schema', connectionId, database, folder)
}
