export const DEBUG_SCHEMA = 'tuxsql_linux_debug'
export const DEBUG_ENGINE_VERSION = '3'

export function quoteDebugIdentifier(value: string): string {
  if (!value.trim() || value.includes('\0')) throw new Error('Invalid MySQL identifier.')
  return `\`${value.replaceAll('`', '``')}\``
}

export function engineDdl(database = DEBUG_SCHEMA): string[] {
  const schema = quoteDebugIdentifier(database)
  return [
    `CREATE DATABASE IF NOT EXISTS ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS ${schema}.engine_info (engine_key VARCHAR(40) PRIMARY KEY, engine_version VARCHAR(20) NOT NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.debug_sessions (debug_id CHAR(36) PRIMARY KEY, connection_id VARCHAR(100) NOT NULL, database_name VARCHAR(64) NOT NULL, routine_name VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, step_kind VARCHAR(30) NOT NULL DEFAULT 'into', run_to_line INT NULL, current_line INT NULL, variables_json JSON NULL, command_version INT NOT NULL DEFAULT 0, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(status)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.breakpoints (debug_id CHAR(36) NOT NULL, line_number INT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, PRIMARY KEY(debug_id,line_number)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.watches (debug_id CHAR(36) NOT NULL, watch_name VARCHAR(128) NOT NULL, PRIMARY KEY(debug_id,watch_name)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.routine_sources (database_name VARCHAR(64) NOT NULL, routine_name VARCHAR(64) NOT NULL, original_sql MEDIUMTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(database_name,routine_name)) ENGINE=InnoDB`,
    `DROP PROCEDURE IF EXISTS ${schema}.checkpoint`,
    `CREATE PROCEDURE ${schema}.checkpoint(IN p_debug_id CHAR(36), IN p_line INT, IN p_variables JSON, IN p_routine VARCHAR(128), IN p_depth INT)
      checkpoint_block: BEGIN
        DECLARE v_status VARCHAR(20);
        DECLARE v_mode VARCHAR(30);
        DECLARE v_run_to INT;
        DECLARE v_version INT DEFAULT 0;
        DECLARE v_breakpoint INT DEFAULT 0;
        DECLARE v_pause BOOLEAN DEFAULT FALSE;
        DECLARE v_trigger BOOLEAN DEFAULT FALSE;
        DECLARE v_lock INT;
        SELECT LEFT(routine_name,8)='TRIGGER:' INTO v_trigger FROM ${schema}.debug_sessions WHERE debug_id=p_debug_id;
        IF v_trigger THEN
          SET @tuxsql_linux_debug_current_depth=p_depth;
          SELECT status,step_kind,run_to_line,command_version INTO v_status,v_mode,v_run_to,v_version FROM ${schema}.debug_sessions WHERE debug_id=p_debug_id;
          IF v_status IS NULL OR v_status='stopped' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Trigger debugging stopped'; END IF;
          SET v_mode=IF(v_mode='break-all','break-all',COALESCE(@tuxsql_linux_debug_step_kind,v_mode));
          SET v_run_to=COALESCE(@tuxsql_linux_debug_run_to,v_run_to);
          SELECT COUNT(*) INTO v_breakpoint FROM ${schema}.breakpoints WHERE debug_id=p_debug_id AND line_number=p_line AND enabled=TRUE;
          SET v_pause=(v_mode IN ('into','break-all') OR (v_mode='over' AND p_depth<=COALESCE(@tuxsql_linux_debug_target_depth,p_depth)) OR (v_mode='out' AND p_depth<COALESCE(@tuxsql_linux_debug_target_depth,p_depth)) OR (v_mode='run-to-cursor' AND p_line>=COALESCE(v_run_to,2147483647)) OR (v_mode='continue' AND v_breakpoint>0));
          IF v_pause THEN
            SET v_lock=GET_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line),0);
            IF v_lock IS NULL OR v_lock=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Could not pause trigger debugger'; END IF;
            trigger_pause_loop: LOOP
              DO SLEEP(0.08);
              IF IS_USED_LOCK(CONCAT('dfl-cmd-',p_debug_id,'-c')) IS NOT NULL THEN SET @tuxsql_linux_debug_step_kind='continue'; SET @tuxsql_linux_debug_run_to=NULL; DO RELEASE_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line)); LEAVE trigger_pause_loop; END IF;
              IF IS_USED_LOCK(CONCAT('dfl-cmd-',p_debug_id,'-i')) IS NOT NULL THEN SET @tuxsql_linux_debug_step_kind='into'; SET @tuxsql_linux_debug_run_to=NULL; SET @tuxsql_linux_debug_target_depth=p_depth; DO RELEASE_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line)); LEAVE trigger_pause_loop; END IF;
              IF IS_USED_LOCK(CONCAT('dfl-cmd-',p_debug_id,'-o')) IS NOT NULL THEN SET @tuxsql_linux_debug_step_kind='over'; SET @tuxsql_linux_debug_run_to=NULL; SET @tuxsql_linux_debug_target_depth=p_depth; DO RELEASE_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line)); LEAVE trigger_pause_loop; END IF;
              IF IS_USED_LOCK(CONCAT('dfl-cmd-',p_debug_id,'-u')) IS NOT NULL THEN SET @tuxsql_linux_debug_step_kind='out'; SET @tuxsql_linux_debug_run_to=NULL; SET @tuxsql_linux_debug_target_depth=p_depth; DO RELEASE_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line)); LEAVE trigger_pause_loop; END IF;
              SELECT MIN(line_number) INTO v_run_to FROM ${schema}.breakpoints WHERE debug_id=p_debug_id AND IS_USED_LOCK(CONCAT('dfl-cmd-',p_debug_id,'-r',line_number)) IS NOT NULL;
              IF v_run_to IS NOT NULL THEN SET @tuxsql_linux_debug_step_kind='run-to-cursor'; SET @tuxsql_linux_debug_run_to=v_run_to; DO RELEASE_LOCK(CONCAT('dfl-pause-',p_debug_id,IF(p_depth=0,'-',CONCAT('-',p_depth,'-')),p_line)); LEAVE trigger_pause_loop; END IF;
            END LOOP;
          END IF;
          LEAVE checkpoint_block;
        END IF;
        SET v_lock=GET_LOCK(CONCAT('dfl-debug-',p_debug_id),5);
        IF v_lock IS NULL OR v_lock=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Could not synchronize routine debugger'; END IF;
        UPDATE ${schema}.debug_sessions SET current_line=p_line, variables_json=p_variables WHERE debug_id=p_debug_id;
        SELECT status,step_kind,run_to_line INTO v_status,v_mode,v_run_to FROM ${schema}.debug_sessions WHERE debug_id=p_debug_id;
        IF v_status IS NULL OR v_status='stopped' THEN DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id)); SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Routine debugging stopped'; END IF;
        SELECT COUNT(*) INTO v_breakpoint FROM ${schema}.breakpoints WHERE debug_id=p_debug_id AND line_number=p_line AND enabled=TRUE;
        SET v_pause=(v_mode IN ('into','over','break-all') OR (v_mode='run-to-cursor' AND p_line>=COALESCE(v_run_to,2147483647)) OR (v_mode IN ('continue','out') AND v_breakpoint>0));
        IF v_pause THEN
          UPDATE ${schema}.debug_sessions SET status='paused' WHERE debug_id=p_debug_id;
          DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id));
          pause_loop: LOOP
            DO SLEEP(0.08);
            SET v_lock=GET_LOCK(CONCAT('dfl-debug-',p_debug_id),5);
            IF v_lock IS NULL OR v_lock=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Routine debugger synchronization failed'; END IF;
            SELECT status INTO v_status FROM ${schema}.debug_sessions WHERE debug_id=p_debug_id;
            IF v_status='stopped' THEN DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id)); SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Routine debugging stopped'; END IF;
            IF v_status<>'paused' THEN DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id)); LEAVE pause_loop; END IF;
            DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id));
          END LOOP;
        ELSE
          UPDATE ${schema}.debug_sessions SET status='running' WHERE debug_id=p_debug_id;
          DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id));
        END IF;
      END`,
    `INSERT INTO ${schema}.engine_info(engine_key,engine_version) VALUES ('engine','${DEBUG_ENGINE_VERSION}') ON DUPLICATE KEY UPDATE engine_version=VALUES(engine_version)`
  ]
}
