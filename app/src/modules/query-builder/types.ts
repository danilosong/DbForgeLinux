export type QueryStatement = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS'
export type QueryAggregate = 'NONE' | 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT DISTINCT'
export type QueryOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL'

export interface QueryColumn { name: string; type: string; primaryKey?: boolean; nullable?: boolean }
export interface QueryForeignKey { column: string; referencedTable: string; referencedColumn: string }
export interface QueryTable { name: string; database: string; alias: string; columns: QueryColumn[]; foreignKeys: QueryForeignKey[]; x?: number; y?: number }
export interface ColumnRef { table: string; column: string }
export interface QuerySelection { source: ColumnRef; alias?: string; aggregate?: QueryAggregate; included: boolean; group?: boolean; sort?: 'ASC' | 'DESC' }
export interface QueryJoinCondition { left: ColumnRef; operator: '=' | '<>' | '>' | '<' | '>=' | '<='; right: ColumnRef; connector?: 'AND' | 'OR' }
export interface QueryJoin { leftTable: string; rightTable: string; type: JoinType; conditions: QueryJoinCondition[] }
export interface QueryCondition { column: ColumnRef; operator: QueryOperator; value?: unknown; secondValue?: unknown; connector?: 'AND' | 'OR'; having?: boolean }
export interface QueryAssignment { column: ColumnRef; value: unknown }
export interface QueryBuilderModel { statement: QueryStatement; tables: QueryTable[]; joins: QueryJoin[]; selections: QuerySelection[]; conditions: QueryCondition[]; distinct?: boolean; limit?: number; assignments?: QueryAssignment[] }
export interface BuiltQuery { sql: string; parameters: unknown[] }
export interface QueryBuilderSchema { database: string; tables: QueryTable[] }
