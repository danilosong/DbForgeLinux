export const DEBUG_SCHEMA = 'dbforge_linux_debug'
export const DEBUG_ENGINE_VERSION = '1'

export function quoteDebugIdentifier(value: string): string {
  if (!value.trim() || value.includes('\0')) throw new Error('Invalid MySQL identifier.')
  return `\`${value.replaceAll('`', '``')}\``
}

export function engineDdl(): string[] {
  const schema = quoteDebugIdentifier(DEBUG_SCHEMA)
  return [
    `CREATE DATABASE IF NOT EXISTS ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS ${schema}.engine_info (engine_key VARCHAR(40) PRIMARY KEY, engine_version VARCHAR(20) NOT NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.debug_sessions (debug_id CHAR(36) PRIMARY KEY, connection_id VARCHAR(100) NOT NULL, database_name VARCHAR(64) NOT NULL, routine_name VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, step_kind VARCHAR(30) NOT NULL DEFAULT 'into', run_to_line INT NULL, current_line INT NULL, variables_json JSON NULL, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(status)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.breakpoints (debug_id CHAR(36) NOT NULL, line_number INT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, PRIMARY KEY(debug_id,line_number)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.watches (debug_id CHAR(36) NOT NULL, watch_name VARCHAR(128) NOT NULL, PRIMARY KEY(debug_id,watch_name)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS ${schema}.routine_sources (database_name VARCHAR(64) NOT NULL, routine_name VARCHAR(64) NOT NULL, original_sql MEDIUMTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(database_name,routine_name)) ENGINE=InnoDB`,
    `INSERT INTO ${schema}.engine_info(engine_key,engine_version) VALUES ('engine','${DEBUG_ENGINE_VERSION}') ON DUPLICATE KEY UPDATE engine_version=VALUES(engine_version)`,
    `DROP PROCEDURE IF EXISTS ${schema}.checkpoint`,
    `CREATE PROCEDURE ${schema}.checkpoint(IN p_debug_id CHAR(36), IN p_line INT, IN p_variables JSON)
      checkpoint_block: BEGIN
        DECLARE v_status VARCHAR(20);
        DECLARE v_mode VARCHAR(30);
        DECLARE v_run_to INT;
        DECLARE v_breakpoint INT DEFAULT 0;
        DECLARE v_pause BOOLEAN DEFAULT FALSE;
        DECLARE v_lock INT;
        SET v_lock=GET_LOCK(CONCAT('dfl-debug-',p_debug_id),5);
        IF v_lock IS NULL OR v_lock=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Could not synchronize routine debugger'; END IF;
        UPDATE ${schema}.debug_sessions SET current_line=p_line, variables_json=p_variables WHERE debug_id=p_debug_id;
        SELECT status,step_kind,run_to_line INTO v_status,v_mode,v_run_to FROM ${schema}.debug_sessions WHERE debug_id=p_debug_id;
        IF v_status IS NULL OR v_status='stopped' THEN DO RELEASE_LOCK(CONCAT('dfl-debug-',p_debug_id)); SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Routine debugging stopped'; END IF;
        SELECT COUNT(*) INTO v_breakpoint FROM ${schema}.breakpoints WHERE debug_id=p_debug_id AND line_number=p_line AND enabled=TRUE;
        SET v_pause=(v_mode IN ('into','over') OR (v_mode='run-to-cursor' AND p_line>=COALESCE(v_run_to,2147483647)) OR (v_mode IN ('continue','out') AND v_breakpoint>0));
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
      END`
  ]
}
