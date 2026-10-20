import type { BuiltQuery, QueryBuilderModel, QueryBuilderSchema } from '../../modules/query-builder/types.js'
import type { QueryResult } from './sql.js'

export interface QueryBuilderExecution { sql: string; results: QueryResult[]; elapsedMs: number }
export interface QueryBuilderApi {
  getQueryBuilderSchema(connectionId: string, database: string): Promise<QueryBuilderSchema>
  buildQueryBuilder(model: QueryBuilderModel): Promise<BuiltQuery>
  parseQueryBuilder(sql: string, database?: string): Promise<{ model?: QueryBuilderModel; error?: string }>
  executeQueryBuilder(connectionId: string, model: QueryBuilderModel, confirmedDestructive?: boolean, executionId?: string): Promise<QueryBuilderExecution>
  cancelQueryBuilder(executionId: string): Promise<void>
}
