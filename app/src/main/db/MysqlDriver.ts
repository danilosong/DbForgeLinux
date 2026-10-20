import mysql, { type Pool, type PoolConnection, type QueryResult as MysqlQueryResult, type RowDataPacket } from 'mysql2/promise'
import type { ConnectionConfig, QueryResult } from '../../shared/contracts.js'
import type { DbDriver } from './DbDriver.js'

export class MysqlDriver implements DbDriver {
  private readonly pools = new Map<string, Pool>()

  async testConnection(config: ConnectionConfig): Promise<{ serverVersion: string }> {
    const connection = await mysql.createConnection({ ...config, connectTimeout: 5000 })
    try {
      const [rows] = await connection.query<Array<RowDataPacket & { version: string }>>('SELECT VERSION() AS version')
      return { serverVersion: rows[0]?.version ?? 'unknown' }
    } finally {
      await connection.end()
    }
  }

  async connect(config: ConnectionConfig): Promise<string> {
    const pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      multipleStatements: true,
      namedPlaceholders: false
    })
    const connection = await pool.getConnection()
    connection.release()
    const id = crypto.randomUUID()
    this.pools.set(id, pool)
    return id
  }

  async disconnect(connectionId: string): Promise<void> {
    const pool = this.requirePool(connectionId)
    this.pools.delete(connectionId)
    await pool.end()
  }

  async listDatabases(connectionId: string): Promise<string[]> {
    const [rows] = await this.requirePool(connectionId).query<Array<RowDataPacket & { Database: string }>>('SHOW DATABASES')
    return rows.map((row) => row.Database)
  }

  async listTables(connectionId: string, database: string): Promise<string[]> {
    const pool = this.requirePool(connectionId)
    const [rows] = await pool.query<Array<RowDataPacket & { tableName: string }>>(
      'SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [database]
    )
    return rows.map((row) => row.tableName)
  }

  async executeSql(connectionId: string, sql: string): Promise<QueryResult[]> {
    const [raw] = await this.requirePool(connectionId).query({ sql, rowsAsArray: false })
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

  private requirePool(connectionId: string): Pool {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error('Connection not found')
    return pool
  }
}

export type MysqlConnection = PoolConnection
