import mysql, { type Pool, type PoolConnection, type QueryResult as MysqlQueryResult, type RowDataPacket } from 'mysql2/promise'
import * as mysqlCore from 'mysql2'
import type { Pool as CorePool, PoolConnection as CorePoolConnection } from 'mysql2'
import type { ConnectionTestResult, DatabaseObject, QueryResult } from '../../shared/contracts.js'
import type { DbDriver, DbTransaction, DriverConnectionConfig, SqlValue } from './DbDriver.js'
import { buildMysqlOptions } from './connectionOptions.js'
import { createSshTunnel, type ActiveSshTunnel } from './SshTunnel.js'
import { createHttpTunnel, type ActiveHttpTunnel } from './HttpTunnel.js'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

interface ManagedConnection {
  pool: Pool
  corePool: CorePool
  tunnel?: ActiveSshTunnel
  httpTunnel?: ActiveHttpTunnel
  config: DriverConnectionConfig
  currentDatabase?: string
  transactionConnection?: PoolConnection
}

export interface DedicatedMysqlSession {
  query(sql: string, values?: readonly SqlValue[]): Promise<Array<Record<string, unknown>>>
  execute(sql: string, values?: readonly SqlValue[]): Promise<void>
  close(): Promise<void>
  cancel(): void
}

function isOptionalTlsUnsupported(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'HANDSHAKE_NO_SSL_SUPPORT'
}

function withoutPreferredTls(config: DriverConnectionConfig): DriverConnectionConfig {
  return { ...config, ssl: { ...config.ssl, mode: 'disabled' } }
}

function getCoreConnection(pool: CorePool): Promise<CorePoolConnection> {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => error ? reject(error) : resolve(connection))
  })
}

function runCoreQuery(connection: CorePoolConnection, sql: string, values: readonly unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.query(sql, [...values], (error) => error ? reject(error) : resolve())
  })
}

export class MysqlDriver implements DbDriver {
  private readonly pools = new Map<string, ManagedConnection>()
  private readonly executions = new Map<string, { connectionId: string; threadId: number }>()

  hasActiveWork(): boolean {
    return this.executions.size > 0 || [...this.pools.values()].some((connection) => Boolean(connection.transactionConnection))
  }

  async testConnection(config: DriverConnectionConfig): Promise<ConnectionTestResult> {
    const startedAt = Date.now()
    let tunnel: ActiveSshTunnel | undefined
    let httpTunnel: ActiveHttpTunnel | undefined
    let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined
    try {
      tunnel = config.ssh.enabled ? await createSshTunnel(config.ssh) : undefined
      httpTunnel = config.http.enabled ? await createHttpTunnel(config.http, config.host, config.port) : undefined
      let options = await buildMysqlOptions(config, tunnel ?? httpTunnel)
      try {
        connection = await mysql.createConnection(options)
      } catch (error) {
        if (config.ssl.mode !== 'preferred' || !isOptionalTlsUnsupported(error)) throw error
        options = await buildMysqlOptions(withoutPreferredTls(config), tunnel ?? httpTunnel)
        connection = await mysql.createConnection(options)
      }
      const [rows] = await connection.query<Array<RowDataPacket & { version: string }>>('SELECT VERSION() AS version')
      const [databaseRows] = await connection.query<Array<RowDataPacket & { Database: string }>>('SHOW DATABASES')
      const [tlsRows] = await connection.query<Array<RowDataPacket & { Value: string }>>("SHOW STATUS LIKE 'Ssl_version'")
      return {
        serverVersion: rows[0]?.version ?? 'unknown',
        elapsedMs: Date.now() - startedAt,
        tlsVersion: tlsRows[0]?.Value || undefined,
        sshTunnel: Boolean(tunnel),
        httpTunnel: Boolean(httpTunnel),
        databases: databaseRows.map((row) => row.Database).filter((name) => config.showAllDatabases || !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(name))
      }
    } finally {
      if (connection) await connection.end()
      if (tunnel) await tunnel.close()
      if (httpTunnel) await httpTunnel.close()
    }
  }

  async connect(config: DriverConnectionConfig): Promise<string> {
    let tunnel: ActiveSshTunnel | undefined
    let httpTunnel: ActiveHttpTunnel | undefined
    let pool: Pool | undefined
    let corePool: CorePool | undefined
    try {
      tunnel = config.ssh.enabled ? await createSshTunnel(config.ssh) : undefined
      httpTunnel = config.http.enabled ? await createHttpTunnel(config.http, config.host, config.port) : undefined
      let options = await buildMysqlOptions(config, tunnel ?? httpTunnel)
      const createPool = (): { core: CorePool; promise: Pool } => {
        const core = mysqlCore.createPool({
          ...options,
          waitForConnections: true,
          connectionLimit: 5
        })
        return { core, promise: core.promise() }
      }
      let pools = createPool()
      corePool = pools.core
      pool = pools.promise
      let connection: PoolConnection
      try {
        connection = await pool.getConnection()
      } catch (error) {
        if (config.ssl.mode !== 'preferred' || !isOptionalTlsUnsupported(error)) throw error
        await pool.end()
        options = await buildMysqlOptions(withoutPreferredTls(config), tunnel ?? httpTunnel)
        pools = createPool()
        corePool = pools.core
        pool = pools.promise
        connection = await pool.getConnection()
      }
      try {
        await this.initializeSession(connection, config)
      } finally {
        connection.release()
      }
      const id = crypto.randomUUID()
      this.pools.set(id, { pool, corePool, tunnel, httpTunnel, config, currentDatabase: config.database })
      return id
    } catch (error) {
      if (pool) await pool.end()
      if (tunnel) await tunnel.close()
      if (httpTunnel) await httpTunnel.close()
      throw error
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const managed = this.requireConnection(connectionId)
    this.pools.delete(connectionId)
    if (managed.transactionConnection) { try { await managed.transactionConnection.rollback() } finally { managed.transactionConnection.release() } }
    await managed.pool.end()
    if (managed.tunnel) await managed.tunnel.close()
    if (managed.httpTunnel) await managed.httpTunnel.close()
  }

  /** Opens one pinned server session for protocols that depend on connection-scoped locks or variables. */
  async openDedicatedSession(connectionId: string): Promise<DedicatedMysqlSession> {
    const managed = this.requireConnection(connectionId)
    const connection = await managed.pool.getConnection()
    let closed = false
    try {
      await this.initializeSession(connection, managed.config)
      if (managed.currentDatabase) await connection.query(`USE ${quoteIdentifier(managed.currentDatabase)}`)
    } catch (error) { connection.release(); throw error }
    return {
      query: async (sql, values = []) => {
        if (closed) throw new Error('Dedicated MySQL session is closed.')
        const [rows] = await connection.query({ sql, values: [...values], rowsAsArray: false })
        return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : []
      },
      execute: async (sql, values = []) => {
        if (closed) throw new Error('Dedicated MySQL session is closed.')
        await connection.query({ sql, values: [...values] })
      },
      close: async () => {
        if (closed) return
        closed = true
        connection.release()
      },
      cancel: () => {
        if (closed) return
        closed = true
        connection.destroy()
      }
    }
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

  async *streamRows(connectionId: string, sql: string, values: readonly SqlValue[] = [], signal?: AbortSignal, timeoutSeconds?: number, executionId?: string): AsyncIterable<Record<string, unknown>> {
    const managed = this.requireConnection(connectionId)
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const commandTimeout = timeoutSeconds ?? managed.config.advanced.commandTimeoutSeconds
    const transactionConnection = managed.transactionConnection
    const connection = transactionConnection
      ? transactionConnection.connection as unknown as CorePoolConnection
      : await getCoreConnection(managed.corePool)
    const ownsConnection = !transactionConnection
    if (signal?.aborted) {
      if (ownsConnection) connection.release()
      throw new DOMException('A operação foi cancelada.', 'AbortError')
    }
    const activeExecutionId = executionId ?? crypto.randomUUID()
    let stream: (NodeJS.ReadableStream & AsyncIterable<Record<string, unknown>> & { destroy(error?: Error): void }) | undefined
    this.executions.set(activeExecutionId, { connectionId, threadId: connection.threadId })
    const abort = (): void => {
      void this.cancelQuery(connectionId, activeExecutionId).catch(() => undefined).finally(() => stream?.destroy(new DOMException('A operação foi cancelada.', 'AbortError')))
    }
    const timeout = commandTimeout > 0 ? setTimeout(() => {
      void this.cancelQuery(connectionId, activeExecutionId).catch(() => undefined).finally(() => stream?.destroy(Object.assign(new Error('A consulta excedeu o tempo limite configurado.'), { code: 'ETIMEDOUT' })))
    }, commandTimeout * 1000) : undefined
    signal?.addEventListener('abort', abort, { once: true })
    try {
      await this.initializeCoreSession(connection, managed.config)
      if (managed.currentDatabase) await runCoreQuery(connection, `USE ${quoteIdentifier(managed.currentDatabase)}`)
      const query = connection.query({ sql, values: [...values], rowsAsArray: false }) as unknown as { stream(): NodeJS.ReadableStream }
      stream = query.stream() as NodeJS.ReadableStream & AsyncIterable<Record<string, unknown>> & { destroy(error?: Error): void }
      for await (const row of stream) {
        if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
        yield row
      }
    } finally {
      signal?.removeEventListener('abort', abort)
      if (timeout) clearTimeout(timeout)
      this.executions.delete(activeExecutionId)
      if (signal?.aborted) stream?.destroy()
      if (ownsConnection) connection.release()
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

  async withSavepoint<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
    const connection = this.requireConnection(connectionId).transactionConnection
    if (!connection) throw new Error('A document transaction is required for a grid batch savepoint.')
    await connection.query('SAVEPOINT dbforge_grid_edit_batch')
    try {
      const result = await operation()
      await connection.query('RELEASE SAVEPOINT dbforge_grid_edit_batch')
      return result
    } catch (error) {
      try { await connection.query('ROLLBACK TO SAVEPOINT dbforge_grid_edit_batch') } finally { await connection.query('RELEASE SAVEPOINT dbforge_grid_edit_batch') }
      throw error
    }
  }

  async executeParameterized(connectionId: string, sql: string, values: readonly SqlValue[] = [], signal?: AbortSignal): Promise<{ affectedRows: number; insertId: number }> {
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError')
    const managed = this.requireConnection(connectionId)
    if (managed.config.advanced.readOnly) throw new Error('A sessão está marcada como somente leitura.')
    const [result] = managed.transactionConnection
      ? await managed.transactionConnection.execute(sql, [...values])
      : await managed.pool.execute(sql, [...values])
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

  private async initializeCoreSession(connection: CorePoolConnection, config: DriverConnectionConfig): Promise<void> {
    if (config.advanced.readOnly) await runCoreQuery(connection, 'SET SESSION TRANSACTION READ ONLY')
    if (config.advanced.sqlMode) await runCoreQuery(connection, 'SET SESSION sql_mode = ?', [config.advanced.sqlMode])
    if (config.advanced.collation) {
      if (!/^[a-zA-Z0-9_]+$/.test(config.advanced.collation)) throw new Error('Collation inválida.')
      await runCoreQuery(connection, `SET collation_connection = '${config.advanced.collation}'`)
    }
    for (const command of config.advanced.initCommands.split(';').map((item) => item.trim()).filter(Boolean)) {
      await runCoreQuery(connection, command)
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
