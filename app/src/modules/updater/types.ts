export type UpdateChannel = 'dev' | 'release'
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'up-to-date' | 'building' | 'downloading' | 'ready' | 'manual' | 'blocked' | 'error'
export interface BuildInfo { commit: string; branch: string; repoPath?: string; builtAt: string; dirty?: boolean; toolchain?: { nodePath?: string; pnpmExecPath?: string } }
export interface UpdatePreferences { checkOnStartup: boolean; automatic: boolean; channel: 'auto' | UpdateChannel; interval: 'startup' | 'daily'; ignoredVersion: string }
export interface UpdateStatus {
  phase: UpdatePhase
  channel?: UpdateChannel
  currentVersion: string
  newVersion?: string
  summary: string[]
  progress?: number
  message?: string
  log: string[]
}
export interface ReleaseUpdate { version: string; notes: string[]; sha512?: string }
export interface ReleaseAdapter {
  check(): Promise<ReleaseUpdate | null>
  download(): Promise<void>
  cancel(): void
  install(): void
  openReleasePage(): Promise<void>
}
export interface UpdateServiceOptions {
  appVersion: string
  buildInfoPath: string
  settings(): Promise<UpdatePreferences>
  release: ReleaseAdapter
  isBusy(): boolean
  resolvePnpm?: () => Promise<{ file: string; prefix: string[]; path: string }>
  runCommand?: (file: string, args: string[], options: { cwd: string; timeout: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv }) => Promise<string>
  emit?(status: UpdateStatus): void
  relaunch?(): void
  now?(): number
}
