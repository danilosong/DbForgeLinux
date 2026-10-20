import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { DEBUG_SCHEMA, engineDdl, instrumentProcedure, quoteDebugIdentifier } from '../../src/modules/routine-debugger/index.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('routine debugger MySQL integration', () => {
  const driver = new MysqlDriver()
  const procedure = `routine_debug_${process.pid}`
  const debugId = randomUUID()
  let connectionId = ''
  let controller: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let executor: Awaited<ReturnType<MysqlDriver['openDedicatedSession']>> | undefined
  let callTask: Promise<void> | undefined
  const schema = (name: string): string => `${quoteDebugIdentifier(DEBUG_SCHEMA)}.${quoteDebugIdentifier(name)}`

  afterAll(async () => {
    if (controller) {
      try { await controller.execute(`UPDATE ${schema('debug_sessions')} SET status='stopped' WHERE debug_id=?`, [debugId]) } catch { /* engine may not have been created */ }
    }
    try { await callTask } catch { /* expected if cleanup stopped execution */ }
    if (executor) {
      try { await executor.execute(`USE sample`); await executor.execute(`DROP PROCEDURE IF EXISTS ${quoteDebugIdentifier('sample')}.${quoteDebugIdentifier(procedure)}`); await executor.execute('DROP TABLE IF EXISTS debug_values') } catch { /* disposable test server cleanup */ }
      await executor.close()
    }
    if (controller) { await controller.close() }
    if (connectionId) {
      try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS ${quoteDebugIdentifier(DEBUG_SCHEMA)}`) } catch { /* disposable test server cleanup */ }
      await driver.disconnect(connectionId)
    }
  })

  it('deploys the helper, pauses in a dedicated target session, steps, and restores the original DDL', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection('routine-debug-test', 'Routine debugger integration'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only'
    })
    controller = await driver.openDedicatedSession(connectionId)
    executor = await driver.openDedicatedSession(connectionId)
    for (const sql of engineDdl()) await controller.execute(sql)
    await executor.execute('USE sample')
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
    const instrumented = instrumentProcedure(original)
    await controller.execute(`USE ${quoteDebugIdentifier(DEBUG_SCHEMA)}`)
    await controller.execute(`INSERT INTO ${schema('debug_sessions')}(debug_id,connection_id,database_name,routine_name,status,step_kind) VALUES (?,?,?,?,'running','into')`, [debugId, connectionId, 'sample', procedure])
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
  }, 30000)

  async function command(kind: 'into' | 'continue'): Promise<void> {
    const lock = `dfl-debug-${debugId}`
    await controller!.query('SELECT GET_LOCK(?,5) AS got_lock', [lock])
    await controller!.execute(`UPDATE ${schema('debug_sessions')} SET status='running',step_kind=? WHERE debug_id=?`, [kind, debugId])
    await controller!.query('SELECT RELEASE_LOCK(?) AS released', [lock])
  }
  async function waitForStatus(status: string): Promise<Record<string, unknown>> {
    for (let index = 0; index < 200; index++) {
      const rows = await controller!.query(`SELECT status,current_line,variables_json FROM ${schema('debug_sessions')} WHERE debug_id=?`, [debugId])
      if (String(rows[0]?.status) === status) return rows[0]!
      if (callTask) { const outcome = await Promise.race([callTask.then(() => 'finished', () => 'failed'), new Promise<'wait'>(resolve => setTimeout(() => resolve('wait'), 20))]); if (outcome !== 'wait') throw new Error(`Target finished before debugger reached ${status}.`) }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for debugger status ${status}.`)
  }
  async function waitForLine(line: number): Promise<Record<string, unknown>> {
    for (let index = 0; index < 200; index++) {
      const rows = await controller!.query(`SELECT status,current_line,variables_json FROM ${schema('debug_sessions')} WHERE debug_id=?`, [debugId])
      if (Number(rows[0]?.current_line) === line && String(rows[0]?.status) === 'paused') return rows[0]!
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for debugger line ${line}.`)
  }
  function parseJson(value: unknown): Record<string, unknown> { return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value as Record<string, unknown> }
})
