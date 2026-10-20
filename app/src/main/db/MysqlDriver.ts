import mysql, { type Pool, type PoolConnection, type QueryResult as MysqlQueryResult, type RowDataPacket } from 'mysql2/promise'
import type { ConnectionTestResult, QueryResult } from '../../shared/contracts.js'
import type { DbDriver, DriverConnectionConfig } from './DbDriver.js'
import { buildMysqlOptions } from './connectionOptions.js'
import { createSshTunnel, type ActiveSshTunnel } from './SshTunnel.js'

interface ManagedConnection {
  pool: Pool
  tunnel?: ActiveSshTunnel
  config: DriverConnectionConfig
}

export class MysqlDriver implements DbDriver {
  private readonly pools = new Map<string, ManagedConnection>()

  async testConnection(config: DriverConnectionConfig): Promise<ConnectionTestResult> {
    const startedAt = Date.now()
    let tunnel: ActiveSshTunnel | undefined
    let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined
    try {
      tunnel = config.ssh.enabled ? await createSshTunnel(config.ssh) : undefined
      const options = await buildMysqlOptions(config, tunnel)
      connection = await mysql.createConnection(options)
      const [rows] = await connection.query<Array<RowDataPacket & { version: string }>>('SELECT VERSION() AS version')
      const [tlsRows] = await connection.query<Array<RowDataPacket & { Value: string }>>("SHOW STATUS LIKE 'Ssl_version'")
      return {
        serverVersion: rows[0]?.version ?? 'unknown',
        elapsedMs: Date.now() - startedAt,
        tlsVersion: tlsRows[0]?.Value || undefined,
        sshTunnel: Boolean(tunnel)
      }
    } finally {
      if (connection) await connection.end()
      if (tunnel) await tunnel.close()
    }
  }

  async connect(config: DriverConnectionConfig): Promise<string> {
    let tunnel: ActiveSshTunnel | undefined
    let pool: Pool | undefined
    try {
      tunnel = config.ssh.enabled ? await createSshTunnel(config.ssh) : undefined
      const options = await buildMysqlOptions(config, tunnel)
      pool = mysql.createPool({
        ...options,
        waitForConnections: true,
        connectionLimit: 5
      })
      const connection = await pool.getConnection()
      try {
        await this.initializeSession(connection, config)
      } finally {
        connection.release()
      }
      const id = crypto.randomUUID()
      this.pools.set(id, { pool, tunnel, config })
      return id
    } catch (error) {
      if (pool) await pool.end()
      if (tunnel) await tunnel.close()
      throw error
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    this.pools.delete(connectionId)
    await managed.pool.end()
    if (managed.tunnel) await managed.tunnel.close()
  }

  async listDatabases(connectionId: string): Promise<string[]> {
    const [rows] = await this.requireConnection(connectionId).pool.query<Array<RowDataPacket & { Database: string }>>('SHOW DATABASES')
    return rows.map((row) => row.Database)
  }

  async listTables(connectionId: string, database: string): Promise<string[]> {
    const pool = this.requireConnection(connectionId).pool
    const [rows] = await pool.query<Array<RowDataPacket & { tableName: string }>>(
      'SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [database]
    )
    return rows.map((row) => row.tableName)
  }

  async executeSql(connectionId: string, sql: string): Promise<QueryResult[]> {
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly && /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(sql)) {
      throw new Error('A sessão está marcada como somente leitura.')
    }
    const timeout = managed.config.advanced.commandTimeoutSeconds
    const [raw] = await managed.pool.query({ sql, rowsAsArray: false, ...(timeout > 0 ? { timeout: timeout * 1000 } : {}) })
    const results = Array.isArray(raw) ? raw : [raw]
    return results.map((result) => {
      if (Array.isArray(result)) {
        const rows = result as Array<Record<string, unknown>>
        return {
          columns: rows[0] ? Object.keys(rows[0]) : [],
          rows,
          affectedRows: 0,
          insertId: 0,
          warningStatus: 0
        }
      }
      const header = result as MysqlQueryResult
      const packet = header as unknown as { affectedRows?: number; insertId?: number; warningStatus?: number }
      return {
        columns: [],
        rows: [],
        affectedRows: packet.affectedRows ?? 0,
        insertId: packet.insertId ?? 0,
        warningStatus: packet.warningStatus ?? 0
      }
    })
  }

  private async initializeSession(connection: PoolConnection, config: DriverConnectionConfig): Promise<void> {
    if (config.advanced.readOnly) await connection.query('SET SESSION TRANSACTION READ ONLY')
    if (config.advanced.sqlMode) await connection.query('SET SESSION sql_mode = ?', [config.advanced.sqlMode])
    if (config.advanced.collation) {
      if (!/^[a-zA-Z0-9_]+$/.test(config.advanced.collation)) throw new Error('Collation inválida.')
      await connection.query(`SET collation_connection = '${config.advanced.collation}'`)
    }
    for (const command of config.advanced.initCommands.split(';').map((item) => item.trim()).filter(Boolean)) {
      await connection.query(command)
    }
  }

  private requireConnection(connectionId: string): ManagedConnection {
    const connection = this.pools.get(connectionId)
    if (!connection) throw new Error('Connection not found')
    return connection
  }
}

export type MysqlConnection = PoolConnection
