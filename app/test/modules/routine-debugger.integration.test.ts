import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { engineDdl, instrumentProcedure, instrumentTrigger, quoteDebugIdentifier } from '../../src/modules/routine-debugger/index.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('routine debugger MySQL integration', () => {
  const driver = new MysqlDriver()
  const testDatabase = `tuxsql_debug_test_${process.pid}_${randomUUID().slice(0, 8)}`
  const procedure = `routine_debug_${process.pid}_${randomUUID().slice(0, 8)}`
  const triggerChild = `trigger_child_${process.pid}_${randomUUID().slice(0, 8)}`
  const debugId = randomUUID()
  const triggerDebugId = randomUUID()
  const trigger = `trigger_debug_${process.pid}_${randomUUID().slice(0, 8)}`
  let connectionId = ''
  let controller: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let executor: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let callTask: Promise<void> | undefined
  let currentTriggerLine = 0
  let currentTriggerDepth = 0
  const schema = (name: string): string => `${quoteDebugIdentifier(testDatabase)}.${quoteDebugIdentifier(name)}`

  afterAll(async () => {
    if (controller) {
      try { await controller.execute(`UPDATE ${schema('debug_sessions')} SET status='stopped' WHERE debug_id IN (?,?)`, [debugId, triggerDebugId]) } catch { /* engine may not have been created */ }
    }
    try { executor?.cancel() } catch { /* release any in-flight trigger pause after test failure */ }
    try { await callTask } catch { /* expected if cleanup stopped execution */ }
    if (executor) {
      try { await executor.execute(`USE ${quoteDebugIdentifier(testDatabase)}`); await executor.execute(`DROP TRIGGER IF EXISTS ${quoteDebugIdentifier(trigger)}`); await executor.execute(`DROP PROCEDURE IF EXISTS ${quoteDebugIdentifier(procedure)}`); await executor.execute(`DROP PROCEDURE IF EXISTS ${quoteDebugIdentifier(triggerChild)}`); await executor.execute('DROP TABLE IF EXISTS audit_log, audit_values, debug_values') } catch { /* disposable test server cleanup */ }
      await executor.close()
    }
    if (controller) { await controller.close() }
    if (connectionId) {
      try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS ${quoteDebugIdentifier(testDatabase)}`) } catch { /* disposable test server cleanup */ }
      await driver.disconnect(connectionId)
    }
  }, 30000)

  it('deploys the helper, pauses in a dedicated target session, steps, and restores the original DDL', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection(`tuxsql_test_routine_connection_${process.pid}_${randomUUID().slice(0, 8)}`, 'Routine debugger integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only'
    })
    controller = await driver.openDedicatedSession(connectionId)
    executor = await driver.openDedicatedSession(connectionId)
    await controller.execute("SET SESSION sql_mode='STRICT_ALL_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
    for (const sql of engineDdl(testDatabase)) await controller.execute(sql)
    await executor.execute(`USE ${quoteDebugIdentifier(testDatabase)}`)
    await executor.execute('DROP TABLE IF EXISTS debug_values')
    await executor.execute('CREATE TABLE debug_values (id INT PRIMARY KEY)')
    await executor.execute('INSERT INTO debug_values VALUES (1),(2),(3)')
    const original = `CREATE PROCEDURE ${quoteDebugIdentifier(procedure)}()
BEGIN
  DECLARE local_value INT DEFAULT 0;
  DECLARE total_value INT DEFAULT 0;
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE rows_cursor CURSOR FOR SELECT id FROM debug_values ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = TRUE;
  OPEN rows_cursor;
  read_loop: LOOP
    FETCH rows_cursor INTO local_value;
    IF finished THEN LEAVE read_loop; END IF;
    SET total_value = total_value + local_value;
  END LOOP;
  CLOSE rows_cursor;
  SELECT total_value INTO @routine_debug_result;
END`
    await executor.execute(`DROP PROCEDURE IF EXISTS ${quoteDebugIdentifier(procedure)}`)
    await executor.execute(original)
    const instrumented = instrumentProcedure(original, testDatabase)
    await controller.execute(`USE ${quoteDebugIdentifier(testDatabase)}`)
    await controller.execute(`INSERT INTO ${schema('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?,'running','into')`, [debugId, connectionId, testDatabase, procedure])
    await executor.execute(`DROP PROCEDURE ${quoteDebugIdentifier(procedure)}`)
    await executor.execute(instrumented.sql)
    await executor.execute(`SET @tuxsql_linux_debug_id='${debugId}'`)
    await controller.execute(`INSERT INTO ${schema('breakpoints')}(debug_id,line_number,enabled) VALUES (?,?,TRUE)`, [debugId, instrumented.statementLines[1]])
    callTask = executor.execute(`CALL ${quoteDebugIdentifier(procedure)}()`).then(() => undefined)

    const firstPause = await waitForStatus('paused')
    expect(Number(firstPause.current_line)).toBe(instrumented.statementLines[0])
    const firstVariables = parseJson(firstPause.variables_json)
    expect(Number(firstVariables.local_value)).toBe(0)
    await command('continue')
    const secondPause = await waitForLine(instrumented.statementLines[1]!)
    expect(String(secondPause.status)).toBe('paused')
    await command('into')
    await waitForLine(instrumented.statementLines[2]!)
    await command('continue')
    await callTask
    const result = await executor.query('SELECT @routine_debug_result AS result')
    expect(Number(result[0]?.result)).toBe(6)
    await executor.execute(`DROP PROCEDURE ${quoteDebugIdentifier(procedure)}`)
    await executor.execute(original)
    const restored = await executor.query(`SHOW CREATE PROCEDURE ${quoteDebugIdentifier(procedure)}`)
    expect(String(Object.entries(restored[0] ?? {}).find(([key]) => key.startsWith('Create '))?.[1])).toContain('SELECT total_value INTO @routine_debug_result')

    await executor.execute('CREATE TABLE audit_values (id INT PRIMARY KEY)')
    await executor.execute('CREATE TABLE audit_log (id INT NOT NULL)')
    const childSource = `CREATE PROCEDURE ${quoteDebugIdentifier(triggerChild)}()\nBEGIN\n  DECLARE child_value INT DEFAULT 41;\n  SET @trigger_child_value = child_value;\nEND`
    await executor.execute(childSource)
    const localPrefix = triggerDebugId.replaceAll('-', '').slice(0, 20)
    const instrumentedChild = instrumentProcedure(childSource, testDatabase, triggerChild, 1, localPrefix)
    const triggerSource = `CREATE TRIGGER ${quoteDebugIdentifier(trigger)} AFTER INSERT ON audit_values FOR EACH ROW\nBEGIN\n  DECLARE trigger_value INT DEFAULT NEW.id;\n  CALL ${quoteDebugIdentifier(triggerChild)}();\n  INSERT INTO audit_log(id) VALUES (trigger_value + @trigger_child_value);\nEND`
    await executor.execute(triggerSource)
    const instrumentedTrigger = instrumentTrigger(triggerSource, testDatabase, trigger, localPrefix)
    await controller.execute(`INSERT INTO ${schema('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?,'running','into')`, [triggerDebugId, connectionId, testDatabase, `TRIGGER:${trigger}`])
    await controller.execute(`INSERT INTO ${schema('breakpoints')}(debug_id,line_number,enabled) VALUES (?,?,TRUE)`, [triggerDebugId, instrumentedTrigger.statementLines[0]])
    await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(trigger)}`)
    await executor.execute(`DROP PROCEDURE ${quoteDebugIdentifier(triggerChild)}`)
    await executor.execute(instrumentedChild.sql)
    await executor.execute(instrumentedTrigger.sql)
    await executor.execute(`SET @tuxsql_linux_debug_id='${triggerDebugId}'`)
    await executor.execute('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
    const executorId = Number((await executor.query('SELECT CONNECTION_ID() AS connection_id'))[0]?.connection_id)
    callTask = executor.execute('INSERT INTO audit_values VALUES (10)').then(() => undefined)
    await waitForTriggerPause(triggerDebugId, instrumentedTrigger.statementLines[0]!, callTask, 0)
    expect(instrumentedTrigger.variables).toContain('trigger_value')
    expect(await readThreadLocal(executorId, instrumentedTrigger.checkpoints[0]!.locals[0]!)).toBe('10')
    await command('into', triggerDebugId)
    await waitForTriggerPause(triggerDebugId, instrumentedChild.statementLines[0]!, callTask, 1)
    expect(instrumentedChild.variables).toContain('child_value')
    expect(await readThreadLocal(executorId, instrumentedChild.checkpoints[0]!.locals[0]!)).toBe('41')
    await command('out', triggerDebugId)
    await waitForTriggerPause(triggerDebugId, instrumentedTrigger.statementLines[1]!, callTask, 0)
    expect(await readThreadLocal(executorId, instrumentedTrigger.checkpoints[1]!.locals[0]!)).toBe('10')
    await command('continue', triggerDebugId)
    const triggerOutcome = await Promise.race([callTask.then(() => 'finished', () => 'failed'), new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 5_000))])
    if (triggerOutcome === 'timeout') {
      const state = await controller.query(`SELECT status,step_kind,command_version FROM ${schema('debug_sessions')} WHERE debug_id=?`, [triggerDebugId])
      throw new Error(`Trigger did not resume after command ${JSON.stringify(state[0])}.`)
    }
    await callTask
    expect(Number((await executor.query('SELECT id FROM audit_log'))[0]?.id)).toBe(51)
    const remainingLocals = await controller.query('SELECT VARIABLE_NAME,VARIABLE_VALUE FROM performance_schema.user_variables_by_thread WHERE THREAD_ID=(SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID=?) AND VARIABLE_NAME LIKE ?', [executorId, `tuxsql_dbg_${localPrefix}_%`])
    expect(remainingLocals.every((row) => row.VARIABLE_VALUE == null)).toBe(true)
    await executor.execute(`DROP PROCEDURE ${quoteDebugIdentifier(triggerChild)}`)
    await executor.execute(childSource)
    await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(trigger)}`)
    await executor.execute(triggerSource)
    const restoredTrigger = await executor.query(`SHOW CREATE TRIGGER ${quoteDebugIdentifier(trigger)}`)
    expect(Object.values(restoredTrigger[0] ?? {}).map(String).join('\n')).toContain('INSERT INTO audit_log')

    const concurrentExecutor = await driver.openDedicatedSession(connectionId)
    try {
      await executor.execute(`CREATE TABLE concurrent_a (id INT PRIMARY KEY)`)
      await executor.execute(`CREATE TABLE concurrent_b (id INT PRIMARY KEY)`)
      await executor.execute('CREATE TABLE concurrent_a_log (value VARCHAR(20))')
      await executor.execute('CREATE TABLE concurrent_b_log (value VARCHAR(20))')
      const idA = randomUUID(); const idB = randomUUID()
      const prefixA = idA.replaceAll('-', '').slice(0, 20); const prefixB = idB.replaceAll('-', '').slice(0, 20)
      const nameA = `trigger_concurrent_a_${process.pid}`; const nameB = `trigger_concurrent_b_${process.pid}`
      const sourceA = `CREATE TRIGGER ${quoteDebugIdentifier(nameA)} AFTER INSERT ON concurrent_a FOR EACH ROW\nBEGIN\n  DECLARE private_value VARCHAR(20) DEFAULT 'alpha';\n  INSERT INTO concurrent_a_log(value) VALUES (private_value);\nEND`
      const sourceB = `CREATE TRIGGER ${quoteDebugIdentifier(nameB)} AFTER INSERT ON concurrent_b FOR EACH ROW\nBEGIN\n  DECLARE private_value VARCHAR(20) DEFAULT 'bravo';\n  INSERT INTO concurrent_b_log(value) VALUES (private_value);\nEND`
      const compiledA = instrumentTrigger(sourceA, testDatabase, nameA, prefixA)
      const compiledB = instrumentTrigger(sourceB, testDatabase, nameB, prefixB)
      await executor.execute(sourceA); await executor.execute(sourceB)
      await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(nameA)}`); await executor.execute(compiledA.sql)
      await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(nameB)}`)
      await concurrentExecutor.execute(`USE ${quoteDebugIdentifier(testDatabase)}`)
      await concurrentExecutor.execute(compiledB.sql)
      await controller.execute(`INSERT INTO ${schema('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?,'running','into'),(?,?,?,?,'running','into')`, [idA, connectionId, testDatabase, `TRIGGER:${nameA}`, idB, connectionId, testDatabase, `TRIGGER:${nameB}`])
      await executor.execute(`SET @tuxsql_linux_debug_id=NULL,@tuxsql_linux_debug_step_kind=NULL,@tuxsql_linux_debug_run_to=NULL,@tuxsql_linux_debug_target_depth=NULL,@tuxsql_linux_debug_current_depth=NULL,@tuxsql_linux_debug_id='${idA}'`)
      await concurrentExecutor.execute(`SET @tuxsql_linux_debug_id=NULL,@tuxsql_linux_debug_step_kind=NULL,@tuxsql_linux_debug_run_to=NULL,@tuxsql_linux_debug_target_depth=NULL,@tuxsql_linux_debug_current_depth=NULL,@tuxsql_linux_debug_id='${idB}'`)
      const processA = Number((await executor.query('SELECT CONNECTION_ID() AS connection_id'))[0]?.connection_id)
      const processB = Number((await concurrentExecutor.query('SELECT CONNECTION_ID() AS connection_id'))[0]?.connection_id)
      const taskA = executor.execute('INSERT INTO concurrent_a VALUES (1)')
      const taskB = concurrentExecutor.execute('INSERT INTO concurrent_b VALUES (1)')
      const localA = compiledA.checkpoints[0]!.locals[0]!
      const localB = compiledB.checkpoints[0]!.locals[0]!
      await waitForPauseLock(idA, compiledA.statementLines[0]!, taskA)
      await waitForPauseLock(idB, compiledB.statementLines[0]!, taskB)
      expect(localA.userVariable).not.toBe(localB.userVariable)
      expect(await readThreadLocal(processA, localA)).toBe('alpha')
      expect(await readThreadLocal(processB, localB)).toBe('bravo')
      expect(await readThreadValue(processA, localB.userVariable)).toBeNull()
      expect(await readThreadValue(processB, localA.userVariable)).toBeNull()
      await resumeTrigger(idA, compiledA.statementLines[0]!)
      await resumeTrigger(idB, compiledB.statementLines[0]!)
      await Promise.all([taskA, taskB])
      expect(await readThreadValue(processA, localA.userVariable)).toBeNull()
      expect(await readThreadValue(processB, localB.userVariable)).toBeNull()
      expect((await executor.query('SELECT value FROM concurrent_a_log'))[0]?.value).toBe('alpha')
      expect((await executor.query('SELECT value FROM concurrent_b_log'))[0]?.value).toBe('bravo')
      await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(nameA)}`); await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(nameB)}`)
      await executor.execute('DROP TABLE concurrent_a, concurrent_b, concurrent_a_log, concurrent_b_log')
    } finally { await concurrentExecutor.close() }
  }, 30000)

  async function command(kind: 'into' | 'continue' | 'out', sessionId = debugId): Promise<void> {
    if (sessionId === triggerDebugId) {
      const signalName = `dfl-cmd-${sessionId}-${kind === 'continue' ? 'c' : kind === 'out' ? 'u' : 'i'}`
      await controller!.query('SELECT GET_LOCK(?,0) AS got_lock', [signalName])
      try {
        const pauseLock = currentTriggerDepth === 0 ? `dfl-pause-${sessionId}-${currentTriggerLine}` : `dfl-pause-${sessionId}-${currentTriggerDepth}-${currentTriggerLine}`
        for (let index = 0; index < 100; index++) {
          const rows = await controller!.query('SELECT IS_USED_LOCK(?) AS owner', [pauseLock])
          if (rows[0]?.owner == null) return
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        throw new Error('Trigger checkpoint did not acknowledge step command.')
      } finally { await controller!.query('SELECT RELEASE_LOCK(?) AS released', [signalName]) }
    }
    const lock = `dfl-debug-${sessionId}`
    await controller!.query('SELECT GET_LOCK(?,5) AS got_lock', [lock])
    await controller!.execute(`UPDATE ${schema('debug_sessions')} SET status='running',step_kind=?,command_version=command_version+1 WHERE debug_id=?`, [kind, sessionId])
    await controller!.query('SELECT RELEASE_LOCK(?) AS released', [lock])
  }
  async function waitForStatus(status: string, sessionId = debugId, targetTask = callTask): Promise<Record<string, unknown>> {
    let last: Record<string, unknown> = {}
    for (let index = 0; index < 200; index++) {
      const rows = await controller!.query(`SELECT status,current_line,variables_json FROM ${schema('debug_sessions')} WHERE debug_id=?`, [sessionId])
      last = rows[0] ?? {}
      if (String(rows[0]?.status) === status) return rows[0]!
      if (targetTask) { const outcome = await Promise.race([targetTask.then(() => 'finished', () => 'failed'), new Promise<'wait'>(resolve => setTimeout(() => resolve('wait'), 20))]); if (outcome !== 'wait') throw new Error(`Target finished before debugger reached ${status}.`) }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for debugger status ${status}; latest state was ${JSON.stringify(last)}.`)
  }
  async function waitForLine(line: number): Promise<Record<string, unknown>> {
    for (let index = 0; index < 200; index++) {
      const rows = await controller!.query(`SELECT status,current_line,variables_json FROM ${schema('debug_sessions')} WHERE debug_id=?`, [debugId])
      if (Number(rows[0]?.current_line) === line && String(rows[0]?.status) === 'paused') return rows[0]!
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for debugger line ${line}.`)
  }
  async function waitForTriggerPause(sessionId: string, line: number, task: Promise<void>, depth = 0): Promise<void> {
    currentTriggerLine = line
    currentTriggerDepth = depth
    const lockName = depth === 0 ? `dfl-pause-${sessionId}-${line}` : `dfl-pause-${sessionId}-${depth}-${line}`
    for (let index = 0; index < 250; index++) {
      const rows = await controller!.query('SELECT IS_USED_LOCK(?) AS owner', [lockName])
      if (rows[0]?.owner != null) return
      const outcome = await Promise.race([task.then(() => 'finished', () => 'failed'), new Promise<'wait'>(resolve => setTimeout(() => resolve('wait'), 20))])
      if (outcome !== 'wait') throw new Error(`Trigger completed before debugger paused (${outcome}).`)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Timed out waiting for trigger pause lock.')
  }
  function parseJson(value: unknown): Record<string, unknown> { return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value as Record<string, unknown> }
  async function readThreadLocal(processlistId: number, local: { name: string; userVariable: string }): Promise<string | null> {
    const value = await readThreadValue(processlistId, local.userVariable)
    return value == null ? null : String(value)
  }
  async function readThreadValue(processlistId: number, variableName: string): Promise<unknown> {
    const rows = await controller!.query('SELECT VARIABLE_VALUE FROM performance_schema.user_variables_by_thread WHERE THREAD_ID=(SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID=?) AND VARIABLE_NAME=?', [processlistId, variableName])
    const value = rows[0]?.VARIABLE_VALUE
    return value == null ? null : Buffer.isBuffer(value) ? value.toString('utf8') : String(value)
  }
  async function waitForPauseLock(sessionId: string, line: number, task: Promise<void>): Promise<void> {
    const lock = `dfl-pause-${sessionId}-${line}`
    for (let index = 0; index < 250; index++) {
      if ((await controller!.query('SELECT IS_USED_LOCK(?) AS owner', [lock]))[0]?.owner != null) return
      const outcome = await Promise.race([task.then(() => 'finished', () => 'failed'), new Promise<'wait'>(resolve => setTimeout(() => resolve('wait'), 20))])
      if (outcome !== 'wait') throw new Error(`Concurrent trigger finished before pausing (${outcome}).`)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Timed out waiting for a concurrent trigger pause.')
  }
  async function resumeTrigger(sessionId: string, line: number): Promise<void> {
    const signal = `dfl-cmd-${sessionId}-c`; const pause = `dfl-pause-${sessionId}-${line}`
    await controller!.query('SELECT GET_LOCK(?,0) AS got_lock', [signal])
    try {
      for (let index = 0; index < 100; index++) {
        if ((await controller!.query('SELECT IS_USED_LOCK(?) AS owner', [pause]))[0]?.owner == null) return
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error('Concurrent trigger did not resume after continue.')
    } finally { await controller!.query('SELECT RELEASE_LOCK(?) AS released', [signal]) }
  }
})
