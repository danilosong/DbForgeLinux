import type { CheckConstraintModel, DatabaseModel, EventModel, ForeignKeyModel, IndexModel, PartitionModel, RoutineModel, TableModel, TriggerModel, ViewModel } from './model.js'
import { quoteIdentifier, rowsOf } from './sql.js'

export type SchemaQuery = (sql: string, parameters?: unknown[]) => Promise<unknown>
type Row = Record<string, unknown>
const str = (row: Row, key: string): string | undefined => row[key] == null ? undefined : String(row[key])
const bool = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'YES'
const grouped = <T>(rows: Row[], key: string): Map<string, T[]> => {
  const result = new Map<string, T[]>()
  for (const row of rows) {
    const name = String(row[key])
    const group = result.get(name) ?? []
    group.push(row as T)
    result.set(name, group)
  }
  return result
}

export class SchemaIntrospector {
  constructor(private readonly query: SchemaQuery) {}

  async inspect(database: string): Promise<DatabaseModel> {
    const schemaRows = rowsOf<Row>(await this.query('SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [database]))
    if (!schemaRows.length) throw new Error(`Database ${database} não encontrado ou sem acesso.`)
    const tables = await this.readTables(database)
    const views = await this.readViews(database)
    const procedures = await this.readRoutines(database, 'PROCEDURE')
    const functions = await this.readRoutines(database, 'FUNCTION')
    const triggers = await this.readTriggers(database)
    const events = await this.readEvents(database)
    const schema = schemaRows[0]
    return { kind: 'database', name: database, charset: str(schema, 'charset'), collation: str(schema, 'collation'), tables: orderTables(tables), views, procedures, functions, triggers, events }
  }

  private async readTables(database: string): Promise<TableModel[]> {
    const tableRows = rowsOf<Row>(await this.query("SELECT t.TABLE_NAME AS name, t.ENGINE AS engine, t.TABLE_COLLATION AS collation, cca.CHARACTER_SET_NAME AS charset, t.TABLE_COMMENT AS comment, t.CREATE_OPTIONS AS options FROM information_schema.TABLES t LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY cca ON cca.COLLATION_NAME = t.TABLE_COLLATION WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE' ORDER BY t.TABLE_NAME", [database]))
    const [columns, stats, fkRows, checkRows, partitionRows] = await Promise.all([
      this.query('SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLUMN_COMMENT AS comment, CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation, GENERATION_EXPRESSION AS generatedExpression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION', [database]),
      this.query('SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seq, COLUMN_NAME AS columnName, COLLATION AS direction, SUB_PART AS prefixLength, INDEX_TYPE AS indexType, INDEX_COMMENT AS comment FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX', [database]),
      this.query('SELECT kcu.TABLE_NAME AS tableName, kcu.CONSTRAINT_NAME AS name, kcu.COLUMN_NAME AS columnName, kcu.REFERENCED_TABLE_SCHEMA AS referencedDatabase, kcu.REFERENCED_TABLE_NAME AS referencedTable, kcu.REFERENCED_COLUMN_NAME AS referencedColumn, kcu.ORDINAL_POSITION AS seq, rc.UPDATE_RULE AS onUpdate, rc.DELETE_RULE AS onDelete FROM information_schema.KEY_COLUMN_USAGE kcu JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.TABLE_NAME = kcu.TABLE_NAME WHERE kcu.CONSTRAINT_SCHEMA = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION', [database]),
      this.query('SELECT tc.TABLE_NAME AS tableName, tc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS expression, cc.ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc USING (CONSTRAINT_SCHEMA, CONSTRAINT_NAME) WHERE tc.CONSTRAINT_SCHEMA = ? AND tc.CONSTRAINT_TYPE = \'CHECK\'', [database]).catch(() => []),
      this.query('SELECT TABLE_NAME AS tableName, PARTITION_NAME AS name, PARTITION_METHOD AS method, PARTITION_EXPRESSION AS expression, PARTITION_DESCRIPTION AS description, SUBPARTITION_NAME AS subpartition FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA = ? AND PARTITION_NAME IS NOT NULL ORDER BY TABLE_NAME, PARTITION_ORDINAL_POSITION', [database])
    ])
    const columnsByTable = grouped<Row>(rowsOf<Row>(columns), 'tableName')
    const fkByTable = grouped<Row>(rowsOf<Row>(fkRows), 'tableName')
    const checksByTable = grouped<Row>(rowsOf<Row>(checkRows), 'tableName')
    const partitionsByTable = grouped<Row>(rowsOf<Row>(partitionRows), 'tableName')
    const visibleRows = new Map<string, Row[]>(grouped<Row>(rowsOf<Row>(stats), 'tableName'))
    const tables: TableModel[] = []
    for (const row of tableRows) {
      const name = String(row.name)
      let createSql: string | undefined
      try { createSql = await this.showCreate(database, name, 'TABLE') } catch { /* SHOW CREATE privileges vary; metadata remains usable. */ }
      const cols = (columnsByTable.get(name) ?? []).map((item) => {
        const extra = String(item.extra ?? '')
        return { name: String(item.name), type: String(item.type), nullable: String(item.nullable) === 'YES', default: item.defaultValue as string | null, autoIncrement: /auto_increment/i.test(extra), comment: String(item.comment ?? '') || undefined, generated: String(item.generatedExpression ?? '') || undefined, generatedStorage: /stored/i.test(extra) ? 'STORED' as const : /virtual/i.test(extra) ? 'VIRTUAL' as const : undefined, charset: str(item, 'charset'), collation: str(item, 'collation'), onUpdate: /on update (.+?)(?:\s|$)/i.exec(extra)?.[1] }
      })
      const indexRows = visibleRows.get(name) ?? []
      const indexes = [...grouped<Row>(indexRows, 'indexName')].map(([indexName, parts]) => {
        const first = parts[0]
        const type = String(first.indexType ?? '').toUpperCase()
        const kind = indexName === 'PRIMARY' ? 'PRIMARY' : bool(first.nonUnique) ? type === 'FULLTEXT' ? 'FULLTEXT' : type === 'SPATIAL' ? 'SPATIAL' : 'INDEX' : 'UNIQUE'
        return { name: indexName, kind: kind as IndexModel['kind'], comment: str(first, 'comment'), visible: first.visible == null ? undefined : String(first.visible).toUpperCase() !== 'NO', columns: parts.map((part) => ({ name: String(part.columnName ?? ''), expression: part.columnName == null ? undefined : undefined, prefixLength: part.prefixLength == null ? undefined : Number(part.prefixLength), order: String(part.direction ?? '').toUpperCase() === 'D' ? 'DESC' as const : 'ASC' as const })) }
      })
      const fks = [...grouped<Row>(fkByTable.get(name) ?? [], 'name')].map(([constraintName, parts]) => {
        const first = parts[0]
        return { name: constraintName, columns: parts.map((part) => String(part.columnName)), referencedTable: String(first.referencedTable), referencedDatabase: str(first, 'referencedDatabase'), referencedColumns: parts.map((part) => String(part.referencedColumn)), onUpdate: str(first, 'onUpdate'), onDelete: str(first, 'onDelete') } satisfies ForeignKeyModel
      })
      const checks = (checksByTable.get(name) ?? []).map((check) => ({ name: String(check.name), expression: String(check.expression), enforced: check.enforced == null ? undefined : bool(check.enforced) })) satisfies CheckConstraintModel[]
      const partitionMap = new Map<string, PartitionModel>()
      for (const part of partitionsByTable.get(name) ?? []) {
        const pname = String(part.name)
        const existing = partitionMap.get(pname)
        if (!existing) partitionMap.set(pname, { name: pname, method: String(part.method ?? ''), expression: str(part, 'expression'), description: str(part, 'description'), subpartition: str(part, 'subpartition') })
      }
      const tablePartitions = [...partitionMap.values()]
      const partitionMethod = tablePartitions[0]?.method.toUpperCase().replace(/\s+/g, ' ')
      const partitioning = partitionMethod && ['RANGE', 'LIST', 'HASH', 'KEY', 'LINEAR HASH', 'LINEAR KEY'].includes(partitionMethod)
        ? { method: partitionMethod as NonNullable<TableModel['partitioning']>['method'], expression: tablePartitions[0]?.expression, definitions: tablePartitions.map((partition) => ({ name: partition.name, value: partition.description })) }
        : undefined
      tables.push({ kind: 'table', name, columns: cols, indexes, foreignKeys: fks, checks, partitions: tablePartitions, partitioning, engine: str(row, 'engine'), charset: str(row, 'charset'), collation: str(row, 'collation'), comment: str(row, 'comment'), options: parseOptions(str(row, 'options')), createSql })
    }
    return tables
  }

  private async readViews(database: string): Promise<ViewModel[]> {
    const rows = rowsOf<Row>(await this.query('SELECT TABLE_NAME AS name, VIEW_DEFINITION AS definition, CHECK_OPTION AS checkOption, DEFINER AS definer, SECURITY_TYPE AS securityType FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME', [database]))
    return Promise.all(rows.map(async (row) => ({ kind: 'view', name: String(row.name), definition: String(row.definition ?? ''), checkOption: str(row, 'checkOption'), definer: str(row, 'definer'), security: str(row, 'securityType'), createSql: await this.showCreate(database, String(row.name), 'VIEW').catch(() => undefined) })))
  }

  private async readRoutines(database: string, type: 'PROCEDURE' | 'FUNCTION'): Promise<RoutineModel[]> {
    const rows = rowsOf<Row>(await this.query('SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS routineType, ROUTINE_DEFINITION AS definition, DEFINER AS definer, SECURITY_TYPE AS securityType, SQL_DATA_ACCESS AS sqlDataAccess, IS_DETERMINISTIC AS isDeterministic, ROUTINE_COMMENT AS comment, DTD_IDENTIFIER AS returnType FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = ? ORDER BY ROUTINE_NAME', [database, type]))
    return Promise.all(rows.map(async (row) => {
      const parameterRows = rowsOf<Row>(await this.query('SELECT PARAMETER_MODE AS mode, PARAMETER_NAME AS name, DTD_IDENTIFIER AS type FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = ? AND SPECIFIC_NAME = ? AND ORDINAL_POSITION > 0 ORDER BY ORDINAL_POSITION', [database, String(row.name)]))
      const parameters = parameterRows.map((parameter) => `${parameter.mode ? `${parameter.mode} ` : ''}${parameter.name ? `${quoteIdentifier(String(parameter.name))} ` : ''}${parameter.type ?? ''}`.trim())
      return { kind: type.toLowerCase() as 'procedure' | 'function', name: String(row.name), definition: String(row.definition ?? ''), definer: str(row, 'definer'), security: str(row, 'securityType'), sqlDataAccess: str(row, 'sqlDataAccess'), deterministic: String(row.isDeterministic).toUpperCase() === 'YES', comment: str(row, 'comment'), parameters, returnType: str(row, 'returnType'), createSql: await this.showCreate(database, String(row.name), type).catch(() => undefined) }
    }))
  }

  private async readTriggers(database: string): Promise<TriggerModel[]> {
    const rows = rowsOf<Row>(await this.query('SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS tableName, ACTION_TIMING AS timing, EVENT_MANIPULATION AS event, ACTION_STATEMENT AS definition, DEFINER AS definer FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, TRIGGER_NAME', [database]))
    return Promise.all(rows.map(async (row) => ({ kind: 'trigger', name: String(row.name), table: String(row.tableName), timing: String(row.timing).toUpperCase() as TriggerModel['timing'], event: String(row.event).toUpperCase() as TriggerModel['event'], definition: String(row.definition ?? ''), definer: str(row, 'definer'), createSql: await this.showCreate(database, String(row.name), 'TRIGGER').catch(() => undefined) })))
  }

  private async readEvents(database: string): Promise<EventModel[]> {
    const rows = rowsOf<Row>(await this.query('SELECT EVENT_NAME AS name, EVENT_DEFINITION AS definition, STATUS AS status, EVENT_TYPE AS eventType, INTERVAL_VALUE AS intervalValue, INTERVAL_FIELD AS intervalField, EXECUTE_AT AS executeAt, STARTS AS startsAt, ENDS AS endsAt, DEFINER AS definer FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ? ORDER BY EVENT_NAME', [database]))
    return Promise.all(rows.map(async (row) => ({ kind: 'event', name: String(row.name), definition: String(row.definition ?? ''), status: str(row, 'status'), schedule: str(row, 'executeAt') ?? `${str(row, 'intervalValue') ?? ''} ${str(row, 'intervalField') ?? ''}`.trim(), definer: str(row, 'definer'), createSql: await this.showCreate(database, String(row.name), 'EVENT').catch(() => undefined) })))
  }

  private async showCreate(database: string, name: string, kind: string): Promise<string | undefined> {
    const rows = rowsOf<Row>(await this.query(`SHOW CREATE ${kind} ${quoteIdentifier(database)}.${quoteIdentifier(name)}`))
    const key = Object.keys(rows[0] ?? {}).find((item) => item.toLowerCase().startsWith('create '))
    return key ? String(rows[0][key]) : undefined
  }
}

function parseOptions(options: string | undefined): Record<string, string> | undefined {
  if (!options) return undefined
  const result: Record<string, string> = {}
  for (const option of options.split(/\s+/)) {
    const [key, ...rest] = option.split('=')
    if (key) result[key] = rest.join('=') || 'true'
  }
  return Object.keys(result).length ? result : undefined
}

function orderTables(tables: TableModel[]): TableModel[] {
  const byName = new Map(tables.map((table) => [table.name, table]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const ordered: TableModel[] = []
  const visit = (table: TableModel): void => {
    if (visited.has(table.name) || active.has(table.name)) return
    active.add(table.name)
    for (const fk of table.foreignKeys) { const dependency = byName.get(fk.referencedTable); if (dependency) visit(dependency) }
    active.delete(table.name); visited.add(table.name); ordered.push(table)
  }
  for (const table of tables) visit(table)
  return ordered
}
