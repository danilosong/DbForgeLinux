import { useI18n } from '../../i18n/useI18n.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Editor from '../../components/MonacoEditor.js'
import type { ConnectionRecord, ConnectionSummary, QueryResult } from '../../../../../shared/contracts.js'
import type { BuiltQuery, ColumnRef, JoinType, QueryAggregate, QueryBuilderModel, QueryBuilderSchema, QueryCondition, QueryOperator, QuerySelection, QueryTable } from '../../../../../modules/query-builder/types.js'
import { buildQuery, selectAllRowsFromTable, wrapSelectAsInsert, wrapSelectAsSubquery } from '../../../../../modules/query-builder/index.js'
import { joinFromDraggedColumns } from '../../../../../modules/query-builder/drag-drop.js'
import { columnPortY, joinPath } from '../../../../../modules/query-builder/diagram.js'
import { splitSqlStatements } from '../../../../../shared/sqlStatements.js'
import { defaultSettings } from '../../../../../modules/options/types.js'
import type { AppSettings } from '../../../../../modules/options/types.js'
import { databaseObjectDragType, parseDatabaseObjectDrag } from '../../../../../shared/databaseObjectDrag.js'
import { usePanelConnection, usePanelNavigation } from '../registry'

type BuilderTab = 'Selection' | 'Joins' | 'Where' | 'Group By' | 'Having' | 'Order By'
type DocView = 'Diagram' | 'Text' | 'Data'
const blankModel = (): QueryBuilderModel => ({ statement: 'SELECT', tables: [], joins: [], selections: [], conditions: [] })
const operators: QueryOperator[] = ['=', '<>', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL']

export default function QueryBuilderPanel(): React.JSX.Element {
  const { t } = useI18n()

  const contextualConnection = usePanelConnection()
  const { selectedObject } = usePanelNavigation()
  const [connections, setConnections] = useState<ConnectionRecord[]>([]); const [connectionId, setConnectionId] = useState(contextualConnection?.id ?? '')
  const [active, setActive] = useState<ConnectionSummary | undefined>(contextualConnection)
  const [databases, setDatabases] = useState<string[]>([]); const [database, setDatabase] = useState(contextualConnection?.database ?? '')
  const [schema, setSchema] = useState<QueryBuilderSchema | null>(null); const [model, setModel] = useState<QueryBuilderModel>(blankModel); const [schemaBusy, setSchemaBusy] = useState(false); const [zoom, setZoom] = useState(1)
  const [queryPage, setQueryPage] = useState<'root' | 'subquery'>('root'); const [rootModel, setRootModel] = useState<QueryBuilderModel | null>(null); const [subqueryModel, setSubqueryModel] = useState<QueryBuilderModel | null>(null)
  const [insertTarget, setInsertTarget] = useState('')
  const [addOpen, setAddOpen] = useState(false); const [search, setSearch] = useState(''); const [tab, setTab] = useState<BuilderTab>('Selection'); const [view, setView] = useState<DocView>('Diagram')
  const [sqlText, setSqlText] = useState(''); const [unparsedSql, setUnparsedSql] = useState(false); const [built, setBuilt] = useState<BuiltQuery | null>(null)
  const [joinType, setJoinType] = useState<JoinType>('INNER'); const [joinLeft, setJoinLeft] = useState(''); const [joinRight, setJoinRight] = useState(''); const [joinLeftColumn, setJoinLeftColumn] = useState(''); const [joinRightColumn, setJoinRightColumn] = useState('')
  const [editingJoinIndex, setEditingJoinIndex] = useState<number | null>(null)
  const [whereTable, setWhereTable] = useState(''); const [whereColumn, setWhereColumn] = useState(''); const [whereOperator, setWhereOperator] = useState<QueryOperator>('='); const [whereValue, setWhereValue] = useState('')
  const [result, setResult] = useState<QueryResult[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [confirmDestructive, setConfirmDestructive] = useState(false); const [executionId, setExecutionId] = useState(''); const [rawExecution, setRawExecution] = useState(false)
  const [diagramOptions, setDiagramOptions] = useState(defaultSettings.queryBuilder)
  const tables = model.tables
  const filterList = schema?.tables.filter((table) => table.name.toLowerCase().includes(search.toLowerCase())) ?? []
  const compiled = useMemo(() => { try { return buildQuery(model) } catch (error) { return { error: error instanceof Error ? error.message : t('audit.qb.buildFailed') } } }, [model, t])
  const loadSchema = useCallback(async (): Promise<void> => {
    if (!active || !database) return
    setSchemaBusy(true)
    try { setSchema(await window.tuxsql.getQueryBuilderSchema(active.id, database)); setMessage('') }
    catch (error) { setMessage(error instanceof Error ? error.message : t('audit.qb.schemaFailed')) }
    finally { setSchemaBusy(false) }
  }, [active, database, t])

  useEffect(() => {
    const applySettings = (settings: AppSettings): void => setDiagramOptions(settings.queryBuilder)
    void window.tuxsql.loadSettings().then((result) => applySettings(result.settings)).catch(() => undefined)
    const changed = (event: Event): void => applySettings((event as CustomEvent<AppSettings>).detail)
    window.addEventListener('tuxsql:settings-changed', changed)
    return () => window.removeEventListener('tuxsql:settings-changed', changed)
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.tuxsql.getConnections().then((items) => {
      if (cancelled) return
      setConnections(items)
      setConnectionId((current) => items.some((item) => item.id === current) ? current : contextualConnection?.id && items.some((item) => item.id === contextualConnection.id) ? contextualConnection.id : items[0]?.id ?? '')
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : t('audit.qb.connectionsFailed')) })
    return () => { cancelled = true }
  }, [contextualConnection?.id, t])

  useEffect(() => {
    let cancelled = false
    let connectedId = ''
    setActive(undefined); setDatabases([]); setDatabase(''); setSchema(null); setModel(blankModel()); setRootModel(null); setSubqueryModel(null); setQueryPage('root')
    const record = connections.find((item) => item.id === connectionId)
    if (!record) { setMessage(t('audit.qb.connectionRequired')); return }
    void window.tuxsql.connect(record).then(async (connected) => {
      connectedId = connected.id
      if (cancelled) { await window.tuxsql.disconnect(connected.id); return }
      setActive(connected)
      const items = await window.tuxsql.listDatabases(connected.id)
      if (cancelled) { await window.tuxsql.disconnect(connected.id); return }
      setDatabases(items); setDatabase((current) => items.includes(current) ? current : record.database && items.includes(record.database) ? record.database : items[0] ?? '')
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : t('audit.qb.connectFailed')) })
    return () => { cancelled = true; if (connectedId) void window.tuxsql.disconnect(connectedId) }
  }, [connectionId, connections, t])

  useEffect(() => { if (active && database) void loadSchema() }, [active, database, loadSchema])
  useEffect(() => {
    const name = selectedObject?.object.name
    const table = schema?.tables.find((item) => item.name === name)
    if (!table) return
    setModel((current) => current.tables.length ? current : { ...current, tables: [{ ...table, alias: table.name, x: 40, y: 32 }], selections: table.columns.map((column) => ({ source: { table: table.name, column: column.name }, included: true })) })
  }, [schema, selectedObject?.object.name])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'F5') { event.preventDefault(); void execute() }
      else if (event.ctrlKey && event.key.toLowerCase() === 't') { event.preventDefault(); setAddOpen(true) }
      else if (event.ctrlKey && ['1', '2', '3'].includes(event.key)) { event.preventDefault(); setView(event.key === '1' ? 'Diagram' : event.key === '2' ? 'Text' : 'Data') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  useEffect(() => {
    const onMenuAction = (event: Event): void => {
      const action = (event as CustomEvent<unknown>).detail
      if (action === 'execute') void execute()
      else if (action === 'diagram') setView('Diagram')
      else if (action === 'text') setView('Text')
      else if (action === 'data') setView('Data')
      else if (action === 'reset-layout') { setZoom(1); setModel((current) => ({ ...current, tables: current.tables.map((table, index) => ({ ...table, x: 32 + (index % 3) * 250, y: 32 + Math.floor(index / 3) * 190 })) })) }
    }
    window.addEventListener('tuxsql:query-builder:action', onMenuAction)
    return () => window.removeEventListener('tuxsql:query-builder:action', onMenuAction)
  })
  useEffect(() => {
    if ('error' in compiled) { setBuilt(null); return }
    setBuilt(compiled)
    if (view !== 'Text') setSqlText(compiled.sql)
  }, [compiled, view])

  function refFor(table: QueryTable): string { return table.alias || table.name }
  function createSubquery(): void {
    if (queryPage === 'subquery') return
    setRootModel(model); setSubqueryModel(blankModel()); setModel(blankModel()); setQueryPage('subquery'); setView('Diagram'); setMessage('SubQuery canvas created. Select Root Query to return to the parent canvas.')
  }
  function selectQueryPage(page: 'root' | 'subquery'): void {
    if (page === queryPage) return
    if (queryPage === 'root') { setRootModel(model); setModel(subqueryModel ?? blankModel()) }
    else { setSubqueryModel(model); setModel(rootModel ?? blankModel()) }
    setQueryPage(page); setView('Diagram')
  }
  function wrapCurrentAsSubquery(): void {
    if (!built) return
    try { setSqlText(wrapSelectAsSubquery(built.sql)); setView('Text'); setUnparsedSql(true); setMessage('SELECT wrapped as a derived table. Review the SQL before running.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not wrap query.') }
  }
  function wrapCurrentAsInsert(tableName: string): void {
    const target = tables.find((item) => item.name === tableName)
    if (!built || !target) { setMessage(t('audit.qb.destinationRequired')); return }
    try { setSqlText(wrapSelectAsInsert(built.sql, target)); setView('Text'); setUnparsedSql(true); setMessage('INSERT SELECT created. Review the SQL before running.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create INSERT SELECT.') }
  }
  function selectAllRows(side: 'left' | 'right'): void {
    const firstJoin = model.joins[0]
    const tableName = firstJoin ? side === 'left' ? firstJoin.leftTable : firstJoin.rightTable : tables[side === 'left' ? 0 : 1] ? refFor(tables[side === 'left' ? 0 : 1]!) : ''
    const table = tables.find((item) => refFor(item) === tableName)
    if (!table) { setMessage('Add two tables to choose the left or right side.'); return }
    setModel((current) => ({ ...current, statement: 'SELECT', selections: selectAllRowsFromTable(current.selections, tableName) }))
    setTab('Selection'); setMessage(`Selected all columns from ${table.name}.`)
  }
  function addTable(source: QueryTable, position?: { x: number; y: number }): void {
    if (tables.some((item) => item.name === source.name)) return
    const table = { ...source, alias: source.name, x: position?.x ?? 40 + (tables.length % 3) * 290, y: position?.y ?? 32 + Math.floor(tables.length / 3) * 230 }
    const selections = [...model.selections, ...table.columns.map((column) => ({ source: { table: table.alias, column: column.name }, included: true } satisfies QuerySelection))]
    const joins = [...model.joins]
    for (const fk of table.foreignKeys) {
      const target = tables.find((item) => item.name === fk.referencedTable)
      if (target) joins.push({ leftTable: table.alias, rightTable: refFor(target), type: 'INNER', conditions: [{ left: { table: table.alias, column: fk.column }, operator: '=', right: { table: refFor(target), column: fk.referencedColumn } }] })
    }
    for (const existing of tables) for (const fk of existing.foreignKeys) if (fk.referencedTable === table.name) joins.push({ leftTable: refFor(existing), rightTable: table.alias, type: 'INNER', conditions: [{ left: { table: refFor(existing), column: fk.column }, operator: '=', right: { table: table.alias, column: fk.referencedColumn } }] })
    setModel((current) => ({ ...current, tables: [...current.tables, table], selections, joins })); setAddOpen(false); setResult([])
  }

  function removeTable(name: string): void {
    const aliases = new Set(tables.filter((item) => item.name === name).map(refFor))
    setModel((current) => ({ ...current, tables: current.tables.filter((item) => item.name !== name), joins: current.joins.filter((join) => !aliases.has(join.leftTable) && !aliases.has(join.rightTable)), selections: current.selections.filter((selection) => !aliases.has(selection.source.table)), conditions: current.conditions.filter((condition) => !aliases.has(condition.column.table)) }))
  }

  function renameAlias(tableName: string, alias: string): void {
    if (!alias.trim()) { setMessage('Alias cannot be empty.'); return }
    const oldTable = tables.find((item) => item.name === tableName)
    if (!oldTable) return
    const old = refFor(oldTable)
    const replace = (ref: ColumnRef): ColumnRef => ref.table === old ? { ...ref, table: alias } : ref
    setModel((current) => ({ ...current, tables: current.tables.map((item) => item.name === tableName ? { ...item, alias } : item), joins: current.joins.map((join) => ({ ...join, leftTable: join.leftTable === old ? alias : join.leftTable, rightTable: join.rightTable === old ? alias : join.rightTable, conditions: join.conditions.map((condition) => ({ ...condition, left: replace(condition.left), right: replace(condition.right) })) })), selections: current.selections.map((selection) => ({ ...selection, source: replace(selection.source) })), conditions: current.conditions.map((condition) => ({ ...condition, column: replace(condition.column) })) }))
  }

  function toggleColumn(table: QueryTable, column: string, included: boolean): void {
    const source = { table: refFor(table), column }
    setModel((current) => {
      const found = current.selections.find((selection) => selection.source.table === source.table && selection.source.column === column)
      if (!found) return { ...current, selections: [...current.selections, { source, included }] }
      return { ...current, selections: current.selections.map((selection) => selection === found ? { ...selection, included } : selection) }
    })
  }

  function addJoin(): void {
    if (!joinLeft || !joinRight || !joinLeftColumn || !joinRightColumn || joinLeft === joinRight) { setMessage(t('audit.qb.joinRequired')); return }
    if (editingJoinIndex === null && model.joins.some((join) => (join.leftTable === joinLeft && join.rightTable === joinRight) || (join.leftTable === joinRight && join.rightTable === joinLeft))) { setMessage('A join with these tables already exists.'); return }
    const updated = { leftTable: joinLeft, rightTable: joinRight, type: joinType, conditions: joinType === 'CROSS' ? [] : [{ left: { table: joinLeft, column: joinLeftColumn }, operator: '=' as const, right: { table: joinRight, column: joinRightColumn } }] }
    setModel((current) => ({ ...current, joins: editingJoinIndex === null ? [...current.joins, updated] : current.joins.map((join, index) => index === editingJoinIndex ? updated : join) })); setEditingJoinIndex(null); setMessage('')
  }

  function addJoinFromColumns(left: { table: string; column: string }, right: { table: string; column: string }): void {
    if (left.table === right.table) { setMessage(t('qb.dragJoin.differentTables')); return }
    const leftTable = tables.find((item) => refFor(item) === left.table)
    const rightTable = tables.find((item) => refFor(item) === right.table)
    if (!leftTable?.columns.some((column) => column.name === left.column) || !rightTable?.columns.some((column) => column.name === right.column)) return
    const duplicate = model.joins.findIndex((join) => (join.leftTable === left.table && join.rightTable === right.table) || (join.leftTable === right.table && join.rightTable === left.table))
    const updated = joinFromDraggedColumns(left, right, joinType)
    if (!updated) return
    setModel((current) => ({ ...current, joins: duplicate < 0 ? [...current.joins, updated] : current.joins.map((join, index) => index === duplicate ? updated : join) }))
    setTab('Joins'); setMessage(t('qb.dragJoin.created', [`${left.table}.${left.column}`, `${right.table}.${right.column}`]))
  }

  function dropExplorerObject(event: React.DragEvent<HTMLDivElement>): void {
    const payload = parseDatabaseObjectDrag(event.dataTransfer.getData(databaseObjectDragType))
    if (!payload || payload.connectionId !== connectionId || payload.database !== database) return
    const source = schema?.tables.find((item) => item.name === payload.name)
    if (!source) { setMessage(t('qb.dragJoin.objectUnavailable', [payload.name])); return }
    const bounds = event.currentTarget.getBoundingClientRect()
    addTable(source, { x: Math.max(16, (event.clientX - bounds.left) / zoom), y: Math.max(16, (event.clientY - bounds.top) / zoom) })
    setMessage(t('qb.dragJoin.tableAdded', [payload.name]))
  }

  function editJoin(index: number): void {
    const join = model.joins[index]; if (!join) return
    const condition = join.conditions[0]
    setEditingJoinIndex(index); setJoinLeft(join.leftTable); setJoinRight(join.rightTable); setJoinType(join.type)
    setJoinLeftColumn(condition?.left.column ?? ''); setJoinRightColumn(condition?.right.column ?? '')
  }

  function addCondition(having = false): void {
    if (!whereTable || !whereColumn) { setMessage(t('audit.qb.conditionRequired')); return }
    const value: unknown = whereOperator === 'IN' || whereOperator === 'NOT IN' ? whereValue.split(',').map((item) => item.trim()) : whereValue
    const condition: QueryCondition = { column: { table: whereTable, column: whereColumn }, operator: whereOperator, value, connector: model.conditions.filter((item) => Boolean(item.having) === having).length ? 'AND' : undefined, having }
    setModel((current) => ({ ...current, conditions: [...current.conditions, condition] })); setWhereValue(''); setMessage('')
  }

  function updateSelection(index: number, update: Partial<QuerySelection>): void {
    setModel((current) => ({ ...current, selections: current.selections.map((selection, itemIndex) => itemIndex === index ? { ...selection, ...update } : selection) }))
  }

  function autoLayout(): void {
    setModel((current) => ({ ...current, tables: current.tables.map((table, index) => ({ ...table, x: 28 + (index % 3) * 290, y: 24 + Math.floor(index / 3) * 225 })) }))
  }

  function moveTable(name: string, x: number, y: number): void { setModel((current) => ({ ...current, tables: current.tables.map((table) => table.name === name ? { ...table, x, y } : table) })) }

  async function validateSql(): Promise<void> {
    try {
      const parsed = await window.tuxsql.parseQueryBuilder(sqlText, database)
      if (parsed.model) { setModel(parsed.model); setUnparsedSql(false); setMessage('SQL represented in the diagram.') }
      else { setUnparsedSql(true); setMessage(parsed.error ?? t('audit.qb.visualFailed')) }
    } catch (error) { setUnparsedSql(true); setMessage(error instanceof Error ? error.message : t('audit.qb.visualFailed')) }
  }

  async function execute(): Promise<void> {
    if (!active) { setMessage(t('audit.qb.connectionRequired')); return }
    let currentModel = model
    if (view === 'Text') {
      const parsed = await window.tuxsql.parseQueryBuilder(sqlText, database)
      if (parsed.model) currentModel = parsed.model
      else {
        const statements = splitSqlStatements(sqlText).map((item) => item.sql)
        if (statements.length !== 1 || !/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(statements[0]?.trim() ?? '')) { setMessage(parsed.error ?? 'Only SELECT, INSERT, UPDATE or DELETE statement supported in Query Builder.'); return }
        if (/^(UPDATE|DELETE)\b/i.test(statements[0].trim()) && !/\bWHERE\b/i.test(statements[0]) && !window.confirm('Execute a destructive statement without a WHERE clause?')) return
        const id = crypto.randomUUID(); setExecutionId(id); setRawExecution(true)
        setBusy(true); setMessage('Executing query…')
        try { const output = await window.tuxsql.executeSql(active.id, statements[0], id); setResult(output); setView('Data'); setMessage(`${output[0]?.rows.length ?? output[0]?.affectedRows ?? 0} rows · 0.000 s`) }
        catch (error) { setMessage(error instanceof Error ? error.message : t('audit.qb.executeFailed')) }
        finally { setBusy(false); setExecutionId(''); setRawExecution(false) }
        return
      }
    }
    const destructive = (currentModel.statement === 'UPDATE' || currentModel.statement === 'DELETE') && !currentModel.conditions.some((condition) => !condition.having)
    if (destructive && !confirmDestructive && !window.confirm(`Execute ${currentModel.statement} without a WHERE clause?`)) return
    const id = crypto.randomUUID(); setExecutionId(id); setRawExecution(false)
    setBusy(true); setMessage('Executing query…'); setConfirmDestructive(destructive)
    try {
      const output = await window.tuxsql.executeQueryBuilder(active.id, currentModel, destructive, id)
      setSqlText(output.sql); setResult(output.results); setView('Data'); setMessage(`${output.results[0]?.rows.length ?? output.results[0]?.affectedRows ?? 0} rows · ${(output.elapsedMs / 1000).toFixed(3)} s`)
    } catch (error) { setMessage(error instanceof Error ? error.message : t('audit.qb.executeFailed')) }
    finally { setBusy(false); setConfirmDestructive(false); setExecutionId(''); setRawExecution(false) }
  }

  const visibleSelections = model.selections.filter((selection) => tab === 'Selection' || tab === 'Group By' && selection.included || tab === 'Order By' && Boolean(selection.sort))
  const whereConditions = model.conditions.filter((condition) => !condition.having)
  const havingConditions = model.conditions.filter((condition) => condition.having)
  function setAssignment(column: ColumnRef, value: string): void {
    setModel((current) => ({ ...current, assignments: [...(current.assignments ?? []).filter((item) => item.column.table !== column.table || item.column.column !== column.column), { column, value }] }))
  }

  return <section className="tool-panel qb-panel">
    <header className="qb-heading"><div><h2>{t('panel.query.builder.md6cd8cc5d6')}</h2><p>{t('panel.query.builder.m72022d0e87')}</p></div><div className="qb-connection"><label>{t('panel.query.builder.m1a12a5c35f')} <select aria-label={t('panel.query.builder.mf7f0f186d1')} value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">{t('panel.query.builder.m2bc8e81f62')}</option>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t('panel.query.builder.mdb617e90c3')} <select aria-label={t('panel.query.builder.m5cc49efc76')} value={database} onChange={(event) => { setDatabase(event.target.value); setModel(blankModel()) }} disabled={!active}><option value="">{t('panel.query.builder.m7174246cb9')}</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label></div></header>
    {!active ? <div className="empty-state">{t('panel.query.builder.m2dbfc91093')}</div> : <>
      <div className="qb-toolbar"><label>{t('panel.query.builder.mbddac180a8')} <select aria-label={t('panel.query.builder.mbddac180a8')} value={model.statement} onChange={(event) => setModel((current) => ({ ...current, statement: event.target.value as QueryBuilderModel['statement'] }))}><option>SELECT</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option></select></label><button onClick={() => setAddOpen((open) => !open)}>{t('panel.query.builder.m4cd898704d')}</button><button onClick={createSubquery}>{t('qb.subquery.create')}</button><button onClick={wrapCurrentAsSubquery} disabled={!built || view !== 'Diagram'}>{t('qb.subquery.wrap')}</button><button onClick={() => selectAllRows('left')} disabled={tables.length < 2}>{t('qb.selectAllLeft')}</button><button onClick={() => selectAllRows('right')} disabled={tables.length < 2}>{t('qb.selectAllRight')}</button><select aria-label={t('qb.insertTarget')} value={insertTarget} onChange={(event) => setInsertTarget(event.target.value)}><option value="">{t('qb.insertTarget')}</option>{tables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select><button onClick={() => wrapCurrentAsInsert(insertTarget)} disabled={!built || !insertTarget}>{t('qb.subquery.wrapInsert')}</button><button onClick={autoLayout} disabled={!tables.length}>{t('panel.query.builder.m14b6d944b9')}</button><button onClick={() => setZoom((current) => Math.max(.6, current - .1))}>{t('panel.query.builder.m8900164e98')}</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((current) => Math.min(1.5, current + .1))}>{t('panel.query.builder.m2cb9b46bc0')}</button><button onClick={() => setZoom(1)}>{t('panel.query.builder.m5655463593')}</button><button onClick={() => setSqlText((compiled as BuiltQuery).sql?.replace(/\b(SELECT|FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|JOIN)\b/gi, '\n$1') ?? '')}>{t('editor.format')}</button><button onClick={() => void validateSql()}>{t('panel.query.builder.m41e3f0f4f1')}</button><button className="button-primary" disabled={busy || !built} onClick={() => void execute()}>{busy ? 'Executing…' : 'Execute (F5)'}</button><button disabled={!busy} onClick={() => { if (!active || !executionId) return; if (rawExecution) void window.tuxsql.cancelQuery(active.id, executionId); else void window.tuxsql.cancelQueryBuilder(executionId) }}>{t('editor.stop')}</button></div>
      {rootModel && <div className="qb-query-tabs" role="tablist" aria-label={t('qb.queryTabs')}><button role="tab" aria-selected={queryPage === 'root'} className={queryPage === 'root' ? 'active' : ''} onClick={() => selectQueryPage('root')}>{t('qb.rootQuery')}</button><button role="tab" aria-selected={queryPage === 'subquery'} className={queryPage === 'subquery' ? 'active' : ''} onClick={() => selectQueryPage('subquery')}>{t('qb.subQuery')}</button></div>}
      {addOpen && <div className="qb-add-table"><input placeholder={t('panel.query.builder.m209e4c58a6')} value={search} onChange={(event) => setSearch(event.target.value)} autoFocus /><div className="qb-table-list">{schemaBusy ? 'Loading tables…' : filterList.map((table) => <button type="button" key={table.name} disabled={tables.some((item) => item.name === table.name)} onClick={() => addTable(table)}>＋ {table.name}</button>)}</div><button onClick={() => setAddOpen(false)}>{t('panel.query.builder.m72fceed137')}</button></div>}
      <div className="qb-main">
        {view === 'Diagram' && <div className="qb-canvas-wrap" onDragOver={(event) => { if (event.dataTransfer.types.includes(databaseObjectDragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={(event) => { event.preventDefault(); dropExplorerObject(event) }}><div className="qb-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: Math.max(900, ...tables.map((table) => (table.x ?? 0) + 300)), height: Math.max(310, ...tables.map((table) => (table.y ?? 0) + 280)), backgroundImage: diagramOptions.showGrid ? 'radial-gradient(var(--border) 1px, transparent 1px)' : 'none', backgroundSize: diagramOptions.showGrid ? `${diagramOptions.gridSize}px ${diagramOptions.gridSize}px` : undefined }}>
          <svg className="qb-join-lines" aria-label={t('panel.query.builder.m1cc0cb24cb')} width="100%" height="100%" viewBox={`0 0 ${Math.max(900, ...tables.map((table) => (table.x ?? 0) + 300))} ${Math.max(310, ...tables.map((table) => (table.y ?? 0) + 280))}`}>{model.joins.map((join, index) => { const left = tables.find((table) => refFor(table) === join.leftTable); const right = tables.find((table) => refFor(table) === join.rightTable); if (!left || !right) return null; const leftColumn = join.conditions[0]?.left.column; const rightColumn = join.conditions[0]?.right.column; const x1 = (left.x ?? 0) + 260; const y1 = columnPortY(left, leftColumn, left.y ?? 0); const x2 = right.x ?? 0; const y2 = columnPortY(right, rightColumn, right.y ?? 0); const mid = (x1 + x2) / 2; return <g key={index} className="qb-join-link" role="button" tabIndex={0} aria-label={`${join.type} join ${join.leftTable}.${leftColumn ?? '*'} to ${join.rightTable}.${rightColumn ?? '*'}. Click to edit`} onClick={() => editJoin(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editJoin(index) } }}><path d={joinPath(x1, y1, x2, y2)} fill="none" stroke="var(--accent)" strokeWidth={editingJoinIndex === index ? 3 : 2} /><circle cx={x1} cy={y1} r="3" fill="var(--accent)" /><circle cx={x2} cy={y2} r="3" fill="var(--accent)" /><text x={mid} y={(y1 + y2) / 2 - 6} fill="var(--text-secondary)" fontSize="11">{join.type}</text><title>{join.type}: {join.leftTable}.{leftColumn ?? '*'} → {join.rightTable}.{rightColumn ?? '*'} (click to edit)</title></g> })}</svg>
          {model.tables.map((table) => <TableCard key={table.name} table={table} selected={new Set(model.selections.filter((item) => item.included).map((item) => `${item.source.table}.${item.source.column}`))} shadows={diagramOptions.shadows} onToggle={(column, included) => toggleColumn(table, column, included)} onRemove={() => removeTable(table.name)} onAlias={(alias) => renameAlias(table.name, alias)} onJoinColumns={addJoinFromColumns} onMove={(x, y) => { const size = diagramOptions.gridSize; moveTable(table.name, diagramOptions.snapToGrid ? Math.round(x / size) * size : x, diagramOptions.snapToGrid ? Math.round(y / size) * size : y) }} />)}
          {!model.tables.length && <div className="empty-state">{t('panel.query.builder.mc12918d168')} <button onClick={() => setAddOpen(true)}>{t('qb.addTable')}</button></div>}
        </div></div>}
        {view === 'Text' && <div className="qb-editor"><Editor height="300px" language="sql" theme="vs" value={sqlText} onChange={(value) => setSqlText(value ?? '')} options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13 }} />{unparsedSql && <div className="inline-warning">{t('panel.query.builder.m795ff4ab09')}</div>}</div>}
        {view === 'Data' && <div className="qb-data">{result.map((set, setIndex) => <div key={setIndex}><table><thead><tr>{set.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{set.rows.map((row, rowIndex) => <tr key={rowIndex}>{set.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody></table>{!set.rows.length && <p>{set.affectedRows} {t('panel.query.builder.m7f035b5107')} {set.insertId}</p>}</div>)}</div>}
      </div>
      <div className="qb-join-tools" style={{ display: tab === 'Joins' ? 'flex' : 'none' }}><strong>{t('panel.query.builder.m1ecd9d5fb8')}</strong><select aria-label={t('panel.query.builder.m690726eba9')} value={joinType} onChange={(event) => setJoinType(event.target.value as JoinType)}>{(['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'] as JoinType[]).map((type) => <option key={type}>{type}</option>)}</select><select aria-label={t('panel.query.builder.me1387ad7dd')} value={joinLeft} onChange={(event) => setJoinLeft(event.target.value)}><option value="">{t('panel.query.builder.m5d29890b29')}</option>{tables.map((table) => <option value={refFor(table)} key={table.name}>{table.alias || table.name}</option>)}</select><select aria-label={t('panel.query.builder.m4e4c555ae4')} value={joinLeftColumn} onChange={(event) => setJoinLeftColumn(event.target.value)}><option value="">{t('panel.query.builder.m8385537405')}</option>{tables.find((item) => refFor(item) === joinLeft)?.columns.map((column) => <option key={column.name}>{column.name}</option>)}</select><span>→</span><select aria-label={t('panel.query.builder.mb24118e275')} value={joinRight} onChange={(event) => setJoinRight(event.target.value)}><option value="">{t('panel.query.builder.m5d29890b29')}</option>{tables.map((table) => <option value={refFor(table)} key={table.name}>{table.alias || table.name}</option>)}</select><select aria-label={t('panel.query.builder.m9bac1adba1')} value={joinRightColumn} onChange={(event) => setJoinRightColumn(event.target.value)}><option value="">{t('panel.query.builder.m8385537405')}</option>{tables.find((item) => refFor(item) === joinRight)?.columns.map((column) => <option key={column.name}>{column.name}</option>)}</select><button onClick={addJoin}>{editingJoinIndex === null ? t('qb.join.addCond') : t('qb.join.editCond')}</button>{editingJoinIndex !== null && <button onClick={() => setEditingJoinIndex(null)}>{t('common.cancel')}</button>}{model.joins.map((join, index) => <span className="qb-join-chip" key={`${join.leftTable}-${join.rightTable}-${index}`}><button className="qb-join-edit" onClick={() => editJoin(index)}>{join.type}: {join.leftTable} {join.conditions[0]?.left.column ?? ''} → {join.rightTable} {join.conditions[0]?.right.column ?? ''}</button><button aria-label={t('qb.join.drop')} onClick={() => setModel((current) => ({ ...current, joins: current.joins.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></span>)}</div>
      <nav className="qb-criteria-tabs" aria-label={t('panel.query.builder.md6dc951097')}>{(['Selection', 'Joins', 'Where', 'Group By', 'Having', 'Order By'] as BuilderTab[]).map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="qb-criteria">
        {(tab === 'Selection' || tab === 'Group By' || tab === 'Order By') && <table><thead><tr><th>{t('panel.query.builder.mb5c78c3e8a')}</th>{tab === 'Selection' && <><th>{t('panel.query.builder.m05d1a408bc')}</th><th>{t('panel.query.builder.m03172063c4')}</th></>}<th>{tab === 'Group By' ? 'Group' : 'Sort'}</th>{tab !== 'Group By' && <th>{t('obj.trigger.order')}</th>}</tr></thead><tbody>{visibleSelections.map((selection) => { const index = model.selections.indexOf(selection); return <tr key={`${selection.source.table}.${selection.source.column}`}><td>{selection.source.table}.{selection.source.column}</td>{tab === 'Selection' && <><td><input aria-label={t('panel.query.builder.m731c8178ce')} value={selection.alias ?? ''} onChange={(event) => updateSelection(index, { alias: event.target.value })} /></td><td><select aria-label={t('panel.query.builder.m03172063c4')} value={selection.aggregate ?? 'NONE'} onChange={(event) => updateSelection(index, { aggregate: event.target.value as QueryAggregate })}>{['NONE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'COUNT DISTINCT'].map((aggregate) => <option key={aggregate}>{aggregate}</option>)}</select></td></>}<td>{tab === 'Group By' ? <input type="checkbox" checked={Boolean(selection.group)} onChange={(event) => updateSelection(index, { group: event.target.checked })} /> : <input type="checkbox" checked={Boolean(selection.sort)} onChange={(event) => updateSelection(index, { sort: event.target.checked ? 'ASC' : undefined })} />}</td>{tab !== 'Group By' && <td><select value={selection.sort ?? 'ASC'} disabled={!selection.sort} onChange={(event) => updateSelection(index, { sort: event.target.value as 'ASC' | 'DESC' })}><option>ASC</option><option>DESC</option></select></td>}</tr> })}</tbody></table>}
        {(tab === 'Where' || tab === 'Having') && <><div className="qb-condition-form"><select aria-label={t('panel.query.builder.m43fa6ff359')} value={whereTable} onChange={(event) => { setWhereTable(event.target.value); setWhereColumn('') }}><option value="">{t('panel.query.builder.m5d29890b29')}</option>{tables.map((table) => <option value={refFor(table)} key={table.name}>{table.alias || table.name}</option>)}</select><select aria-label={t('panel.query.builder.m292a4b3d10')} value={whereColumn} onChange={(event) => setWhereColumn(event.target.value)}><option value="">{t('panel.query.builder.m8385537405')}</option>{tables.find((table) => refFor(table) === whereTable)?.columns.map((column) => <option key={column.name}>{column.name}</option>)}</select><select aria-label={t('panel.query.builder.m1476968191')} value={whereOperator} onChange={(event) => setWhereOperator(event.target.value as QueryOperator)}>{operators.map((operator) => <option key={operator}>{operator}</option>)}</select>{!['IS NULL', 'IS NOT NULL'].includes(whereOperator) && <input aria-label={t('panel.query.builder.maeb47ff850')} value={whereValue} onChange={(event) => setWhereValue(event.target.value)} placeholder={t('qb.cond.criteria')} />}<button onClick={() => addCondition(tab === 'Having')}>{t('panel.query.builder.m2b5466cdcb')}</button></div><Conditions items={tab === 'Having' ? havingConditions : whereConditions} onDelete={(item) => setModel((current) => ({ ...current, conditions: current.conditions.filter((condition) => condition !== item) }))} /></>}
        {tab === 'Selection' && model.statement !== 'SELECT' && tables[0] && <div className="qb-condition-form"><strong>{model.statement} {t('panel.query.builder.mfd1bea03c3')}</strong>{tables[0].columns.map((column) => <label key={column.name}>{column.name}<input value={String(model.assignments?.find((item) => item.column.column === column.name)?.value ?? '')} onChange={(event) => setAssignment({ table: refFor(tables[0]), column: column.name }, event.target.value)} placeholder={t('panel.query.builder.m78890f02c4')} /></label>)}</div>}
        <label className="qb-distinct"><input type="checkbox" checked={Boolean(model.distinct)} onChange={(event) => setModel((current) => ({ ...current, distinct: event.target.checked }))} /> {t('qb.selection.distinct')}</label>
        <label>{t('panel.query.builder.m42b42972ca')} <input type="number" min="0" value={model.limit ?? ''} onChange={(event) => setModel((current) => ({ ...current, limit: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label>
      </div>
      <div className="qb-view-tabs">{(['Diagram', 'Text', 'Data'] as DocView[]).map((item) => <button className={view === item ? 'active' : ''} key={item} onClick={() => { setView(item); if (item === 'Text' && !sqlText && built) setSqlText(built.sql) }}>{item}</button>)}<span>{compiled && 'error' in compiled ? compiled.error : built?.sql}</span></div>
      {message && <p role="status" className="qb-message">{message}</p>}
    </>}
    <style>{`.qb-panel{height:100%;display:flex;flex-direction:column;gap:8px}.qb-heading,.qb-toolbar,.qb-connection,.qb-join-tools,.qb-view-tabs,.qb-criteria-tabs,.qb-condition-form{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.qb-heading{justify-content:space-between}.qb-heading h2{margin-bottom:0}.qb-heading p{margin:2px 0;color:var(--text-secondary)}.qb-connection{justify-content:flex-end}.qb-connection label{display:flex;align-items:center;gap:5px}.qb-toolbar{padding:7px 0;border-block:1px solid var(--border)}.qb-query-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border)}.qb-query-tabs button{background:transparent;border-color:transparent}.qb-query-tabs button.active{color:var(--accent);border-bottom:2px solid var(--accent)}.qb-main{min-height:250px;max-height:360px;overflow:auto;position:relative;border:1px solid var(--border);background:var(--bg-surface-alt)}.qb-canvas-wrap{min-width:100%;min-height:310px;overflow:auto}.qb-canvas{position:relative;display:flex;align-content:flex-start;align-items:flex-start;gap:12px;flex-wrap:wrap;min-width:100%;min-height:310px;padding:12px}.qb-canvas-wrap:has(.qb-table-card){background-color:var(--bg-surface-alt)}.qb-canvas-wrap:has(.qb-table-card):active{outline:1px dashed var(--accent)}.qb-join-lines{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:visible}.qb-join-link{pointer-events:stroke;cursor:pointer}.qb-join-link:hover path,.qb-join-link:focus path{stroke-width:3;filter:drop-shadow(0 0 2px var(--accent))}.qb-table-card{width:260px;max-height:260px;overflow:hidden;background:var(--bg-surface);border:1px solid var(--border);border-radius:5px;box-shadow:0 2px 8px #0002;z-index:2}.qb-table-head{display:flex;align-items:center;gap:5px;padding:5px;background:var(--bg-surface-alt);border-bottom:1px solid var(--border)}.qb-table-head input{min-width:0;width:100px}.qb-table-columns{max-height:205px;overflow:auto}.qb-table-columns label,.qb-column-row{display:flex;gap:5px;align-items:center;padding:2px 7px}.qb-column-row{cursor:grab}.qb-column-row:hover,.qb-column-row:focus-within{background:var(--bg-hover)}.qb-column-row.dragging{opacity:.55}.qb-table-columns small{margin-left:auto;color:var(--text-secondary)}.qb-join-tools{padding:5px 0;border-bottom:1px solid var(--border)}.qb-join-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:10px;background:var(--accent-soft)}.qb-join-edit{background:transparent;border:0;padding:1px;color:inherit}.qb-criteria-tabs{border-bottom:1px solid var(--border)}.qb-criteria-tabs button,.qb-view-tabs button{background:transparent;border-color:transparent}.qb-criteria-tabs button.active,.qb-view-tabs button.active{color:var(--accent);border-bottom:2px solid var(--accent)}.qb-criteria{max-height:240px;overflow:auto;padding:6px 0}.qb-criteria table,.qb-data table{width:100%;border-collapse:collapse}.qb-criteria td,.qb-criteria th,.qb-data td,.qb-data th{padding:4px 6px;text-align:left;border-bottom:1px solid var(--border)}.qb-condition-form{padding:6px 0}.qb-condition-form input{width:140px}.qb-distinct{margin-right:12px}.qb-view-tabs{padding-top:5px;border-top:1px solid var(--border)}.qb-view-tabs span{margin-left:auto;color:var(--text-secondary);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace}.qb-editor{min-height:300px;flex:1;border:1px solid var(--border)}.qb-data{overflow:auto;max-height:350px}.qb-add-table{position:absolute;z-index:5;top:190px;left:32px;padding:10px;width:min(420px,80%);background:var(--bg-surface);border:1px solid var(--border);box-shadow:0 6px 20px #0003}.qb-table-list{max-height:250px;overflow:auto;display:flex;flex-direction:column}.qb-table-list button{text-align:left}.qb-message{color:var(--text-secondary);margin:2px}.qb-condition-form label{display:flex;gap:3px;align-items:center}`}</style>
  </section>
}

function TableCard({ table, selected, shadows, onToggle, onRemove, onAlias, onMove, onJoinColumns }: { table: QueryTable; selected: Set<string>; shadows: boolean; onToggle: (column: string, included: boolean) => void; onRemove: () => void; onAlias: (alias: string) => void; onMove: (x: number, y: number) => void; onJoinColumns: (left: { table: string; column: string }, right: { table: string; column: string }) => void }): React.JSX.Element {
  const { t } = useI18n()
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  return <article className="qb-table-card" style={{ position: 'absolute', left: table.x ?? 16, top: table.y ?? 16, boxShadow: shadows ? undefined : 'none' }} tabIndex={0} aria-label={`Table ${table.name}`} onPointerDown={(event) => { if ((event.target as HTMLElement).closest('input,button,label,[draggable="true"]')) return; setDrag({ x: event.clientX, y: event.clientY }); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) }} onPointerMove={(event) => { if (!drag) return; onMove(Math.max(0, (table.x ?? 0) + event.clientX - drag.x), Math.max(0, (table.y ?? 0) + event.clientY - drag.y)); setDrag({ x: event.clientX, y: event.clientY }) }} onPointerUp={() => setDrag(null)}>
    <div className="qb-table-head"><strong>{table.name}</strong><label>{t('panel.query.builder.m05d1a408bc')} <input aria-label={`Alias for ${table.name}`} value={table.alias} onChange={(event) => onAlias(event.target.value)} /></label><button aria-label={`Remove ${table.name}`} onClick={onRemove}>×</button></div><div className="qb-table-columns"><label><input type="checkbox" checked={table.columns.every((column) => selected.has(`${table.alias}.${column.name}`))} onChange={(event) => table.columns.forEach((column) => onToggle(column.name, event.target.checked))} /> *</label>{table.columns.map((column) => <div className={`qb-column-row${draggedColumn === column.name ? ' dragging' : ''}`} key={column.name} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'link'; event.dataTransfer.setData('application/x-tuxsql-query-column', JSON.stringify({ table: table.alias, column: column.name })); setDraggedColumn(column.name) }} onDragEnd={() => setDraggedColumn(null)} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-tuxsql-query-column')) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); try { const source = JSON.parse(event.dataTransfer.getData('application/x-tuxsql-query-column')) as { table?: string; column?: string }; if (source.table && source.column) onJoinColumns({ table: source.table, column: source.column }, { table: table.alias, column: column.name }) } catch { /* Ignore unrelated drags. */ } }} title={t('qb.dragJoin.dragColumnHint')}><input type="checkbox" checked={selected.has(`${table.alias}.${column.name}`)} onChange={(event) => onToggle(column.name, event.target.checked)} /><span>{column.name}</span><small>{column.primaryKey ? '🔑 ' : ''}{column.type}</small></div>)}</div>
  </article>
}

function Conditions({ items, onDelete }: { items: QueryCondition[]; onDelete: (item: QueryCondition) => void }): React.JSX.Element {
  return <div>{items.map((item, index) => <div key={`${item.column.table}-${item.column.column}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>{index ? `${item.connector ?? 'AND'} ` : ''}{item.column.table}.{item.column.column} {item.operator} {String(item.value ?? '')}<button onClick={() => onDelete(item)}>×</button></div>)}</div>
}

function formatCell(value: unknown): string { return value === null ? 'NULL' : value instanceof Date ? value.toISOString() : String(value ?? '') }
