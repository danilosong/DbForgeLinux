import type { KillMode, SessionDetails, SessionFilters, SessionInfo, VariableApplyMode, VariableChange, VariableInfo, VariableSnapshot } from '../../modules/sessions/index.js'

export interface SessionsApi {
  listSessions(connectionId: string, filters?: SessionFilters): Promise<SessionInfo[]>
  getSessionDetails(connectionId: string, id: number): Promise<SessionDetails>
  killSessions(connectionId: string, ids: number[], mode: KillMode, confirm: true): Promise<Array<{ id: number; success: boolean; error?: string }>>
  getServerVariables(connectionId: string, scope?: 'GLOBAL' | 'SESSION'): Promise<VariableSnapshot>
  getServerStatus(connectionId: string, scope?: 'GLOBAL' | 'SESSION'): Promise<Record<string, string>>
  previewServerVariable(connectionId: string, change: VariableChange, options?: { persist?: boolean; mode?: VariableApplyMode }): Promise<{ sql: string; oldValue: string; requiresTypedConfirmation: boolean }>
  /** `confirmation` must be the variable name for SET GLOBAL, PERSIST and PERSIST_ONLY; the main process rejects anything else. */
  setServerVariable(connectionId: string, change: VariableChange, options: { confirm: true; persist?: boolean; mode?: VariableApplyMode; confirmation?: string; type?: VariableInfo['type']; enumValues?: string[]; min?: number; max?: number }): Promise<void>
}
