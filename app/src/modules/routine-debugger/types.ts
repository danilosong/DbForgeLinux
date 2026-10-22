export type DebugStepKind = 'continue' | 'into' | 'over' | 'out' | 'run-to-cursor' | 'break-all'
export type DebugSessionStatus = 'preparing' | 'running' | 'paused' | 'finished' | 'error' | 'stopped'

export interface DebugBreakpoint { line: number; enabled: boolean; error?: string }
export interface DebugWatch { name: string; value?: unknown; type?: string; error?: string }
export interface DebugOutputParameter { name: string; value: unknown; type: string }
export interface DebugStackFrame { routine: string; line: number; depth: number }
export interface DebugSnapshot {
  sessionId: string
  status: DebugSessionStatus
  routine: string
  line?: number
  variables: Record<string, unknown>
  breakpoints: DebugBreakpoint[]
  watches: DebugWatch[]
  callStack: DebugStackFrame[]
  output: string[]
  outputParameters?: DebugOutputParameter[]
  resultsets?: Array<Array<Record<string, unknown>>>
}
export interface DebugRoutineTarget { connectionId: string; database: string; name: string; kind?: 'procedure' | 'trigger' }
export interface RoutineDebugApi {
  inspectDebugEngine(connectionId: string): Promise<{ installed: boolean; activeSessions: number; version?: string }>
  deployDebugEngine(connectionId: string, confirmed: boolean): Promise<void>
  removeDebugEngine(connectionId: string, confirmed: boolean): Promise<void>
  compileRoutineForDebug(target: DebugRoutineTarget): Promise<{ originalSql: string; instrumentedSql: string; statementLines: number[] }>
  startRoutineDebug(target: DebugRoutineTarget, args: Array<string | null>, breakpoints: DebugBreakpoint[], autocommit: boolean, confirmedAutocommit: boolean, triggerSql?: string, parameters?: Array<{ name: string; type: string; direction: 'IN' | 'OUT' | 'INOUT'; value: string | null }>, showAfterExecute?: boolean, timeoutSeconds?: number): Promise<{ sessionId: string }>
  commandRoutineDebug(sessionId: string, command: DebugStepKind | 'stop', line?: number): Promise<void>
  setRoutineDebugBreakpoints(sessionId: string, breakpoints: DebugBreakpoint[]): Promise<void>
  setRoutineDebugWatches(sessionId: string, watches: string[]): Promise<void>
  getRoutineDebugSnapshot(sessionId: string): Promise<DebugSnapshot>
  onRoutineDebugEvent(callback: (snapshot: DebugSnapshot) => void): () => void
}
