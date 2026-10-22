import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { IpcDeps } from './registry.js'
import { ipcMain } from './registry.js'
import { DEBUG_SCHEMA, calledProcedureNames, engineDdl, instrumentProcedure, instrumentTrigger, quoteDebugIdentifier, type DebugBreakpoint, type DebugRoutineTarget, type DebugSessionStatus, type DebugSnapshot, type DebugStepKind, type DebugWatch } from '../../modules/routine-debugger/index.js'
import type { DedicatedMysqlSession } from '../db/MysqlDriver.js'
import { evaluateWatchExpression } from '../../modules/routine-debugger/expression.js'
import { buildDebugCallPlan } from '../../modules/routine-debugger/outputParameters.js'
import { scheduleDebugSessionTimeout } from '../../modules/routine-debugger/sessionTimeout.js'

interface AuxiliaryRoutine { database: string; name: string; originalSql: string; instrumentedSql: string }
interface StatementFrame { routine: string; line: number; depth: number; locals: Array<{ name: string; userVariable: string }> }
interface LiveSession { id: string; ownerId: number; sender: WebContents; target: DebugRoutineTarget; controller: DedicatedMysqlSession; executor: DedicatedMysqlSession; executorProcessId: number; localVariablePrefix: string; localsAvailable: boolean; originalSql: string; instrumentedSql: string; statementLines: number[]; statementFrames: StatementFrame[]; auxiliaryRoutines: AuxiliaryRoutine[]; auxiliaryLocks: string[]; task?: Promise<void>; snapshot: DebugSnapshot; watches: string[]; stopRequested: boolean; showAfterExecute: boolean }
const sessions = new Map<string, LiveSession>()
const table = (name: string): string => `${quoteDebugIdentifier(DEBUG_SCHEMA)}.${quoteDebugIdentifier(name)}`
const LOCALS_UNAVAILABLE_MESSAGE = 'Locals unavailable: enable performance_schema / grant SELECT'

export function registerRoutineDebuggerIpc({ driver }: IpcDeps): void {
  ipcMain.handle('routine-debugger:engine:inspect', async (_event, connectionId: string) => inspectEngine(driver, connectionId))
  ipcMain.handle('routine-debugger:engine:deploy', async (_event, connectionId: string, confirmed: boolean) => {
    if (confirmed !== true) throw new Error('Deploying the debug engine requires explicit confirmation.')
    const state = await inspectEngine(driver, connectionId)
    if (state.activeSessions) throw new Error(`Debug engine deployment is blocked while ${state.activeSessions} debug session(s) are active.`)
    const connection = await driver.openDedicatedSession(connectionId)
    try {
      for (const sql of engineDdl()) await connection.execute(sql)
      const commandVersion = await connection.query('SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [DEBUG_SCHEMA, 'debug_sessions', 'command_version'])
      if (Number(commandVersion[0]?.total) === 0) await connection.execute(`ALTER TABLE ${table('debug_sessions')} ADD COLUMN command_version INT NOT NULL DEFAULT 0`)
    } finally { await connection.close() }
  })
  ipcMain.handle('routine-debugger:engine:remove', async (_event, connectionId: string, confirmed: boolean) => {
    if (confirmed !== true) throw new Error('Removing the debug engine requires explicit confirmation.')
    const state = await inspectEngine(driver, connectionId)
    if (!state.installed) return
    if (state.activeSessions) throw new Error(`Debug engine removal is blocked while ${state.activeSessions} debug session(s) are active.`)
    const connection = await driver.openDedicatedSession(connectionId)
    try {
      await connection.execute(`USE ${quoteDebugIdentifier(DEBUG_SCHEMA)}`)
      const tables = await connection.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [DEBUG_SCHEMA])
      if (tables.some((item) => item.table_name === 'routine_sources')) {
        const sources = await connection.query(`SELECT database_name,routine_name,original_sql FROM ${table('routine_sources')}`)
        for (const item of sources) {
          const storedName = String(item.routine_name)
          const kind = storedName.startsWith('TRIGGER:') ? 'trigger' : 'procedure'
          const name = kind === 'trigger' ? storedName.slice('TRIGGER:'.length) : storedName
          await restoreObject(connection, String(item.database_name), name, kind, String(item.original_sql))
        }
      }
      await connection.execute(`DROP DATABASE ${quoteDebugIdentifier(DEBUG_SCHEMA)}`)
    } finally { await connection.close() }
  })
  ipcMain.handle('routine-debugger:compile', async (_event, target: DebugRoutineTarget) => compilePreview(driver, target))
  ipcMain.handle('routine-debugger:start', async (event, target: DebugRoutineTarget, args: Array<string | null>, breakpoints: DebugBreakpoint[], autocommit: boolean, confirmedAutocommit: boolean, triggerSql?: string, parameters?: Array<{ name: string; type: string; direction: 'IN' | 'OUT' | 'INOUT'; value: string | null }>, showAfterExecute = true, timeoutSeconds = 30) => {
    validateTarget(target)
    if (!Array.isArray(args) || args.length > 64 || args.some((arg) => arg !== null && (typeof arg !== 'string' || arg.length > 100_000))) throw new Error('Routine argument list is invalid.')
    if (autocommit !== true && autocommit !== false) throw new Error('Choose an autocommit mode.')
    if (!confirmedAutocommit) throw new Error('Confirm the autocommit behavior before starting routine debugging.')
    if (target.kind === 'trigger') validateTriggerSql(triggerSql)
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) throw new Error('Debugging timeout must be between 1 and 3600 seconds.')
    const engine = await inspectEngine(driver, target.connectionId)
    if (!engine.installed) throw new Error('Deploy the debug engine before starting a routine debug session.')
    const id = randomUUID()
    const localVariablePrefix = id.replaceAll('-', '').slice(0, 20)
    const preview = await compilePreview(driver, target, target.kind === 'trigger' ? localVariablePrefix : undefined)
    const controller = await driver.openDedicatedSession(target.connectionId)
    let executor: DedicatedMysqlSession | undefined
    let routineDropped = false
    let routineLock = false
    let localAccess!: { executorProcessId: number; localsAvailable: boolean }
    const needsTriggerLocals = target.kind === 'trigger' && preview.statementFrames.some((frame) => frame.locals.length > 0)
    const auxiliaryLocks: string[] = []
    const auxiliaryDropped: AuxiliaryRoutine[] = []
    try {
      executor = await driver.openDedicatedSession(target.connectionId)
      await controller.execute(`USE ${quoteDebugIdentifier(DEBUG_SCHEMA)}`)
      const routineLockName = makeRoutineLockName(target)
      const routineLockResult = await controller.query('SELECT GET_LOCK(?,0) AS got_lock', [routineLockName])
      if (Number(routineLockResult[0]?.got_lock) !== 1) throw new Error(`This stored ${target.kind ?? 'procedure'} already has an active debug session.`)
      routineLock = true
      for (const auxiliary of preview.auxiliaryRoutines) {
        const auxiliaryTarget: DebugRoutineTarget = { connectionId: target.connectionId, database: auxiliary.database, name: auxiliary.name, kind: 'procedure' }
        const auxiliaryLock = makeRoutineLockName(auxiliaryTarget)
        const acquired = await controller.query('SELECT GET_LOCK(?,0) AS got_lock', [auxiliaryLock])
        if (Number(acquired[0]?.got_lock) !== 1) throw new Error(`Procedure ${auxiliary.database}.${auxiliary.name} is already being debugged.`)
        auxiliaryLocks.push(auxiliaryLock)
      }
      const sourceKey = sourceKeyFor(target)
      await controller.execute(`INSERT INTO ${table('routine_sources')}(database_name,routine_name,original_sql) VALUES (?,?,?) ON DUPLICATE KEY UPDATE original_sql=VALUES(original_sql)`, [target.database, sourceKey, preview.originalSql])
      await controller.execute(`INSERT INTO ${table('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?, 'running','into')`, [id, target.connectionId, target.database, sourceKey])
      await writeBreakpoints(controller, id, sanitizeBreakpoints(breakpoints, preview.statementLines))
      await executor.execute(`USE ${quoteDebugIdentifier(target.database)}`)
      await executor.execute(`SET autocommit=${autocommit ? '1' : '0'}`)
      if (target.kind === 'trigger') await executor.execute('SET @tuxsql_linux_debug_id=NULL,@tuxsql_linux_debug_step_kind=NULL,@tuxsql_linux_debug_run_to=NULL,@tuxsql_linux_debug_target_depth=NULL,@tuxsql_linux_debug_current_depth=NULL')
      const executorConnection = await executor.query('SELECT CONNECTION_ID() AS connection_id')
      const executorProcessId = Number(executorConnection[0]?.connection_id)
      const localsAvailable = needsTriggerLocals && Number.isSafeInteger(executorProcessId) && executorProcessId > 0
        ? await canReadTriggerLocals(controller, executorProcessId)
        : false
      localAccess = { executorProcessId, localsAvailable }
      for (const auxiliary of preview.auxiliaryRoutines) {
        await controller.execute(`INSERT INTO ${table('routine_sources')}(database_name,routine_name,original_sql) VALUES (?,?,?) ON DUPLICATE KEY UPDATE original_sql=VALUES(original_sql)`, [auxiliary.database, auxiliary.name, auxiliary.originalSql])
        await executor.execute(`DROP PROCEDURE ${quoteDebugIdentifier(auxiliary.database)}.${quoteDebugIdentifier(auxiliary.name)}`)
        auxiliaryDropped.push(auxiliary)
        await executor.execute(auxiliary.instrumentedSql)
      }
      await executor.execute(`DROP ${target.kind === 'trigger' ? 'TRIGGER' : 'PROCEDURE'} ${quoteDebugIdentifier(target.database)}.${quoteDebugIdentifier(target.name)}`)
      routineDropped = true
      await executor.execute(preview.instrumentedSql)
      await executor.execute(`SET @tuxsql_linux_debug_id='${id}'`)
    } catch (error) {
      let restoreFailure: unknown
      if (routineDropped) {
        try { await restoreObject(executor!, target.database, target.name, target.kind ?? 'procedure', preview.originalSql) }
        catch (restoreError) { restoreFailure = restoreError }
      }
      for (const auxiliary of [...auxiliaryDropped].reverse()) {
        try { await restoreObject(executor!, auxiliary.database, auxiliary.name, 'procedure', auxiliary.originalSql) }
        catch (restoreError) { restoreFailure ??= restoreError }
      }
      try { await controller.execute(`UPDATE ${table('debug_sessions')} SET status='error' WHERE debug_id=?`, [id]); await controller.execute(`DELETE FROM ${table('breakpoints')} WHERE debug_id=?`, [id]); await controller.execute(`DELETE FROM ${table('watches')} WHERE debug_id=?`, [id]); if (!restoreFailure) await controller.execute(`DELETE FROM ${table('routine_sources')} WHERE database_name=? AND routine_name=?`, [target.database, sourceKeyFor(target)]) } catch { /* deployment state may be partial */ }
      if (routineLock) { try { await controller.query('SELECT RELEASE_LOCK(?) AS released', [makeRoutineLockName(target)]) } catch { /* closing connection releases the named lock */ } }
      for (const auxiliaryLock of auxiliaryLocks) { try { await controller.query('SELECT RELEASE_LOCK(?) AS released', [auxiliaryLock]) } catch { /* closing connection releases the named lock */ } }
      await controller.close(); await executor?.close(); throw error
    }
    const { executorProcessId, localsAvailable } = localAccess
    const snapshot: DebugSnapshot = { sessionId: id, status: 'running', routine: `${target.database}.${target.name}`, variables: {}, breakpoints: sanitizeBreakpoints(breakpoints, preview.statementLines), watches: [], callStack: [{ routine: `${target.database}.${target.name}`, line: 0, depth: 0 }], output: [target.kind === 'trigger' ? 'Trigger debugging started.' : 'Debugging started.', ...(needsTriggerLocals && !localsAvailable ? [LOCALS_UNAVAILABLE_MESSAGE] : [])] }
    const live: LiveSession = { id, ownerId: event.sender.id, sender: event.sender, target, controller, executor, executorProcessId, localVariablePrefix, localsAvailable, originalSql: preview.originalSql, instrumentedSql: preview.instrumentedSql, statementLines: preview.statementLines, statementFrames: preview.statementFrames, auxiliaryRoutines: preview.auxiliaryRoutines, auxiliaryLocks, snapshot, watches: [], stopRequested: false, showAfterExecute }
    sessions.set(id, live)
    live.task = runTarget(live, args, autocommit, triggerSql, parameters, timeoutSeconds)
    return { sessionId: id }
  })
  ipcMain.handle('routine-debugger:command', async (event, id: string, command: DebugStepKind | 'stop', line?: number) => {
    const live = owned(event, id)
    if (command === 'stop') {
      await mutateWithLock(live.controller, id, `UPDATE ${table('debug_sessions')} SET status='stopped' WHERE debug_id=?`, [id])
      live.stopRequested = true
      live.executor.cancel()
      return
    }
    if (!['continue', 'into', 'over', 'out', 'run-to-cursor', 'break-all'].includes(command)) throw new Error('Unsupported debugger command.')
    if (command === 'run-to-cursor' && (!Number.isInteger(line) || line! < 1)) throw new Error('Select a valid source line for Run To Cursor.')
    const state = live.snapshot.status
    if (command === 'break-all' && state === 'running') {
      await mutateWithLock(live.controller, id, `UPDATE ${table('debug_sessions')} SET step_kind='break-all' WHERE debug_id=?`, [id])
      return
    }
    if (command === 'break-all' && state === 'paused') return
    if (state !== 'paused') throw new Error('The routine must be paused to execute a debug command.')
    if (live.target.kind === 'trigger') {
      const code: Record<Exclude<DebugStepKind, 'run-to-cursor' | 'break-all'>, string> = { continue: 'c', into: 'i', over: 'o', out: 'u' }
      const signalName = command === 'run-to-cursor' ? `dfl-cmd-${id}-r${line}` : `dfl-cmd-${id}-${code[command as keyof typeof code]}`
      const acquired = await live.controller.query('SELECT GET_LOCK(?,0) AS got_lock', [signalName])
      if (Number(acquired[0]?.got_lock) !== 1) throw new Error('Could not signal the paused trigger debugger.')
      try {
        const currentLine = live.snapshot.line
        if (!currentLine) throw new Error('Trigger debugger has no current source line.')
        const currentDepth = live.snapshot.callStack.at(-1)?.depth ?? 0
        for (let attempt = 0; attempt < 100; attempt++) {
          const state = await live.controller.query('SELECT IS_USED_LOCK(?) AS owner', [triggerPauseLockName(id, currentLine, currentDepth)])
          if (state[0]?.owner == null) return
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        throw new Error('Trigger debugger did not acknowledge the command.')
      } finally { await live.controller.query('SELECT RELEASE_LOCK(?) AS released', [signalName]) }
    }
    await mutateWithLock(live.controller, id, `UPDATE ${table('debug_sessions')} SET status='running',step_kind=?,run_to_line=?,command_version=command_version+1 WHERE debug_id=?`, [command, command === 'run-to-cursor' ? line! : null, id])
  })
  ipcMain.handle('routine-debugger:breakpoints', async (event, id: string, value: DebugBreakpoint[]) => {
    const live = owned(event, id)
    const validLines = live.snapshot.breakpoints.map((item) => item.line)
    await writeBreakpoints(live.controller, id, sanitizeBreakpoints(value, validLines))
    live.snapshot.breakpoints = sanitizeBreakpoints(value, validLines)
    emit(live)
  })
  ipcMain.handle('routine-debugger:watches', async (event, id: string, value: string[]) => {
    const live = owned(event, id)
    if (!Array.isArray(value) || value.length > 100 || value.some((name) => typeof name !== 'string' || name.length > 127 || !/^[\w$()+*/%<>=!&|,\s.-]+$/.test(name) || !/[A-Za-z_$0-9)]/.test(name))) throw new Error('Watch expressions may contain variable names, numeric literals, comparisons, arithmetic operators, and supported scalar functions only.')
    live.watches = [...new Set(value)]
    await mutateWithLock(live.controller, id, `DELETE FROM ${table('watches')} WHERE debug_id=?`, [id])
    for (const name of live.watches) await live.controller.execute(`INSERT INTO ${table('watches')}(debug_id,watch_name) VALUES (?,?)`, [id, name])
    live.snapshot.watches = evaluateWatches(live.snapshot.variables, live.watches)
    emit(live)
  })
  ipcMain.handle('routine-debugger:snapshot', (event, id: string) => owned(event, id).snapshot)
}

async function inspectEngine(driver: IpcDeps['driver'], connectionId: string): Promise<{ installed: boolean; activeSessions: number; version?: string }> {
  if (!connectionId) throw new Error('Choose an active database connection.')
  const schemas = await driver.queryRows(connectionId, 'SELECT schema_name FROM information_schema.schemata WHERE schema_name=?', [DEBUG_SCHEMA])
  if (!schemas.length) return { installed: false, activeSessions: 0 }
  let rows: Array<Record<string, unknown>> = []
  let active: Array<Record<string, unknown>> = []
  try { rows = await driver.queryRows(connectionId, `SELECT engine_version FROM ${table('engine_info')} WHERE engine_key='engine'`) } catch { /* deployment can repair a partially installed schema */ }
  try { active = await driver.queryRows(connectionId, `SELECT debug_id FROM ${table('debug_sessions')} WHERE status IN ('preparing','running','paused')`) } catch { /* no session table exists yet */ }
  return { installed: true, activeSessions: active.length, version: String(rows[0]?.engine_version ?? Object.values(rows[0] ?? {})[0] ?? '') }
}

async function compilePreview(driver: IpcDeps['driver'], target: DebugRoutineTarget, debugVariablePrefix?: string): Promise<{ originalSql: string; instrumentedSql: string; statementLines: number[]; statementFrames: StatementFrame[]; auxiliaryRoutines: AuxiliaryRoutine[] }> {
  validateTarget(target)
  const kind = target.kind ?? 'procedure'
  const originalSql = await driver.showCreateObject(target.connectionId, target.database, { name: target.name, kind })
  const result = kind === 'trigger' ? instrumentTrigger(originalSql, DEBUG_SCHEMA, target.name, debugVariablePrefix) : instrumentProcedure(originalSql, DEBUG_SCHEMA, target.name)
  const auxiliaryRoutines: AuxiliaryRoutine[] = []
  const statementFrames: StatementFrame[] = result.checkpoints.map(({ line, locals }) => ({ routine: target.name, line, depth: 0, locals }))
  if (kind === 'trigger') {
    const called = calledProcedureNames(originalSql)
    if (called.length > 32) throw new Error('Trigger debugging supports up to 32 directly called procedures.')
    for (const reference of called) {
      const parts = reference.split('.')
      if (parts.length > 2) throw new Error(`Trigger CALL target ${reference} could not be resolved safely.`)
      const database = parts.length === 2 ? parts[0]! : target.database
      const name = parts.at(-1)!
      if (database !== target.database) throw new Error(`Trigger debugging does not instrument cross-database procedure ${database}.${name}.`)
      if (auxiliaryRoutines.some((item) => item.name === name)) continue
      const childSql = await driver.showCreateObject(target.connectionId, database, { name, kind: 'procedure' })
      const depth = auxiliaryRoutines.length + 1
      const child = instrumentProcedure(childSql, DEBUG_SCHEMA, name, depth, debugVariablePrefix)
      auxiliaryRoutines.push({ database, name, originalSql: childSql, instrumentedSql: child.sql })
      statementFrames.push(...child.checkpoints.map(({ line, locals }) => ({ routine: name, line, depth, locals })))
    }
  }
  if (statementFrames.length > 500) throw new Error('Trigger and called procedures exceed the 500 checkpoint limit.')
  return { originalSql, instrumentedSql: result.sql, statementLines: [...new Set(statementFrames.map((frame) => frame.line))], statementFrames, auxiliaryRoutines }
}

function validateTarget(target: DebugRoutineTarget): void {
  if (!target || typeof target.connectionId !== 'string' || !target.connectionId.trim() || typeof target.database !== 'string' || !target.database.trim() || typeof target.name !== 'string' || !target.name.trim() || target.name.length > 64 || target.database.length > 64 || (target.kind !== undefined && target.kind !== 'procedure' && target.kind !== 'trigger')) throw new Error('Select a valid stored procedure or trigger to debug.')
}
function validateTriggerSql(sql: string | undefined): asserts sql is string {
  if (typeof sql !== 'string' || sql.length > 100_000) throw new Error('Enter one DML statement that fires the selected trigger.')
  const normalized = sql.trim().replace(/;\s*$/, '').trim()
  if (!/^(?:INSERT\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(normalized) || /;/.test(normalized) || /--|#|\/\*/.test(normalized)) throw new Error('Trigger debugging accepts one INSERT, REPLACE, UPDATE, or DELETE statement without comments.')
}
function sourceKeyFor(target: DebugRoutineTarget): string { return target.kind === 'trigger' ? `TRIGGER:${target.name}` : target.name }
function sanitizeBreakpoints(value: DebugBreakpoint[], validLines: number[]): DebugBreakpoint[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Breakpoint list is invalid.')
  const known = new Set(validLines)
  return [...new Map(value.map((point) => {
    if (!point || !Number.isInteger(point.line) || point.line < 1) throw new Error('Breakpoint line is invalid.')
    return [point.line, { line: point.line, enabled: point.enabled === true, ...(!known.has(point.line) ? { error: 'No executable statement at this line.' } : {}) }]
  })).values()]
}
async function writeBreakpoints(connection: DedicatedMysqlSession, id: string, breakpoints: DebugBreakpoint[]): Promise<void> {
  await mutateWithLock(connection, id, `DELETE FROM ${table('breakpoints')} WHERE debug_id=?`, [id])
  for (const point of breakpoints.filter((item) => !item.error)) await connection.execute(`INSERT INTO ${table('breakpoints')}(debug_id,line_number,enabled) VALUES (?,?,?)`, [id, point.line, point.enabled])
}
async function mutateWithLock(connection: DedicatedMysqlSession, id: string, sql: string, values: readonly (string | number | null)[]): Promise<void> {
  const lock = `dfl-debug-${id}`
  const result = await connection.query('SELECT GET_LOCK(?,5) AS got_lock', [lock])
  if (Number(result[0]?.got_lock) !== 1) throw new Error('Could not synchronize with the active routine debugger.')
  try { await connection.execute(sql, values) } finally { await connection.query('SELECT RELEASE_LOCK(?) AS released', [lock]) }
}
function owned(event: IpcMainInvokeEvent, id: string): LiveSession {
  const live = sessions.get(id)
  if (!live || live.ownerId !== event.sender.id) throw new Error('Routine debug session not found for this application window.')
  return live
}
function evaluateWatches(variables: Record<string, unknown>, watches: string[]): DebugWatch[] {
  return watches.map((expression) => evaluateWatchExpression(expression, variables))
}
function emit(live: LiveSession): void {
  if (!live.sender.isDestroyed()) live.sender.send('routine-debugger:event', live.snapshot)
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : 'unknown error' }

async function runTarget(live: LiveSession, args: Array<string | null>, autocommit: boolean, triggerSql?: string, parameters?: Array<{ name: string; type: string; direction: 'IN' | 'OUT' | 'INOUT'; value: string | null }>, timeoutSeconds = 30): Promise<void> {
  let timedOut = false
  const clearSessionTimeout = scheduleDebugSessionTimeout(timeoutSeconds, () => { timedOut = true; live.stopRequested = true; live.snapshot.output.push('Debugging session reached its configured time limit.'); emit(live); live.executor.cancel() })
  const poller = setInterval(() => { void pollSnapshot(live).catch((error: unknown) => { live.snapshot.output.push(`Debugger status could not be refreshed: ${errorText(error)}`); emit(live) }) }, 100)
  try {
    const callArgs = args.map((value) => value === null ? 'NULL' : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`).join(',')
    if (live.target.kind === 'trigger') {
      // The trigger checkpoint must observe command_version updates committed by the controller.
      await live.executor.execute('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
      await live.executor.execute(triggerSql!)
    }
    else {
      const plan = parameters?.length ? buildDebugCallPlan(live.target.database, live.target.name, parameters) : null
      if (plan) for (const statement of plan.setup) await live.executor.execute(statement.sql, statement.values)
      const call = plan?.sql ?? `CALL ${quoteDebugIdentifier(live.target.database)}.${quoteDebugIdentifier(live.target.name)}(${callArgs})`
      const resultsets = await live.executor.queryResultsets(call, plan?.values)
      live.snapshot.resultsets = resultsets.filter((set) => set.length > 0).filter((set) => set.every((row) => !('fieldCount' in row))).map((set) => set)
      if (plan?.outputParameters.length) {
        const outputRows = await live.executor.query(`SELECT ${plan.outputSelect}`)
        live.snapshot.outputParameters = plan.outputParameters.map((item) => ({ name: item.name, value: outputRows[0]?.[item.name] ?? null, type: item.type }))
      }
    }
    live.snapshot.status = 'finished'
    live.snapshot.output.push('Debugging finished.')
  } catch (error) {
    const message = errorText(error)
    live.snapshot.status = timedOut || live.stopRequested || /routine debugging stopped/i.test(message) ? 'stopped' : 'error'
    if (live.snapshot.status === 'error') live.snapshot.output.push(`Routine failed: ${message}`)
  } finally {
    clearInterval(poller)
    clearSessionTimeout()
    if (!['finished', 'stopped', 'error'].includes(live.snapshot.status)) {
      try { await pollSnapshot(live) } catch { /* keep the terminal event */ }
    }
    if (live.target.kind === 'trigger') {
      try { await clearTriggerLocalUserVariables(live) } catch { /* a cancelled target session releases its user variables when the connection closes */ }
      try { await live.executor.execute('SET @tuxsql_linux_debug_id=NULL,@tuxsql_linux_debug_step_kind=NULL,@tuxsql_linux_debug_run_to=NULL,@tuxsql_linux_debug_target_depth=NULL,@tuxsql_linux_debug_current_depth=NULL') } catch { /* a cancelled target session releases its state when the connection closes */ }
    }
    let restored = false
      try { await restoreObject(live.executor, live.target.database, live.target.name, live.target.kind ?? 'procedure', live.originalSql); restored = true }
    catch (targetRestoreError) {
      try { await restoreObject(live.controller, live.target.database, live.target.name, live.target.kind ?? 'procedure', live.originalSql); restored = true }
      catch (controlRestoreError) { live.snapshot.status = 'error'; live.snapshot.output.push(`Routine restoration failed: ${errorText(targetRestoreError)}; recovery through the control session also failed: ${errorText(controlRestoreError)}`) }
    }
    for (const auxiliary of [...live.auxiliaryRoutines].reverse()) {
      try { await restoreObject(live.executor, auxiliary.database, auxiliary.name, 'procedure', auxiliary.originalSql) }
      catch (error) {
        try { await restoreObject(live.controller, auxiliary.database, auxiliary.name, 'procedure', auxiliary.originalSql) }
        catch (fallbackError) { live.snapshot.status = 'error'; live.snapshot.output.push(`Procedure restoration failed for ${auxiliary.database}.${auxiliary.name}: ${errorText(error)}; control-session recovery failed: ${errorText(fallbackError)}`) }
      }
    }
    if (!autocommit) { try { await live.executor.execute('ROLLBACK') } catch { /* connection may already have ended */ } }
    try {
      await mutateWithLock(live.controller, live.id, `UPDATE ${table('debug_sessions')} SET status=? WHERE debug_id=?`, [live.snapshot.status, live.id])
      await live.controller.execute(`DELETE FROM ${table('breakpoints')} WHERE debug_id=?`, [live.id])
      await live.controller.execute(`DELETE FROM ${table('watches')} WHERE debug_id=?`, [live.id])
      if (restored) await live.controller.execute(`DELETE FROM ${table('routine_sources')} WHERE database_name=? AND routine_name=?`, [live.target.database, sourceKeyFor(live.target)])
      for (const auxiliary of live.auxiliaryRoutines) await live.controller.execute(`DELETE FROM ${table('routine_sources')} WHERE database_name=? AND routine_name=?`, [auxiliary.database, auxiliary.name])
    } catch (error) { live.snapshot.output.push(`Cleanup failed: ${errorText(error)}`) }
    try { await live.controller.query('SELECT RELEASE_LOCK(?) AS released', [makeRoutineLockName(live.target)]) } catch { /* closing the control connection releases this lock */ }
    for (const auxiliaryLock of live.auxiliaryLocks) { try { await live.controller.query('SELECT RELEASE_LOCK(?) AS released', [auxiliaryLock]) } catch { /* closing the control connection releases this named lock */ } }
    live.snapshot.watches = evaluateWatches(live.snapshot.variables, live.watches)
    emit(live)
    await live.executor.close(); await live.controller.close()
    sessions.delete(live.id)
  }
}

function makeRoutineLockName(target: DebugRoutineTarget): string { return `dfl-routine-${createHash('sha256').update(`${target.database}\0${target.kind ?? 'procedure'}\0${target.name}`).digest('hex').slice(0, 48)}` }

async function pollSnapshot(live: LiveSession): Promise<void> {
  if (live.target.kind === 'trigger' && ['finished', 'stopped', 'error'].includes(live.snapshot.status)) return
  const rows = await live.controller.query(`SELECT status,current_line,variables_json FROM ${table('debug_sessions')} WHERE debug_id=?`, [live.id])
  const row = rows[0]
  if (!row) return
  let currentFrame: StatementFrame | undefined
  if (live.target.kind === 'trigger' && row.status !== 'stopped') {
    const frames = live.statementFrames
    const owners = await live.controller.query(`SELECT ${frames.map((_, index) => `IS_USED_LOCK(?) AS frame_${index}`).join(',')}`, frames.map((candidate) => triggerPauseLockName(live.id, candidate.line, candidate.depth)))
    const ownerRow = owners[0] ?? {}
    const activeIndex = frames.findIndex((_, index) => ownerRow[`frame_${index}`] != null)
    if (activeIndex >= 0) currentFrame = frames[activeIndex]
  }
  const triggerLine = currentFrame?.line
  const triggerDepth = currentFrame?.depth ?? 0
  const triggerPaused = currentFrame !== undefined
  const nextStatus = live.target.kind === 'trigger' ? row.status === 'stopped' ? 'stopped' as const : triggerPaused ? 'paused' as const : 'running' as const : String(row.status) as DebugSessionStatus
  const rawVariables = live.target.kind === 'trigger' ? null : row.variables_json
  let variables: Record<string, unknown> = {}
  if (rawVariables && typeof rawVariables === 'object') variables = rawVariables as Record<string, unknown>
  else if (typeof rawVariables === 'string') { try { variables = JSON.parse(rawVariables) as Record<string, unknown> } catch { variables = {} } }
  if (live.target.kind === 'trigger' && currentFrame && live.localsAvailable && currentFrame.locals.length) {
    try { variables = await readTriggerLocals(live, currentFrame) }
    catch {
      live.localsAvailable = false
      appendLocalsUnavailable(live)
      variables = {}
    }
  }
  const line = live.target.kind === 'trigger' ? triggerLine : row.current_line == null ? undefined : Number(row.current_line)
  const changed = live.snapshot.status !== nextStatus || live.snapshot.line !== line || JSON.stringify(live.snapshot.variables) !== JSON.stringify(variables)
  live.snapshot.status = nextStatus
  live.snapshot.line = line
  live.snapshot.variables = variables
  live.snapshot.callStack = live.target.kind === 'trigger' && currentFrame && triggerDepth > 0
    ? [{ routine: `${live.target.database}.${live.target.name}`, line: 0, depth: 0 }, { routine: `${live.target.database}.${currentFrame.routine}`, line: triggerLine ?? 0, depth: triggerDepth }]
    : [{ routine: `${live.target.database}.${live.target.name}`, line: line ?? 0, depth: 0 }]
  live.snapshot.watches = evaluateWatches(variables, live.watches)
  if (changed) emit(live)
}

async function canReadTriggerLocals(controller: DedicatedMysqlSession, executorProcessId: number): Promise<boolean> {
  try {
    const setting = await controller.query('SELECT @@performance_schema AS enabled')
    if (Number(setting[0]?.enabled) !== 1) return false
    const thread = await controller.query('SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID=? LIMIT 1', [executorProcessId])
    if (!thread.length) return false
    await controller.query('SELECT VARIABLE_NAME,VARIABLE_VALUE FROM performance_schema.user_variables_by_thread WHERE THREAD_ID=? LIMIT 0', [thread[0]!.THREAD_ID as number])
    return true
  } catch { return false }
}

async function readTriggerLocals(live: LiveSession, frame: StatementFrame): Promise<Record<string, unknown>> {
  const prefix = `tuxsql_dbg_${live.localVariablePrefix}_`
  const rows = await live.controller.query(
    'SELECT uv.VARIABLE_NAME,uv.VARIABLE_VALUE FROM performance_schema.threads AS t JOIN performance_schema.user_variables_by_thread AS uv ON uv.THREAD_ID=t.THREAD_ID WHERE t.PROCESSLIST_ID=? AND LEFT(uv.VARIABLE_NAME,?)=?',
    [live.executorProcessId, prefix.length, prefix]
  )
  const byUserVariable = new Map(rows.map((row) => [String(row.VARIABLE_NAME), boundedVariableValue(row.VARIABLE_VALUE)]))
  const variables: Record<string, unknown> = {}
  for (const local of frame.locals) {
    if (byUserVariable.has(local.userVariable)) variables[local.name] = byUserVariable.get(local.userVariable)
  }
  return variables
}

function boundedVariableValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.subarray(0, 4096).toString('utf8')
  if (value instanceof Uint8Array) return Buffer.from(value).subarray(0, 4096).toString('utf8')
  if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > 4096) {
    const bytes = Buffer.from(value, 'utf8').subarray(0, 4096)
    return bytes.toString('utf8').replace(/\uFFFD+$/u, '')
  }
  return value
}

function appendLocalsUnavailable(live: LiveSession): void {
  if (live.snapshot.output.includes(LOCALS_UNAVAILABLE_MESSAGE)) return
  live.snapshot.output.push(LOCALS_UNAVAILABLE_MESSAGE)
  emit(live)
}

async function clearTriggerLocalUserVariables(live: LiveSession): Promise<void> {
  const names = [...new Set(live.statementFrames.flatMap((frame) => frame.locals.map((local) => local.userVariable)))].filter((name) => /^[A-Za-z0-9_]+$/.test(name))
  if (names.length) await live.executor.execute(`SET ${names.map((name) => `@${name}=NULL`).join(', ')}`)
}

function triggerPauseLockName(id: string, line: number, depth = 0): string { return depth === 0 ? `dfl-pause-${id}-${line}` : `dfl-pause-${id}-${depth}-${line}` }

async function restoreObject(connection: DedicatedMysqlSession, database: string, name: string, kind: 'procedure' | 'trigger', originalSql: string): Promise<void> {
  await connection.execute(`USE ${quoteDebugIdentifier(database)}`)
  await connection.execute(`DROP ${kind === 'trigger' ? 'TRIGGER' : 'PROCEDURE'} IF EXISTS ${quoteDebugIdentifier(database)}.${quoteDebugIdentifier(name)}`)
  await connection.execute(originalSql)
}
