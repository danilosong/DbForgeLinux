import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { ObjectEditorTarget } from '../../../../shared/contracts/object-editors.js'
import type { ColumnModel, IndexModel, TableModel } from '../../../../modules/schema/model.js'
import { quoteIdentifier } from '../../../../modules/schema/index.js'
import { buildObjectTemplate, buildTableDdlPreview } from '../../../../modules/object-editors/index.js'
import { Button } from './Button'

type TablePage = 'Columns' | 'Indexes' | 'Foreign Keys' | 'Options' | 'Partitions' | 'DDL'
interface Props { target: ObjectEditorTarget; isNew: boolean; isProduction?: boolean; onApplied(): void }

const blankColumn = (index: number): ColumnModel => ({ name: `column_${index}`, type: 'VARCHAR(100)', nullable: true })
const blankTable = (name: string): TableModel => ({ kind: 'table', name, columns: [{ name: 'id', type: 'INT', nullable: false, autoIncrement: true }, { name: 'name', type: 'VARCHAR(100)', nullable: true }], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }], foreignKeys: [], checks: [], engine: 'InnoDB', charset: 'utf8mb4', comment: '' })

export function ObjectEditor({ target, isNew, isProduction, onApplied }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(!isNew)
  const [page, setPage] = useState<TablePage>('Columns')
  const [original, setOriginal] = useState<TableModel | null>(null)
  const [table, setTable] = useState<TableModel | null>(target.kind === 'table' && isNew ? blankTable(target.name) : null)
  const [sql, setSql] = useState(isNew && target.kind !== 'table' ? buildObjectTemplate(target) : '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
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

  function updateColumn(index: number, change: Partial<ColumnModel>): void {
    setTable((current) => current ? { ...current, columns: current.columns.map((column, row) => row === index ? { ...column, ...change } : column) } : current)
  }

  function updateIndex(index: number, change: Partial<IndexModel>): void {
    setTable((current) => current ? { ...current, indexes: current.indexes.map((item, row) => row === index ? { ...item, ...change } : item) } : current)
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
    if (target.kind !== 'table') return <Editor height="100%" language="sql" value={sql} onChange={(value) => setSql(value ?? '')} theme={document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, lineNumbers: 'on' }} />
    if (!table) return <p>Carregando Table Designer…</p>
    if (page === 'Columns') return <div className="object-grid-wrap"><table className="object-grid"><thead><tr><th>Name</th><th>Data Type</th><th>Allow Nulls</th><th>Auto Increment</th><th>Default</th><th>Comment</th><th /></tr></thead><tbody>{table.columns.map((column, index) => <tr key={`${index}:${column.name}`}><td><input aria-label={`Column ${index + 1} name`} value={column.name} onChange={(event) => updateColumn(index, { name: event.target.value })} /></td><td><input aria-label={`Column ${column.name} type`} value={column.type} onChange={(event) => updateColumn(index, { type: event.target.value })} /></td><td><input aria-label={`Allow Nulls ${column.name}`} type="checkbox" checked={column.nullable} onChange={(event) => updateColumn(index, { nullable: event.target.checked })} /></td><td><input aria-label={`Auto Increment ${column.name}`} type="checkbox" checked={Boolean(column.autoIncrement)} onChange={(event) => updateColumn(index, { autoIncrement: event.target.checked, nullable: event.target.checked ? false : column.nullable })} /></td><td><input aria-label={`Default ${column.name}`} value={column.default == null ? '' : String(column.default)} onChange={(event) => updateColumn(index, { default: event.target.value || undefined })} /></td><td><input aria-label={`Comment ${column.name}`} value={column.comment ?? ''} onChange={(event) => updateColumn(index, { comment: event.target.value })} /></td><td><Button title={`Delete ${column.name}`} onClick={() => setTable({ ...table, columns: table.columns.filter((_, row) => row !== index), indexes: table.indexes.map((item) => ({ ...item, columns: item.columns.filter((part) => part.name !== column.name) })) })}>×</Button></td></tr>)}</tbody></table><Button onClick={() => setTable({ ...table, columns: [...table.columns, blankColumn(table.columns.length + 1)] })}>Add Column</Button><Button onClick={() => { const primary = table.indexes.findIndex((item) => item.kind === 'PRIMARY'); const index: IndexModel = { name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: table.columns[0]?.name ?? '' }] }; setTable({ ...table, indexes: primary < 0 ? [...table.indexes, index] : table.indexes.map((item, row) => row === primary ? index : item), columns: table.columns.map((column, row) => row === 0 ? { ...column, nullable: false } : column) }) }}>Add Primary Key</Button></div>
    if (page === 'Indexes') return <div className="object-form-list">{table.indexes.map((index, row) => <fieldset key={`${row}:${index.name}`}><legend>{index.kind}</legend><label>Name<input value={index.name} disabled={index.kind === 'PRIMARY'} onChange={(event) => updateIndex(row, { name: event.target.value })} /></label><label>Type<select value={index.kind} disabled={index.kind === 'PRIMARY'} onChange={(event) => updateIndex(row, { kind: event.target.value as IndexModel['kind'] })}>{['INDEX', 'UNIQUE', 'FULLTEXT', 'SPATIAL'].map((kind) => <option key={kind}>{kind}</option>)}</select></label><label>Columns<input value={index.columns.map((part) => part.name).join(', ')} onChange={(event) => updateIndex(row, { columns: event.target.value.split(',').map((name) => ({ name: name.trim() })).filter((part) => part.name) })} /></label>{index.kind !== 'PRIMARY' && <Button onClick={() => setTable({ ...table, indexes: table.indexes.filter((_, i) => i !== row) })}>Remove Index</Button>}</fieldset>)}<Button onClick={() => setTable({ ...table, indexes: [...table.indexes, { name: `idx_${table.name}_${table.indexes.length + 1}`, kind: 'INDEX', columns: table.columns[0] ? [{ name: table.columns[0].name }] : [] }] })}>Add Index</Button><Button onClick={() => setTable({ ...table, indexes: [...table.indexes, { name: `uq_${table.name}_${table.indexes.length + 1}`, kind: 'UNIQUE', columns: table.columns[0] ? [{ name: table.columns[0].name }] : [] }] })}>Add Unique Key</Button></div>
    if (page === 'Foreign Keys') return <div className="object-form-list">{table.foreignKeys.map((fk, row) => <fieldset key={`${row}:${fk.name}`}><legend>{fk.name}</legend><label>Name<input value={fk.name} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, name: event.target.value } : item) })} /></label><label>Columns<input value={fk.columns.join(', ')} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, columns: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) } : item) })} /></label><label>Referenced Table<input value={fk.referencedTable} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, referencedTable: event.target.value } : item) })} /></label><label>Referenced Columns<input value={fk.referencedColumns.join(', ')} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, referencedColumns: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) } : item) })} /></label><label>ON DELETE<select value={fk.onDelete ?? 'RESTRICT'} onChange={(event) => setTable({ ...table, foreignKeys: table.foreignKeys.map((item, i) => i === row ? { ...item, onDelete: event.target.value } : item) })}>{['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'].map((value) => <option key={value}>{value}</option>)}</select></label><Button onClick={() => setTable({ ...table, foreignKeys: table.foreignKeys.filter((_, i) => i !== row) })}>Remove Foreign Key</Button></fieldset>)}<Button onClick={() => setTable({ ...table, foreignKeys: [...table.foreignKeys, { name: `fk_${table.name}_${table.foreignKeys.length + 1}`, columns: [table.columns[0]?.name ?? ''], referencedTable: '', referencedColumns: ['id'], referencedDatabase: target.database, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' }] })}>Add Foreign Key</Button></div>
    if (page === 'Options') return <div className="object-form-list"><label>Engine<input value={table.engine ?? ''} onChange={(event) => setTable({ ...table, engine: event.target.value })} /></label><label>Character set<input value={table.charset ?? ''} onChange={(event) => setTable({ ...table, charset: event.target.value })} /></label><label>Collation<input value={table.collation ?? ''} onChange={(event) => setTable({ ...table, collation: event.target.value })} /></label><label>Comment<textarea value={table.comment ?? ''} onChange={(event) => setTable({ ...table, comment: event.target.value })} /></label><label>Auto increment initial<input type="number" min="1" value={table.options?.AUTO_INCREMENT ?? ''} onChange={(event) => setTable({ ...table, options: { ...table.options, ...(event.target.value ? { AUTO_INCREMENT: event.target.value } : {}) } })} /></label></div>
    if (page === 'Partitions') return <div className="object-form-list"><label>Partition by<select value={table.partitioning?.method ?? ''} onChange={(event) => setTable({ ...table, partitioning: event.target.value ? { method: event.target.value as NonNullable<TableModel['partitioning']>['method'], expression: table.partitioning?.expression ?? '', definitions: table.partitioning?.definitions ?? [] } : undefined })}><option value="">None</option>{['RANGE', 'LIST', 'HASH', 'KEY', 'LINEAR HASH', 'LINEAR KEY'].map((method) => <option key={method}>{method}</option>)}</select></label><label>Expression<input value={table.partitioning?.expression ?? ''} onChange={(event) => setTable({ ...table, partitioning: table.partitioning ? { ...table.partitioning, expression: event.target.value } : undefined })} placeholder="YEAR(created_at)" /></label><label>Partition definitions (one per line: name: value)<textarea value={(table.partitioning?.definitions ?? []).map((part) => `${part.name}: ${part.value ?? ''}`).join('\n')} onChange={(event) => setTable({ ...table, partitioning: table.partitioning ? { ...table.partitioning, definitions: event.target.value.split('\n').filter(Boolean).map((line) => { const [name, ...rest] = line.split(':'); return { name: name.trim(), value: rest.join(':').trim() } }) } : undefined })} /></label><small>For RANGE use values less than; for LIST enter a comma-separated value list.</small></div>
    return <pre className="object-ddl-preview">{String(preview)}</pre>
  }

  if (loading) return <div className="object-editor-state">Loading {target.kind} {target.name}…</div>
  return <section className="object-editor" aria-label={`${target.kind} editor`}>
    <div className="object-editor-toolbar"><strong>{target.kind === 'table' ? 'Table Designer' : `${target.kind[0]?.toUpperCase()}${target.kind.slice(1)} Editor`} · {target.name}</strong><span className="toolbar-spacer" />{target.kind !== 'table' && <Button onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Edit Definition' : 'Preview DDL'}</Button>}<Button onClick={() => { if (target.kind === 'table') setTable(original ? structuredClone(original) : blankTable(target.name)); else setSql(buildObjectTemplate(target)); setError(''); setMessage('') }}>Discard Changes</Button>{(target.kind === 'procedure' || target.kind === 'function') && <Button onClick={() => void execute()} disabled={busy}>Execute / Test</Button>}<Button variant="primary" onClick={() => void apply()} disabled={busy}>{busy ? 'Applying…' : target.kind === 'table' && !existing ? 'Create Table' : 'Apply Changes'}</Button></div>
    {error && <div className="object-editor-message error" role="alert">{error}</div>}{message && <div className="object-editor-message" aria-live="polite">{message}</div>}
    {target.kind === 'table' ? <><div className="object-editor-layout"><nav className="object-editor-nav" aria-label="Table Designer pages">{(['Columns', 'Indexes', 'Foreign Keys', 'Options', 'Partitions', 'DDL'] as TablePage[]).map((name) => <button key={name} className={page === name ? 'selected' : ''} onClick={() => setPage(name)}>{name}</button>)}</nav><div className="object-editor-content">{editBody()}</div><aside className="object-editor-preview"><strong>Preview DDL</strong><pre>{String(preview)}</pre></aside></div><div className="object-editor-footer"><Button onClick={() => void navigator.clipboard.writeText(String(preview))}>Copy SQL</Button><span>{original ? 'Pending changes are generated with schema diff.' : 'Create mode'}</span></div></> : <><div className="object-editor-code">{showPreview ? <pre className="object-ddl-preview">{sql}</pre> : <Editor height="100%" language="sql" value={sql} onChange={(value) => setSql(value ?? '')} theme={document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, lineNumbers: 'on' }} />}</div><div className="object-editor-footer"><Button onClick={() => void navigator.clipboard.writeText(sql)}>Copy DDL</Button><span>{showPreview ? 'Read-only preview' : `Definition editor · ${target.kind}`}</span></div></>}
  </section>
}
