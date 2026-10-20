import mysql, { type Pool, type PoolConnection, type QueryResult as MysqlQueryResult, type RowDataPacket } from 'mysql2/promise'
import type { ConnectionTestResult, DatabaseObject, QueryResult } from '../../shared/contracts.js'
import type { DbDriver, DbTransaction, DriverConnectionConfig, SqlValue } from './DbDriver.js'
import { buildMysqlOptions } from './connectionOptions.js'
import { createSshTunnel, type ActiveSshTunnel } from './SshTunnel.js'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

interface ManagedConnection {
  pool: Pool
  tunnel?: ActiveSshTunnel
  config: DriverConnectionConfig
  currentDatabase?: string
  transactionConnection?: PoolConnection
}

export class MysqlDriver implements DbDriver {
  private readonly pools = new Map<string, ManagedConnection>()
  private readonly executions = new Map<string, { connectionId: string; threadId: number }>()

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
      this.pools.set(id, { pool, tunnel, config, currentDatabase: config.database })
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
    if (managed.transactionConnection) { try { await managed.transactionConnection.rollback() } finally { managed.transactionConnection.release() } }
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

  async executeSql(connectionId: string, sql: string, executionId?: string): Promise<QueryResult[]> {
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly && /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(sql)) {
      throw new Error('A sessão está marcada como somente leitura.')
    }
    const timeout = managed.config.advanced.commandTimeoutSeconds
    const transactionConnection = managed.transactionConnection
    const connection = transactionConnection ?? await managed.pool.getConnection()
    const ownsConnection = !transactionConnection
    const activeExecutionId = executionId ?? crypto.randomUUID()
    let raw: MysqlQueryResult | RowDataPacket[]
    this.executions.set(activeExecutionId, { connectionId, threadId: connection.threadId })
    try {
      if (typeof connection.query === 'function') {
        if (managed.currentDatabase) await connection.query(`USE ${quoteIdentifier(managed.currentDatabase)}`)
        ;[raw] = await connection.query({ sql, rowsAsArray: false, ...(timeout > 0 ? { timeout: timeout * 1000 } : {}) })
      } else {
        ;[raw] = await managed.pool.query({ sql, rowsAsArray: false, ...(timeout > 0 ? { timeout: timeout * 1000 } : {}) })
      }
    } finally { this.executions.delete(activeExecutionId); if (ownsConnection) connection.release() }
    const results = Array.isArray(raw) && splitSqlStatements(sql).length > 1 ? raw : [raw]
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

  async cancelQuery(connectionId: string, executionId: string): Promise<void> {
    const active = this.executions.get(executionId)
    if (!active || active.connectionId !== connectionId) return
    await this.requireConnection(connectionId).pool.query(`KILL QUERY ${active.threadId}`)
  }

  async listDatabaseObjects(connectionId: string, database: string): Promise<DatabaseObject[]> {
    const pool = this.requireConnection(connectionId).pool
    const [tables] = await pool.query<Array<RowDataPacket & { name: string; kind: string }>>(
      'SELECT table_name AS name, table_type AS kind FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', [database])
    const [routines] = await pool.query<Array<RowDataPacket & { name: string; kind: string }>>(
      "SELECT routine_name AS name, routine_type AS kind FROM information_schema.routines WHERE routine_schema = ? ORDER BY routine_name", [database])
    const [triggers] = await pool.query<Array<RowDataPacket & { name: string }>>(
      'SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = ? ORDER BY trigger_name', [database])
    const [events] = await pool.query<Array<RowDataPacket & { name: string }>>(
      'SELECT event_name AS name FROM information_schema.events WHERE event_schema = ? ORDER BY event_name', [database])
    return [
      ...tables.map(({ name, kind }) => ({ name, kind: kind === 'VIEW' ? 'view' as const : 'table' as const })),
      ...routines.map(({ name, kind }) => ({ name, kind: kind === 'FUNCTION' ? 'function' as const : 'procedure' as const })),
      ...triggers.map(({ name }) => ({ name, kind: 'trigger' as const })),
      ...events.map(({ name }) => ({ name, kind: 'event' as const }))
    ]
  }

  async showCreateObject(connectionId: string, database: string, object: DatabaseObject): Promise<string> {
    const type = object.kind === 'table' ? 'TABLE' : object.kind === 'view' ? 'VIEW' : object.kind === 'procedure' ? 'PROCEDURE' : object.kind === 'function' ? 'FUNCTION' : object.kind === 'trigger' ? 'TRIGGER' : 'EVENT'
    const name = object.kind === 'procedure' || object.kind === 'function' || object.kind === 'trigger' || object.kind === 'event'
      ? `${quoteIdentifier(database)}.${quoteIdentifier(object.name)}` : `${quoteIdentifier(database)}.${quoteIdentifier(object.name)}`
    const [rows] = await this.requireConnection(connectionId).pool.query<Array<RowDataPacket & Record<string, string>>>(`SHOW CREATE ${type} ${name}`)
    const row = rows[0]
    const createSql = row && Object.entries(row).find(([key, value]) => /^Create /.test(key) && typeof value === 'string')?.[1]
    if (!createSql) throw new Error(`Não foi possível obter o DDL de ${object.name}.`)
    return createSql
  }

  async setDatabase(connectionId: string, database: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    const [rows] = await managed.pool.query<Array<RowDataPacket & { Database: string }>>('SHOW DATABASES')
    if (!rows.some((row) => row.Database === database)) throw new Error('Database não encontrada nesta conexão.')
    managed.currentDatabase = database
  }

  async beginTransaction(connectionId: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly) throw new Error('A sessão está marcada como somente leitura.')
    if (managed.transactionConnection) throw new Error('Já existe uma transação manual ativa.')
    const connection = await managed.pool.getConnection()
    try {
      if (managed.currentDatabase) await connection.query(`USE ${quoteIdentifier(managed.currentDatabase)}`)
      await connection.beginTransaction()
      managed.transactionConnection = connection
    } catch (error) { connection.release(); throw error }
  }

  async commitTransaction(connectionId: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    const connection = managed.transactionConnection
    if (!connection) throw new Error('Não há transação manual ativa.')
    managed.transactionConnection = undefined
    try { await connection.commit() } finally { connection.release() }
  }

  async rollbackTransaction(connectionId: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    const connection = managed.transactionConnection
    if (!connection) throw new Error('Não há transação manual ativa.')
    managed.transactionConnection = undefined
    try { await connection.rollback() } finally { connection.release() }
  }

  async queryRows(connectionId: string, sql: string, parameters: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const [rows] = await this.requireConnection(connectionId).pool.query<Array<RowDataPacket & Record<string, unknown>>>(sql, parameters)
    return rows
  }

  async *streamRows(connectionId: string, sql: string, values: readonly SqlValue[] = [], signal?: AbortSignal): AsyncIterable<Record<string, unknown>> {
    const pool = this.requireConnection(connectionId).pool
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const rawPool = pool.pool as unknown as { query(options: unknown): { stream(): NodeJS.ReadableStream } }
    const stream = rawPool.query({ sql, values: [...values], rowsAsArray: false }).stream() as NodeJS.ReadableStream & AsyncIterable<Record<string, unknown>> & { destroy(error?: Error): void }
    const abort = (): void => stream.destroy(new DOMException('A operação foi cancelada.', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    try {
      for await (const row of stream) {
        if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
        yield row
      }
    } finally {
      signal?.removeEventListener('abort', abort)
      if (signal?.aborted) stream.destroy()
    }
  }

  async withTransaction<T>(connectionId: string, operation: (transaction: DbTransaction) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly) throw new Error('A sessão está marcada como somente leitura.')
    const connection = await managed.pool.getConnection()
    try {
      await connection.beginTransaction()
      const transaction: DbTransaction = {
        execute: async (sql, values = []) => {
          if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
          const [result] = await connection.execute(sql, [...values])
          const header = result as unknown as { affectedRows?: number; insertId?: number }
          return { affectedRows: header.affectedRows ?? 0, insertId: header.insertId ?? 0 }
        }
      }
      const result = await operation(transaction)
      if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async executeParameterized(connectionId: string, sql: string, values: readonly SqlValue[] = [], signal?: AbortSignal): Promise<{ affectedRows: number; insertId: number }> {
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly) throw new Error('A sessão está marcada como somente leitura.')
    const [result] = await managed.pool.execute(sql, [...values])
    const header = result as unknown as { affectedRows?: number; insertId?: number }
    return { affectedRows: header.affectedRows ?? 0, insertId: header.insertId ?? 0 }
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

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``
}
