import { describe, expect, it } from 'vitest'
import { DEBUG_SCHEMA, engineDdl, instrumentProcedure, quoteDebugIdentifier } from '../../src/modules/routine-debugger/index.js'

describe('routine debugger instrumenter', () => {
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
    expect(result.sql).toContain('checkpoint(@dbforge_linux_debug_id, 4, JSON_OBJECT(\'total\', `total`))')
    expect(result.sql).toContain('checkpoint(@dbforge_linux_debug_id, 5, JSON_OBJECT(\'total\', `total`))')
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
})

describe('debug engine schema helpers', () => {
  it('uses the project-owned auxiliary schema and persists sources for recovery', () => {
    expect(DEBUG_SCHEMA).toBe('dbforge_linux_debug')
    expect(engineDdl().some((sql) => sql.includes('routine_sources') && sql.includes('original_sql'))).toBe(true)
    expect(engineDdl().some((sql) => sql.includes('GET_LOCK'))).toBe(true)
    expect(engineDdl('dbforge_linux_debug_test').join('\n')).toContain('CREATE DATABASE IF NOT EXISTS `dbforge_linux_debug_test`')
    expect(engineDdl().join('\n')).not.toMatch(/watch_value\s+VARCHAR\s*\(\s*\d{5,}/i)
    expect(quoteDebugIdentifier('db`name')).toBe('`db``name`')
  })
})
