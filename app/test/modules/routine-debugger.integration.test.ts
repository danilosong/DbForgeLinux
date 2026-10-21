import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { engineDdl, instrumentProcedure, instrumentTrigger, quoteDebugIdentifier } from '../../src/modules/routine-debugger/index.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('routine debugger MySQL integration', () => {
  const driver = new MysqlDriver()
  const testDatabase = `dbforge_debug_test_${process.pid}_${randomUUID().slice(0, 8)}`
  const procedure = `routine_debug_${process.pid}_${randomUUID().slice(0, 8)}`
  const debugId = randomUUID()
  const triggerDebugId = randomUUID()
  const trigger = `trigger_debug_${process.pid}_${randomUUID().slice(0, 8)}`
  let connectionId = ''
  let controller: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let executor: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let callTask: Promise<void> | undefined
  const schema = (name: string): string => `${quoteDebugIdentifier(testDatabase)}.${quoteDebugIdentifier(name)}`

  afterAll(async () => {
    if (controller) {
      try { await controller.execute(`UPDATE ${schema('debug_sessions')} SET status='stopped' WHERE debug_id IN (?,?)`, [debugId, triggerDebugId]) } catch { /* engine may not have been created */ }
    }
    try { executor?.cancel() } catch { /* release any in-flight trigger pause after test failure */ }
    try { await callTask } catch { /* expected if cleanup stopped execution */ }
    if (executor) {
      try { await executor.execute(`USE ${quoteDebugIdentifier(testDatabase)}`); await executor.execute(`DROP TRIGGER IF EXISTS ${quoteDebugIdentifier(trigger)}`); await executor.execute(`DROP PROCEDURE IF EXISTS ${quoteDebugIdentifier(procedure)}`); await executor.execute('DROP TABLE IF EXISTS audit_log, audit_values, debug_values') } catch { /* disposable test server cleanup */ }
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
      ...createDefaultConnection(`dbforge_test_routine_connection_${process.pid}_${randomUUID().slice(0, 8)}`, 'Routine debugger integration'),
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
    await executor.execute(`SET @dbforge_linux_debug_id='${debugId}'`)
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
    const triggerSource = `CREATE TRIGGER ${quoteDebugIdentifier(trigger)} AFTER INSERT ON audit_values FOR EACH ROW\nBEGIN\n  INSERT INTO audit_log(id) VALUES (NEW.id);\nEND`
    await executor.execute(triggerSource)
    const instrumentedTrigger = instrumentTrigger(triggerSource, testDatabase)
    await controller.execute(`INSERT INTO ${schema('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?,'running','into')`, [triggerDebugId, connectionId, testDatabase, `TRIGGER:${trigger}`])
    await controller.execute(`INSERT INTO ${schema('breakpoints')}(debug_id,line_number,enabled) VALUES (?,?,TRUE)`, [triggerDebugId, instrumentedTrigger.statementLines[0]])
    await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(trigger)}`)
    await executor.execute(instrumentedTrigger.sql)
    await executor.execute(`SET @dbforge_linux_debug_id='${triggerDebugId}'`)
    await executor.execute('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
    callTask = executor.execute('INSERT INTO audit_values VALUES (10)').then(() => undefined)
    await waitForTriggerPause(triggerDebugId, instrumentedTrigger.statementLines[0]!, callTask)
    await command('continue', triggerDebugId)
    const triggerOutcome = await Promise.race([callTask.then(() => 'finished', () => 'failed'), new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 5_000))])
    if (triggerOutcome === 'timeout') {
      const state = await controller.query(`SELECT status,step_kind,command_version FROM ${schema('debug_sessions')} WHERE debug_id=?`, [triggerDebugId])
      throw new Error(`Trigger did not resume after command ${JSON.stringify(state[0])}.`)
    }
    await callTask
    expect(Number((await executor.query('SELECT COUNT(*) AS total FROM audit_log'))[0]?.total)).toBe(1)
    await executor.execute(`DROP TRIGGER ${quoteDebugIdentifier(trigger)}`)
    await executor.execute(triggerSource)
    const restoredTrigger = await executor.query(`SHOW CREATE TRIGGER ${quoteDebugIdentifier(trigger)}`)
    expect(Object.values(restoredTrigger[0] ?? {}).map(String).join('\n')).toContain('INSERT INTO audit_log')
  }, 30000)

  async function command(kind: 'into' | 'continue', sessionId = debugId): Promise<void> {
    if (sessionId === triggerDebugId) {
      const signalName = `dfl-cmd-${sessionId}-${kind === 'continue' ? 'c' : 'i'}`
      await controller!.query('SELECT GET_LOCK(?,0) AS got_lock', [signalName])
      try {
        const points = await controller!.query(`SELECT line_number FROM ${schema('breakpoints')} WHERE debug_id=? LIMIT 1`, [sessionId])
        const pauseLock = `dfl-pause-${sessionId}-${Number(points[0]?.line_number)}`
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
  async function waitForTriggerPause(sessionId: string, line: number, task: Promise<void>): Promise<void> {
    const lockName = `dfl-pause-${sessionId}-${line}`
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
})
