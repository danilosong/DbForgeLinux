import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { IpcDeps } from './registry.js'
import { ipcMain } from './registry.js'
import { DEBUG_SCHEMA, engineDdl, instrumentProcedure, instrumentTrigger, quoteDebugIdentifier, type DebugBreakpoint, type DebugRoutineTarget, type DebugSessionStatus, type DebugSnapshot, type DebugStepKind, type DebugWatch } from '../../modules/routine-debugger/index.js'
import type { DedicatedMysqlSession } from '../db/MysqlDriver.js'

interface LiveSession { id: string; ownerId: number; sender: WebContents; target: DebugRoutineTarget; controller: DedicatedMysqlSession; executor: DedicatedMysqlSession; originalSql: string; instrumentedSql: string; statementLines: number[]; task?: Promise<void>; snapshot: DebugSnapshot; watches: string[]; stopRequested: boolean }
const sessions = new Map<string, LiveSession>()
const table = (name: string): string => `${quoteDebugIdentifier(DEBUG_SCHEMA)}.${quoteDebugIdentifier(name)}`

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
  ipcMain.handle('routine-debugger:start', async (event, target: DebugRoutineTarget, args: Array<string | null>, breakpoints: DebugBreakpoint[], autocommit: boolean, confirmedAutocommit: boolean, triggerSql?: string) => {
    validateTarget(target)
    if (!Array.isArray(args) || args.length > 64 || args.some((arg) => arg !== null && (typeof arg !== 'string' || arg.length > 100_000))) throw new Error('Routine argument list is invalid.')
    if (autocommit !== true && autocommit !== false) throw new Error('Choose an autocommit mode.')
    if (!confirmedAutocommit) throw new Error('Confirm the autocommit behavior before starting routine debugging.')
    if (target.kind === 'trigger') validateTriggerSql(triggerSql)
    const engine = await inspectEngine(driver, target.connectionId)
    if (!engine.installed) throw new Error('Deploy the debug engine before starting a routine debug session.')
    const preview = await compilePreview(driver, target)
    const id = randomUUID()
    const controller = await driver.openDedicatedSession(target.connectionId)
    let executor: DedicatedMysqlSession | undefined
    let routineDropped = false
    let routineLock = false
    try {
      executor = await driver.openDedicatedSession(target.connectionId)
      await controller.execute(`USE ${quoteDebugIdentifier(DEBUG_SCHEMA)}`)
      const routineLockName = makeRoutineLockName(target)
      const routineLockResult = await controller.query('SELECT GET_LOCK(?,0) AS got_lock', [routineLockName])
      if (Number(routineLockResult[0]?.got_lock) !== 1) throw new Error(`This stored ${target.kind ?? 'procedure'} already has an active debug session.`)
      routineLock = true
      const sourceKey = sourceKeyFor(target)
      await controller.execute(`INSERT INTO ${table('routine_sources')}(database_name,routine_name,original_sql) VALUES (?,?,?) ON DUPLICATE KEY UPDATE original_sql=VALUES(original_sql)`, [target.database, sourceKey, preview.originalSql])
      await controller.execute(`INSERT INTO ${table('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?, 'running','into')`, [id, target.connectionId, target.database, sourceKey])
      await writeBreakpoints(controller, id, sanitizeBreakpoints(breakpoints, preview.statementLines))
      await executor.execute(`USE ${quoteDebugIdentifier(target.database)}`)
      await executor.execute(`SET autocommit=${autocommit ? '1' : '0'}`)
      await executor.execute(`DROP ${target.kind === 'trigger' ? 'TRIGGER' : 'PROCEDURE'} ${quoteDebugIdentifier(target.database)}.${quoteDebugIdentifier(target.name)}`)
      routineDropped = true
      await executor.execute(preview.instrumentedSql)
      await executor.execute(`SET @dbforge_linux_debug_id='${id}'`)
    } catch (error) {
      let restoreFailure: unknown
      if (routineDropped) {
        try { await restoreObject(executor!, target.database, target.name, target.kind ?? 'procedure', preview.originalSql) }
        catch (restoreError) { restoreFailure = restoreError }
      }
      try { await controller.execute(`UPDATE ${table('debug_sessions')} SET status='error' WHERE debug_id=?`, [id]); await controller.execute(`DELETE FROM ${table('breakpoints')} WHERE debug_id=?`, [id]); await controller.execute(`DELETE FROM ${table('watches')} WHERE debug_id=?`, [id]); if (!restoreFailure) await controller.execute(`DELETE FROM ${table('routine_sources')} WHERE database_name=? AND routine_name=?`, [target.database, sourceKeyFor(target)]) } catch { /* deployment state may be partial */ }
      if (routineLock) { try { await controller.query('SELECT RELEASE_LOCK(?) AS released', [makeRoutineLockName(target)]) } catch { /* closing connection releases the named lock */ } }
      await controller.close(); await executor?.close(); throw error
    }
    const snapshot: DebugSnapshot = { sessionId: id, status: 'running', routine: `${target.database}.${target.name}`, variables: {}, breakpoints: sanitizeBreakpoints(breakpoints, preview.statementLines), watches: [], callStack: [{ routine: `${target.database}.${target.name}`, line: 0, depth: 0 }], output: [target.kind === 'trigger' ? 'Trigger debugging started.' : 'Debugging started.'] }
    const live: LiveSession = { id, ownerId: event.sender.id, sender: event.sender, target, controller, executor, originalSql: preview.originalSql, instrumentedSql: preview.instrumentedSql, statementLines: preview.statementLines, snapshot, watches: [], stopRequested: false }
    sessions.set(id, live)
    live.task = runTarget(live, args, autocommit, triggerSql)
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
    if (!['continue', 'into', 'over', 'out', 'run-to-cursor'].includes(command)) throw new Error('Unsupported debugger command.')
    if (command === 'run-to-cursor' && (!Number.isInteger(line) || line! < 1)) throw new Error('Select a valid source line for Run To Cursor.')
    const state = live.snapshot.status
    if (state !== 'paused') throw new Error('The routine must be paused to execute a debug command.')
    if (live.target.kind === 'trigger') {
      const code: Record<Exclude<DebugStepKind, 'run-to-cursor'>, string> = { continue: 'c', into: 'i', over: 'o', out: 'u' }
      const signalName = command === 'run-to-cursor' ? `dfl-cmd-${id}-r${line}` : `dfl-cmd-${id}-${code[command]}`
      const acquired = await live.controller.query('SELECT GET_LOCK(?,0) AS got_lock', [signalName])
      if (Number(acquired[0]?.got_lock) !== 1) throw new Error('Could not signal the paused trigger debugger.')
      try {
        const currentLine = live.snapshot.line
        if (!currentLine) throw new Error('Trigger debugger has no current source line.')
        for (let attempt = 0; attempt < 100; attempt++) {
          const state = await live.controller.query('SELECT IS_USED_LOCK(?) AS owner', [triggerPauseLockName(id, currentLine)])
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
    if (!Array.isArray(value) || value.length > 100 || value.some((name) => typeof name !== 'string' || !/^[A-Za-z_$][\w$]{0,126}$/.test(name))) throw new Error('Watches must be local variable names no longer than 127 characters.')
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

async function compilePreview(driver: IpcDeps['driver'], target: DebugRoutineTarget): Promise<{ originalSql: string; instrumentedSql: string; statementLines: number[] }> {
  validateTarget(target)
  const kind = target.kind ?? 'procedure'
  const originalSql = await driver.showCreateObject(target.connectionId, target.database, { name: target.name, kind })
  const result = kind === 'trigger' ? instrumentTrigger(originalSql) : instrumentProcedure(originalSql)
  return { originalSql, instrumentedSql: result.sql, statementLines: result.statementLines }
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
  return watches.map((name) => Object.hasOwn(variables, name) ? { name, value: variables[name], type: variables[name] === null ? 'NULL' : typeof variables[name] } : { name, error: 'This local variable is not in scope at the current statement.' })
}
function emit(live: LiveSession): void {
  if (!live.sender.isDestroyed()) live.sender.send('routine-debugger:event', live.snapshot)
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : 'unknown error' }

async function runTarget(live: LiveSession, args: Array<string | null>, autocommit: boolean, triggerSql?: string): Promise<void> {
  const poller = setInterval(() => { void pollSnapshot(live).catch((error: unknown) => { live.snapshot.output.push(`Debugger status could not be refreshed: ${errorText(error)}`); emit(live) }) }, 120)
  try {
    const callArgs = args.map((value) => value === null ? 'NULL' : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`).join(',')
    if (live.target.kind === 'trigger') {
      // The trigger checkpoint must observe command_version updates committed by the controller.
      await live.executor.execute('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
      await live.executor.execute(triggerSql!)
    }
    else await live.executor.execute(`CALL ${quoteDebugIdentifier(live.target.database)}.${quoteDebugIdentifier(live.target.name)}(${callArgs})`)
    live.snapshot.status = 'finished'
    live.snapshot.output.push('Debugging finished.')
  } catch (error) {
    const message = errorText(error)
    live.snapshot.status = live.stopRequested || /routine debugging stopped/i.test(message) ? 'stopped' : 'error'
    if (live.snapshot.status === 'error') live.snapshot.output.push(`Routine failed: ${message}`)
  } finally {
    clearInterval(poller)
    try { await pollSnapshot(live) } catch { /* keep the terminal event */ }
    let restored = false
      try { await restoreObject(live.executor, live.target.database, live.target.name, live.target.kind ?? 'procedure', live.originalSql); restored = true }
    catch (targetRestoreError) {
      try { await restoreObject(live.controller, live.target.database, live.target.name, live.target.kind ?? 'procedure', live.originalSql); restored = true }
      catch (controlRestoreError) { live.snapshot.status = 'error'; live.snapshot.output.push(`Routine restoration failed: ${errorText(targetRestoreError)}; recovery through the control session also failed: ${errorText(controlRestoreError)}`) }
    }
    if (!autocommit) { try { await live.executor.execute('ROLLBACK') } catch { /* connection may already have ended */ } }
    try {
      await mutateWithLock(live.controller, live.id, `UPDATE ${table('debug_sessions')} SET status=? WHERE debug_id=?`, [live.snapshot.status, live.id])
      await live.controller.execute(`DELETE FROM ${table('breakpoints')} WHERE debug_id=?`, [live.id])
      await live.controller.execute(`DELETE FROM ${table('watches')} WHERE debug_id=?`, [live.id])
      if (restored) await live.controller.execute(`DELETE FROM ${table('routine_sources')} WHERE database_name=? AND routine_name=?`, [live.target.database, sourceKeyFor(live.target)])
    } catch (error) { live.snapshot.output.push(`Cleanup failed: ${errorText(error)}`) }
    try { await live.controller.query('SELECT RELEASE_LOCK(?) AS released', [makeRoutineLockName(live.target)]) } catch { /* closing the control connection releases this lock */ }
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
  let triggerLine: number | undefined
  if (live.target.kind === 'trigger' && row.status !== 'stopped') {
    for (const candidate of live.statementLines) {
      const lock = await live.controller.query('SELECT IS_USED_LOCK(?) AS owner', [triggerPauseLockName(live.id, candidate)])
      if (lock[0]?.owner != null) { triggerLine = candidate; break }
    }
  }
  const nextStatus = live.target.kind === 'trigger' ? row.status === 'stopped' ? 'stopped' as const : triggerLine === undefined ? 'running' as const : 'paused' as const : String(row.status) as DebugSessionStatus
  const rawVariables = row.variables_json
  let variables: Record<string, unknown> = {}
  if (rawVariables && typeof rawVariables === 'object') variables = rawVariables as Record<string, unknown>
  else if (typeof rawVariables === 'string') { try { variables = JSON.parse(rawVariables) as Record<string, unknown> } catch { variables = {} } }
  const line = live.target.kind === 'trigger' ? triggerLine : row.current_line == null ? undefined : Number(row.current_line)
  const changed = live.snapshot.status !== nextStatus || live.snapshot.line !== line || JSON.stringify(live.snapshot.variables) !== JSON.stringify(variables)
  live.snapshot.status = nextStatus
  live.snapshot.line = line
  live.snapshot.variables = variables
  live.snapshot.callStack = [{ routine: `${live.target.database}.${live.target.name}`, line: line ?? 0, depth: 0 }]
  live.snapshot.watches = evaluateWatches(variables, live.watches)
  if (changed) emit(live)
}

function triggerPauseLockName(id: string, line: number): string { return `dfl-pause-${id}-${line}` }

async function restoreObject(connection: DedicatedMysqlSession, database: string, name: string, kind: 'procedure' | 'trigger', originalSql: string): Promise<void> {
  await connection.execute(`USE ${quoteDebugIdentifier(database)}`)
  await connection.execute(`DROP ${kind === 'trigger' ? 'TRIGGER' : 'PROCEDURE'} IF EXISTS ${quoteDebugIdentifier(database)}.${quoteDebugIdentifier(name)}`)
  await connection.execute(originalSql)
}
