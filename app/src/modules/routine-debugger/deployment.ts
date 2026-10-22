import type { DedicatedMysqlSession } from '../../main/db/MysqlDriver.js'
import { DEBUG_SCHEMA, engineDdl, quoteDebugIdentifier } from './engine.js'

export interface DebugEngineDeploymentDriver {
  queryRows(connectionId: string, sql: string, values?: readonly unknown[]): Promise<Array<Record<string, unknown>>>
  openDedicatedSession(connectionId: string): Promise<DedicatedMysqlSession>
}

const table = (schema: string, name: string): string => `${quoteDebugIdentifier(schema)}.${quoteDebugIdentifier(name)}`

/** Applies an idempotent engine migration and refuses to replace helpers during live sessions. */
export async function deployDebugEngine(driver: DebugEngineDeploymentDriver, connectionId: string, schemaName = DEBUG_SCHEMA): Promise<void> {
  if (!connectionId) throw new Error('Choose an active database connection.')
  const schemas = await driver.queryRows(connectionId, 'SELECT schema_name FROM information_schema.schemata WHERE schema_name=?', [schemaName])
  if (schemas.length) {
    const tables = await driver.queryRows(connectionId, 'SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name IN (?,?)', [schemaName, 'engine_info', 'debug_sessions'])
    if (tables.some((row) => String(row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0]) === 'debug_sessions')) {
      const active = await driver.queryRows(connectionId, `SELECT debug_id FROM ${table(schemaName, 'debug_sessions')} WHERE status IN ('preparing','running','paused')`)
      if (active.length) throw new Error(`Debug engine deployment is blocked while ${active.length} debug session(s) are active.`)
    }
  }

  const connection = await driver.openDedicatedSession(connectionId)
  try {
    const statements = engineDdl(schemaName)
    for (const sql of statements.slice(0, -1)) await connection.execute(sql)
    const commandVersion = await connection.query('SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [schemaName, 'debug_sessions', 'command_version'])
    if (Number(commandVersion[0]?.total) === 0) await connection.execute(`ALTER TABLE ${table(schemaName, 'debug_sessions')} ADD COLUMN command_version INT NOT NULL DEFAULT 0`)
    const versionStatement = statements.at(-1)
    if (versionStatement) await connection.execute(versionStatement)
  } finally { await connection.close() }
}
