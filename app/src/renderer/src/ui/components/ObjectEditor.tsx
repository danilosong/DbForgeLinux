import { useEffect, useMemo, useState } from 'react'
import Editor from './MonacoEditor.js'
import type { ObjectEditorTarget } from '../../../../shared/contracts/object-editors.js'
import type { ColumnModel, IndexModel, TableModel } from '../../../../modules/schema/model.js'
import { quoteIdentifier } from '../../../../modules/schema/index.js'
import { buildObjectTemplate, buildRoutineTemplate, buildTableDdlPreview, type RoutineOptions } from '../../../../modules/object-editors/index.js'
import { Button } from './Button'
import { ResultGrid } from './ResultGrid'
import type { QueryResult } from '../../../../shared/contracts/sql.js'
import { useI18n } from '../i18n/useI18n.js'

type TablePage = 'General' | 'Columns' | 'Constraints' | 'Indexes' | 'Options' | 'Triggers' | 'Partitioning' | 'Data' | 'SQL'
interface Props { target: ObjectEditorTarget; isNew: boolean; isProduction?: boolean; autoCommit?: boolean; transactionRevision?: number; transactionCommitted?: boolean; onApplied(): void; onScript(sql: string, label: string): void }

const blankColumn = (index: number): ColumnModel => ({ name: `column_${index}`, type: 'VARCHAR(100)', nullable: true })
const blankTable = (name: string): TableModel => ({ kind: 'table', name, columns: [{ name: 'id', type: 'INT', nullable: false, autoIncrement: true }, { name: 'name', type: 'VARCHAR(100)', nullable: true }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: [], engine: 'InnoDB', charset: 'utf8mb4', comment: '' })
const defaultRoutineOptions: RoutineOptions = { definer: 'CURRENT_USER', sqlAccess: 'CONTAINS SQL', deterministic: false, parameters: [] }

export function ObjectEditor({ target, isNew, isProduction, autoCommit = true, transactionRevision = 0, transactionCommitted = true, onApplied, onScript }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [loading, setLoading] = useState(!isNew)
  const [page, setPage] = useState<TablePage>('Columns')
  const [original, setOriginal] = useState<TableModel | null>(null)
  const [table, setTable] = useState<TableModel | null>(target.kind === 'table' && isNew ? blankTable(target.name) : null)
  const [routineOptions, setRoutineOptions] = useState<RoutineOptions>(defaultRoutineOptions)
  const [sql, setSql] = useState(isNew && target.kind !== 'table' ? (target.kind === 'procedure' || target.kind === 'function' ? buildRoutineTemplate(target, defaultRoutineOptions) : buildObjectTemplate(target)) : '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [objectPage, setObjectPage] = useState<'General' | 'SQL'>('General')
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [dataResult, setDataResult] = useState<QueryResult>()
  const [dataBusy, setDataBusy] = useState(false)
  const existing = isNew ? !created : true

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setLoading(true)
    void window.dbforge.loadObjectEditor(target).then((object) => {
      if (cancelled) return
      if (object.kind === 'table') { const tableObject = object as TableModel; setOriginal(tableObject); setTable(structuredClone(tableObject)) }
      setSql(object.createSql ?? ('definition' in object ? String(object.definition) : ''))
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a definição do objeto.')).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [target, isNew])

  const preview = useMemo(() => {
    if (target.kind !== 'table' || !table) return sql
    try { return buildTableDdlPreview(table, existing ? original : null, target.database) }
    catch (reason) { return reason instanceof Error ? reason.message : 'DDL indisponível.' }
  }, [target.kind, target.database, table, original, existing, sql])

  async function refreshObject(): Promise<void> {
    if (isNew) { setTable(blankTable(target.name)); return }
    setBusy(true); setError('')
    try { const object = await window.dbforge.loadObjectEditor(target); if (object.kind === 'table') { const loaded = object as TableModel; setOriginal(structuredClone(loaded)); setTable(structuredClone(loaded)) } setMessage('Object refreshed.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not refresh object.') } finally { setBusy(false) }
  }

  async function loadTableData(): Promise<void> {
    if (!table) return
    setDataBusy(true); setError('')
    try { const results = await window.dbforge.executeSql(target.connectionId, `SELECT * FROM ${quoteIdentifier(target.database)}.${quoteIdentifier(table.name)} LIMIT 500`, undefined, target.database); setDataResult(results.find((item) => item.columns.length)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load table data.') } finally { setDataBusy(false) }
  }

  function updateColumn(index: number, change: Partial<ColumnModel>): void {
    setTable((current) => current ? { ...current, columns: current.columns.map((column, row) => row === index ? { ...column, ...change } : column) } : current)
  }

  function updateIndex(index: number, change: Partial<IndexModel>): void {
    setTable((current) => current ? { ...current, indexes: current.indexes.map((item, row) => row === index ? { ...item, ...change } : item) } : current)
  }

  function updateRoutineOptions(change: Partial<RoutineOptions>): void {
    const next = { ...routineOptions, ...change }
    setRoutineOptions(next)
    try { setSql(buildRoutineTemplate(target, next)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid routine options.') }
  }

  async function apply(): Promise<void> {
    if (busy) return
    setError(''); setMessage('')
    if (target.kind === 'table' && table) {
      const ddl = String(preview)
      if (!window.confirm(`${existing ? 'Apply Changes' : 'Create Table'}\n\n${ddl}`)) return
      if (isProduction && window.prompt(`Conexão de produção. Digite ${target.name} para confirmar.`) !== target.name) return
      setBusy(true)
      try {
        const applied = await window.dbforge.applyTableEditor(target.connectionId, target.database, original, table)
        setOriginal(structuredClone(table)); setCreated(true); setMessage(applied.length ? `Tabela ${table.name} atualizada.` : 'Sem alterações pendentes.'); onApplied()
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao aplicar alterações.') }
      finally { setBusy(false) }
      return
    }
    if (!window.confirm(`Apply ${target.kind} ${target.name}?\n\n${preview}`)) return
    if (isProduction && window.prompt(`Conexão de produção. Digite ${target.name} para confirmar.`) !== target.name) return
    setBusy(true)
    try { await window.dbforge.applyObjectEditor(target, sql); setCreated(true); setMessage(`${target.kind} ${target.name} atualizado.`); onApplied() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao aplicar a definição.') }
    finally { setBusy(false) }
  }

  async function queueTableChanges(): Promise<void> {
    if (!table || busy) return
    try { await window.dbforge.queueTableSchemaUpdate(target.connectionId, target.database, original, table); setMessage(t('extras.schema.added')) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not queue table changes.') }
  }

  async function execute(): Promise<void> {
    if (target.kind !== 'procedure' && target.kind !== 'function') return
    const parameters = window.prompt('Parâmetros SQL (separados por vírgula):', '')
    if (parameters === null) return
    const query = target.kind === 'procedure' ? `CALL ${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)}(${parameters})` : `SELECT ${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)}(${parameters}) AS result`
    if (!window.confirm(`Execute ${target.kind} ${target.name}?\n\n${query}`)) return
    setBusy(true)
    try { const result = await window.dbforge.executeSql(target.connectionId, query); setMessage(JSON.stringify(result.map((item) => item.rows.length ? item.rows : { affectedRows: item.affectedRows }), null, 2)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha na execução.') }
    finally { setBusy(false) }
  }

  function editBody(): React.JSX.Element {
    if (target.kind !== 'table') return <Editor height="100%" language="sql" value={sql} onChange={(value) => setSql(value ?? '')} theme={['dark', 'high-contrast'].includes(document.documentElement.dataset.theme ?? '') ? 'vs-dark' : 'vs'} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, lineNumbers: 'on' }} />
    if (!table) return <p>Carregando Table Designer…</p>
    if (page === 'General') return <div className="object-form-list"><label>Name<input value={table.name} onChange={(event) => setTable({ ...table, name: event.target.value })} /></label><label>Engine<input value={table.engine ?? ''} onChange={(event) => setTable({ ...table, engine: event.target.value })} /></label><label>Comment<textarea value={table.comment ?? ''} onChange={(event) => setTable({ ...table, comment: event.target.value })} /></label><p>{table.columns.length} columns · {table.indexes.length} indexes · {table.foreignKeys.length} foreign keys</p></div>
    if (page === 'Columns') return <div className="object-column-layout"><div className="object-grid-wrap"><table className="object-grid"><thead><tr><th>Name</th><th>Data Type</th><th>Allow Nulls</th><th>Auto Increment</th><th>Default</th><th>Comment</th><th /></tr></thead><tbody>{table.columns.map((column, index) => <tr key={`${index}:${column.name}`} className={selectedColumn === index ? 'selected-row' : ''} onClick={() => setSelectedColumn(index)}><td><input aria-label={`Column ${index + 1} name`} value={column.name} onChange={(event) => updateColumn(index, { name: event.target.value })} /></td><td><input aria-label={`Column ${column.name} type`} value={column.type} onChange={(event) => updateColumn(index, { type: event.target.value })} /></td><td><input aria-label={`Allow Nulls ${column.name}`} type="checkbox" checked={column.nullable} onChange={(event) => updateColumn(index, { nullable: event.target.checked })} /></td><td><input aria-label={`Auto Increment ${column.name}`} type="checkbox" checked={Boolean(column.autoIncrement)} onChange={(event) => updateColumn(index, { autoIncrement: event.target.checked, nullable: event.target.checked ? false : column.nullable })} /></td><td><input aria-label={`Default ${column.name}`} value={column.default == null ? '' : String(column.default)} onChange={(event) => updateColumn(index, { default: event.target.value || undefined })} /></td><td><input aria-label={`Comment ${column.name}`} value={column.comment ?? ''} onChange={(event) => updateColumn(index, { comment: event.target.value })} /></td><td><Button title={`Delete ${column.name}`} onClick={() => setTable({ ...table, columns: table.columns.filter((_, row) => row !== index), indexes: table.indexes.map((item) => ({ ...item, columns: item.columns.filter((part) => part.name !== column.name) })) })}>×</Button></td></tr>)}</tbody></table><Button onClick={() => { setTable({ ...table, columns: [...table.columns, blankColumn(table.columns.length + 1)] }); setSelectedColumn(table.columns.length) }}>Add Column</Button><Button onClick={() => { const primary = table.indexes.findIndex((item) => item.kind === 'PRIMARY'); const index: IndexModel = { name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: table.columns[0]?.name ?? '' }] }; setTable({ ...table, indexes: primary < 0 ? [...table.indexes, index] : table.indexes.map((item, row) => row === primary ? index : item), columns: table.columns.map((column, row) => row === 0 ? { ...column, nullable: false } : column) }) }}>Add Primary Key</Button></div><aside className="column-properties"><strong>{t('td.column.properties')}</strong>{table.columns[selectedColumn] ? <><label>Name<input value={table.columns[selectedColumn].name} onChange={(event) => updateColumn(selectedColumn, { name: event.target.value })} /></label><label>Data type<input value={table.columns[selectedColumn].type} onChange={(event) => updateColumn(selectedColumn, { type: event.target.value })} /></label><label><input type="checkbox" checked={!table.columns[selectedColumn].nullable} onChange={(event) => updateColumn(selectedColumn, { nullable: !event.target.checked })} /> NOT NULL</label><label>Default<input value={table.columns[selectedColumn].default == null ? '' : String(table.columns[selectedColumn].default)} onChange={(event) => updateColumn(selectedColumn, { default: event.target.value || undefined })} /></label></> : <span>Select a column</span>}</aside></div>
    if (page === 'Triggers') return <div className="object-form-list"><h3>Table triggers</h3><p>Trigger definitions are managed as separate database objects in the explorer.</p></div>
    if (page === 'Data') return <div className="table-data-page"><div className="data-page-toolbar"><Button onClick={() => void loadTableData()} disabled={dataBusy}>{dataBusy ? t('common.loading') : t('td.data.refresh')}</Button><span>{t('td.data.record', ['1', dataResult?.rowCount ?? dataResult?.rows.length ?? 0])}</span></div>{dataResult ? <ResultGrid result={dataResult} index={0} currentConnection={{ id: target.connectionId, database: target.database }} autoCommit={autoCommit} transactionRevision={transactionRevision} transactionCommitted={transactionCommitted} columnTypes={Object.fromEntries((dataResult.editable?.columns ?? []).map((column) => [column.name, column.dataType]))} nullLabel="(null)" /> : <p>{t('td.data.empty')}</p>}</div>
    if (page === 'Indexes') return <div className="object-form-list">{table.indexes.map((index, row) => <fieldset key={`${row}:${index.name}`}><legend>{index.kind}</legend><label>Name<input value={index.name} disabled={index.kind === 'PRIMARY'} onChange={(event) => updateIndex(row, { name: event.target.value })} /></label><label>Type<select value={index.kind} disabled={index.kind === 'PRIMARY'} onChange={(event) => updateIndex(row, { kind: event.target.value as IndexModel['kind'] })}>{['INDEX', 'UNIQUE', 'FULLTEXT', 'SPATIAL'].map((kind) => <option key={kind}>{kind}</option>)}</select></label><label>Columns<input value={index.columns.map((part) => part.name).join(', ')} onChange={(event) => updateIndex(row, { columns: event.target.value.split(',').map((name) => ({ name: name.trim() })).filter((part) => part.name) })} /></label>{index.kind !== 'PRIMARY' && <Button onClick={() => setTable({ ...table, indexes: table.indexes.filter((_, i) => i !== row) })}>Remove Index</Button>}</fieldset>)}<Button onClick={() => setTable({ ...table, indexes: [...table.indexes, { name: `idx_${table.name}_${table.indexes.length + 1}`, kind: 'INDEX', columns: table.columns[0] ? [{ name: table.columns[0].name }] : [] }] })}>Add Index</Button><Button onClick={() => setTable({ ...table, indexes: [...table.indexes, { name: `uq_${table.name}_${table.indexes.length + 1}`, kind: 'UNIQUE', columns: table.columns[0] ? [{ name: table.columns[0].name }] : [] }] })}>Add Unique Key</Button></div>
    if (page === 'Constraints') return <div className="object-form-list"><h3>Foreign keys</h3>{table.foreignKeys.map((fk, row) => <fieldset key={`${row}:${fk.name}`}><legend>{fk.name}</legend><label>Name<input value={fk.name} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, name: event.target.value } : item) })} /></label><label>Columns<input value={fk.columns.join(', ')} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, columns: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) } : item) })} /></label><label>Referenced Table<input value={fk.referencedTable} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, referencedTable: event.target.value } : item) })} /></label><label>Referenced Columns<input value={fk.referencedColumns.join(', ')} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, referencedColumns: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) } : item) })} /></label><label>ON DELETE<select value={fk.onDelete ?? 'RESTRICT'} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, onDelete: event.target.value } : item) })}>{['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'].map((value) => <option key={value}>{value}</option>)}</select></label><Button onClick={() => setTable({ ...table, foreignKeys: table.foreignKeys.filter((_, i) => i !== row) })}>Remove Foreign Key</Button></fieldset>)}<Button onClick={() => setTable({ ...table, foreignKeys: [...table.foreignKeys, { name: `fk_${table.name}_${table.foreignKeys.length + 1}`, columns: [table.columns[0]?.name ?? ''], referencedTable: '', referencedColumns: ['id'], referencedDatabase: target.database, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' }] })}>Add Foreign Key</Button><h3>Check constraints</h3>{table.checks?.length ? table.checks.map((check, index) => <p key={index}>{check.name}: {check.expression}</p>) : <p>No check constraints.</p>}</div>
    if (page === 'Options') return <div className="object-form-list"><label>Engine<input value={table.engine ?? ''} onChange={(event) => setTable({ ...table, engine: event.target.value })} /></label><label>Character set<input value={table.charset ?? ''} onChange={(event) => setTable({ ...table, charset: event.target.value })} /></label><label>Collation<input value={table.collation ?? ''} onChange={(event) => setTable({ ...table, collation: event.target.value })} /></label><label>Comment<textarea value={table.comment ?? ''} onChange={(event) => setTable({ ...table, comment: event.target.value })} /></label><label>Auto increment initial<input type="number" min="1" value={table.options?.AUTO_INCREMENT ?? ''} onChange={(event) => setTable({ ...table, options: { ...table.options, ...(event.target.value ? { AUTO_INCREMENT: event.target.value } : {}) } })} /></label></div>
    if (page === 'Partitioning') return <div className="object-form-list"><label>Partition by<select value={table.partitioning?.method ?? ''} onChange={(event) => setTable({ ...table, partitioning: event.target.value ? { method: event.target.value as NonNullable<TableModel['partitioning']>['method'], expression: table.partitioning?.expression ?? '', definitions: table.partitioning?.definitions ?? [] } : undefined })}><option value="">None</option>{['RANGE', 'LIST', 'HASH', 'KEY', 'LINEAR HASH', 'LINEAR KEY'].map((method) => <option key={method}>{method}</option>)}</select></label><label>Expression<input value={table.partitioning?.expression ?? ''} onChange={(event) => setTable({ ...table, partitioning: table.partitioning ? { ...table.partitioning, expression: event.target.value } : undefined })} placeholder="YEAR(created_at)" /></label><label>Partition definitions (one per line: name: value)<textarea value={(table.partitioning?.definitions ?? []).map((part) => `${part.name}: ${part.value ?? ''}`).join('\n')} onChange={(event) => setTable({ ...table, partitioning: table.partitioning ? { ...table.partitioning, definitions: event.target.value.split('\n').filter(Boolean).map((line) => { const [name, ...rest] = line.split(':'); return { name: name.trim(), value: rest.join(':').trim() } }) } : undefined })} /></label><small>For RANGE use values less than; for LIST enter a comma-separated value list.</small></div>
    return <pre className="object-ddl-preview">{String(preview)}</pre>
  }

  if (loading) return <div className="object-editor-state">Loading {target.kind} {target.name}…</div>
  return <section className="object-editor" aria-label={`${target.kind} editor`}>
    <div className="object-editor-toolbar"><strong>{target.kind === 'table' ? 'Table Designer' : `${target.kind[0]?.toUpperCase()}${target.kind.slice(1)} Editor`} · {target.name}</strong><span className="toolbar-spacer" />{target.kind === 'table' && <Button onClick={() => void queueTableChanges()} disabled={busy}>{t('extras.schema.queue')}</Button>}{target.kind !== 'table' && <Button onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Edit Definition' : 'Preview DDL'}</Button>}<Button onClick={() => onScript(String(preview), `${target.kind} · ${target.name}`)}>{t('td.script')}</Button><Button onClick={() => { if (target.kind === 'table') setTable(original ? structuredClone(original) : blankTable(target.name)); else { setRoutineOptions(defaultRoutineOptions); setSql(target.kind === 'procedure' || target.kind === 'function' ? buildRoutineTemplate(target, defaultRoutineOptions) : buildObjectTemplate(target)) } setError(''); setMessage('') }}>Discard Changes</Button>{(target.kind === 'procedure' || target.kind === 'function') && <Button onClick={() => void execute()} disabled={busy}>Execute / Test</Button>}<Button variant="primary" onClick={() => void apply()} disabled={busy}>{busy ? 'Applying…' : target.kind === 'table' && !existing ? 'Create Table' : 'Apply Changes'}</Button></div>
    {error && <div className="object-editor-message error" role="alert">{error}</div>}{message && <div className="object-editor-message" aria-live="polite">{message}</div>}
    {target.kind === 'table' ? <><div className="object-editor-layout"><nav className="object-editor-nav" aria-label="Table Designer pages">{(['General', 'Columns', 'Constraints', 'Indexes', 'Options', 'Triggers', 'Partitioning', 'Data', 'SQL'] as TablePage[]).map((name) => <button key={name} className={page === name ? 'selected' : ''} onClick={() => setPage(name)}>{t(`td.page.${name.toLowerCase()}`)}</button>)}</nav><div className="object-editor-content">{editBody()}</div></div><section className="object-editor-preview"><strong>{t('td.ddl.preview')}</strong><pre>{String(preview)}</pre></section><div className="object-editor-footer"><Button onClick={() => void refreshObject()} disabled={busy}>{t('td.refresh')}</Button><span className="toolbar-spacer" /><span>{original ? 'Pending changes are generated with schema diff.' : 'Create mode'}</span></div></> : <>{isNew && (target.kind === 'procedure' || target.kind === 'function') && <nav className="object-editor-nav object-editor-pages" aria-label="Routine pages"><button className={objectPage === 'General' ? 'selected' : ''} onClick={() => setObjectPage('General')}>{t('objectEditor.general')}</button><button className={objectPage === 'SQL' ? 'selected' : ''} onClick={() => setObjectPage('SQL')}>{t('objectEditor.sql')}</button></nav>}{isNew && (target.kind === 'procedure' || target.kind === 'function') && objectPage === 'General' ? <div className="object-form-list routine-general"><label>{t('objectEditor.definer')}<input value={routineOptions.definer} onChange={(event) => updateRoutineOptions({ definer: event.target.value })} /></label><label>{t('objectEditor.sqlAccess')}<select value={routineOptions.sqlAccess} onChange={(event) => updateRoutineOptions({ sqlAccess: event.target.value as RoutineOptions['sqlAccess'] })}>{['CONTAINS SQL', 'NO SQL', 'READS SQL DATA', 'MODIFIES SQL DATA'].map((value) => <option key={value}>{value}</option>)}</select></label>{target.kind === 'function' && <label><input type="checkbox" checked={routineOptions.deterministic} onChange={(event) => updateRoutineOptions({ deterministic: event.target.checked })} />{t('objectEditor.deterministic')}</label>}<fieldset><legend>{t('objectEditor.parameters')}</legend><table><thead><tr><th>{t('objectEditor.mode')}</th><th>{t('objectEditor.name')}</th><th>{t('objectEditor.type')}</th><th /></tr></thead><tbody>{routineOptions.parameters.map((parameter, index) => <tr key={index}><td><select aria-label={`${t('objectEditor.mode')} ${index + 1}`} value={parameter.mode} onChange={(event) => updateRoutineOptions({ parameters: routineOptions.parameters.map((item, row) => row === index ? { ...item, mode: event.target.value as typeof item.mode } : item) })}>{(target.kind === 'function' ? ['IN'] : ['IN', 'OUT', 'INOUT']).map((value) => <option key={value}>{value}</option>)}</select></td><td><input aria-label={`${t('objectEditor.name')} ${index + 1}`} value={parameter.name} onChange={(event) => updateRoutineOptions({ parameters: routineOptions.parameters.map((item, row) => row === index ? { ...item, name: event.target.value } : item) })} /></td><td><input aria-label={`${t('objectEditor.type')} ${index + 1}`} value={parameter.type} onChange={(event) => updateRoutineOptions({ parameters: routineOptions.parameters.map((item, row) => row === index ? { ...item, type: event.target.value } : item) })} /></td><td><Button onClick={() => updateRoutineOptions({ parameters: routineOptions.parameters.filter((_, row) => row !== index) })}>{t('objectEditor.remove')}</Button></td></tr>)}</tbody></table><Button onClick={() => updateRoutineOptions({ parameters: [...routineOptions.parameters, { name: `param_${routineOptions.parameters.length + 1}`, mode: 'IN', type: 'INT' }] })}>{t('objectEditor.addParameter')}</Button></fieldset></div> : <div className="object-editor-code">{showPreview ? <pre className="object-ddl-preview">{sql}</pre> : <Editor height="100%" language="sql" value={sql} onChange={(value) => setSql(value ?? '')} theme={['dark', 'high-contrast'].includes(document.documentElement.dataset.theme ?? '') ? 'vs-dark' : 'vs'} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, lineNumbers: 'on' }} />}</div>}<section className="object-editor-preview"><strong>{t('td.ddl.preview')}</strong><pre>{sql}</pre></section><div className="object-editor-footer"><Button onClick={() => void navigator.clipboard.writeText(sql)}>Copy DDL</Button><span>{showPreview ? 'Read-only preview' : `Definition editor · ${target.kind}`}</span></div></>}
  </section>
}
