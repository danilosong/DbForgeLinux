import { describe, expect, it } from 'vitest'
import { buildDebugCallPlan, DEBUG_SCHEMA, engineDdl, evaluateWatchExpression, instrumentProcedure, instrumentTrigger, parseDebugRoutineParameters, quoteDebugIdentifier } from '../../src/modules/routine-debugger/index.js'

describe('routine debugger instrumenter', () => {
  it('pauses at the next checkpoint when Break All is requested', () => {
    expect(engineDdl().join('\n')).toContain("v_mode IN ('into','over','break-all')")
  })
  it('evaluates arithmetic watch expressions with operator precedence and rejects code', () => {
    expect(evaluateWatchExpression('a + b * 2', { a: 3, b: 4 })).toMatchObject({ value: 11, type: 'number' })
    expect(evaluateWatchExpression('(a + b) * 2', { a: 3, b: 4 }).value).toBe(14)
    expect(evaluateWatchExpression('a.secret()', { a: 3 }).error).toBeTruthy()
    expect(evaluateWatchExpression('missing + 1', {}).error).toContain('not in scope')
    expect(evaluateWatchExpression('a >= 5 AND ROUND(b / 3, 1) = 2.7', { a: 5, b: 8.1 }).value).toBe(true)
    expect(evaluateWatchExpression('LOWER(label) = 1', { label: 'READY' }).value).toBe(false)
    expect(evaluateWatchExpression('SLEEP(1)', {}).error).toContain('not allowed')
  })
  it('builds safe CALL arguments for OUT and INOUT parameters and keeps values bound', () => {
    const plan = buildDebugCallPlan('sample-db', 'routine', [
      { name: 'input', type: 'VARCHAR(30)', direction: 'IN', value: "O'Reilly" },
      { name: 'output', type: 'INT UNSIGNED', direction: 'OUT', value: null },
      { name: 'both', type: 'DECIMAL(10,2)', direction: 'INOUT', value: '1.25' }
    ])
    expect(plan.sql).toBe('CALL `sample-db`.`routine`(?,@tuxsql_debug_out_1,@tuxsql_debug_out_2)')
    expect(plan.values).toEqual(["O'Reilly"])
    expect(plan.setup).toEqual([{ sql: 'SET @tuxsql_debug_out_1=NULL', values: [] }, { sql: 'SET @tuxsql_debug_out_2=?', values: ['1.25'] }])
    expect(plan.outputParameters.map(({ name, type }) => [name, type])).toEqual([['output', 'INT UNSIGNED'], ['both', 'DECIMAL(10,2)']])
    expect(plan.sql).not.toContain("O'Reilly")
  })
  it('places checkpoints before executable statements and captures declared locals', () => {
    const source = `CREATE PROCEDURE calc(IN input_value INT)
BEGIN
  DECLARE total INT DEFAULT 0;
  SET total = input_value;
  SELECT total;
END`
    const result = instrumentProcedure(source)
    expect(result.statementLines).toEqual([4, 5])
    expect(result.variables).toEqual(['total'])
    expect(result.sql).toContain('checkpoint(@tuxsql_linux_debug_id, 4, JSON_OBJECT(\'total\', `total`))')
    expect(result.sql).toContain('checkpoint(@tuxsql_linux_debug_id, 5, JSON_OBJECT(\'total\', `total`))')
    expect(result.sql).toContain('DECLARE total INT DEFAULT 0;')
  })

  it('keeps control-flow blocks intact and instruments after the block', () => {
    const source = `CREATE PROCEDURE choose_value()
BEGIN
  DECLARE answer INT DEFAULT 0;
  IF answer = 0 THEN
    SET answer = 1;
  ELSE
    SET answer = 2;
  END IF;
  SELECT answer;
END`
    const result = instrumentProcedure(source)
    expect(result.statementLines).toEqual([4, 9])
    expect(result.sql.match(/\.checkpoint\(/g)).toHaveLength(2)
  })

  it('rejects non-procedures and dynamic SQL with a useful limit', () => {
    expect(() => instrumentProcedure('CREATE FUNCTION f() RETURNS INT RETURN 1')).toThrow(/only stored procedures/i)
    expect(() => instrumentProcedure('CREATE PROCEDURE p() BEGIN PREPARE q FROM \'SELECT 1\'; END')).toThrow(/dynamic/i)
  })

  it('instruments a trigger and preserves trigger timing, event, and body', () => {
    const source = `CREATE TRIGGER audit_insert AFTER INSERT ON audit_rows FOR EACH ROW\nBEGIN\n  INSERT INTO audit_log(id) VALUES (NEW.id);\nEND`
    const result = instrumentTrigger(source, 'debug_test')
    expect(result.statementLines).toEqual([3])
    expect(result.sql).toContain('AFTER INSERT ON audit_rows FOR EACH ROW')
    expect(result.sql).toContain('`debug_test`.checkpoint(@tuxsql_linux_debug_id, 3, JSON_OBJECT())')
    expect(result.sql).toContain('INSERT INTO audit_log(id) VALUES (NEW.id);')
    expect(() => instrumentTrigger('CREATE PROCEDURE p() BEGIN SELECT 1; END')).toThrow(/only stored triggers/i)
  })
})

describe('debug engine schema helpers', () => {
  it('uses the project-owned auxiliary schema and persists sources for recovery', () => {
    expect(DEBUG_SCHEMA).toBe('tuxsql_linux_debug')
    expect(engineDdl().some((sql) => sql.includes('routine_sources') && sql.includes('original_sql'))).toBe(true)
    expect(engineDdl().some((sql) => sql.includes('GET_LOCK'))).toBe(true)
    expect(engineDdl('tuxsql_linux_debug_test').join('\n')).toContain('CREATE DATABASE IF NOT EXISTS `tuxsql_linux_debug_test`')
    expect(engineDdl().join('\n')).not.toMatch(/watch_value\s+VARCHAR\s*\(\s*\d{5,}/i)
    expect(quoteDebugIdentifier('db`name')).toBe('`db``name`')
  })

  it('parses named procedure parameters and keeps commas inside types together', () => {
    expect(parseDebugRoutineParameters("CREATE PROCEDURE `p`(IN p_count DECIMAL(10, 2), OUT `p_label` VARCHAR(64), INOUT p_ready BOOLEAN) BEGIN SELECT 1; END"))
      .toEqual([
        { name: 'p_count', type: 'DECIMAL(10, 2)', direction: 'IN', value: '', nullValue: false },
        { name: 'p_label', type: 'VARCHAR(64)', direction: 'OUT', value: '', nullValue: false },
        { name: 'p_ready', type: 'BOOLEAN', direction: 'INOUT', value: '', nullValue: false }
      ])
  })

  it('preserves unsigned integer modifiers in Edit Parameters metadata', () => {
    expect(parseDebugRoutineParameters('CREATE PROCEDURE `p`(IN p_id INT UNSIGNED) BEGIN SELECT p_id; END')[0]?.type).toBe('INT UNSIGNED')
  })
})
