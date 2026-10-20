import type { ConnectionRecord, ConnectionTestResult, ConnectionSummary, QueryResult, DatabaseObject, SqlFile } from './index.js'
import type { SecurityApi } from './security.js'
import type { SessionsApi } from './sessions.js'
import type { SchemaCompareApi } from './schema-compare.js'
import type { DataCompareApi } from './data-compare.js'
import type { ImportExportApi } from './import-export.js'
export interface DbForgeApi extends SecurityApi, SessionsApi, SchemaCompareApi, DataCompareApi, ImportExportApi {
  getConnections(): Promise<ConnectionRecord[]>
  saveConnection(record: ConnectionRecord): Promise<void>
  deleteConnection(id: string): Promise<void>
  savePassword(key: string, password: string): Promise<void>
  deletePassword(key: string): Promise<void>
  testConnection(record: ConnectionRecord): Promise<ConnectionTestResult>
  connect(record: ConnectionRecord): Promise<ConnectionSummary>
  disconnect(connectionId: string): Promise<void>
  listDatabases(connectionId: string): Promise<string[]>
  listTables(connectionId: string, database: string): Promise<string[]>
  executeSql(connectionId: string, sql: string, executionId?: string): Promise<QueryResult[]>
  cancelQuery(connectionId: string, executionId: string): Promise<void>
  listDatabaseObjects(connectionId: string, database: string): Promise<DatabaseObject[]>
  showCreateObject(connectionId: string, database: string, object: DatabaseObject): Promise<string>
  setDatabase(connectionId: string, database: string): Promise<void>
  beginTransaction(connectionId: string): Promise<void>
  commitTransaction(connectionId: string): Promise<void>
  rollbackTransaction(connectionId: string): Promise<void>
  openSqlFile(): Promise<SqlFile | null>
  saveSqlFile(path: string | undefined, contents: string): Promise<string | null>
}
