import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import { usePanelConnection, usePanelNavigation } from '../registry.js'
import type { QueryResult } from '../../../../../shared/contracts/sql.js'
import type { MasterDetailRelation } from '../../../../../shared/contracts/grid-data.js'

type View = 'design' | 'data'
const quote = (value: string): string => `\`${value.replaceAll('`', '``')}\``

export default function MasterDetailPanel(): React.JSX.Element {
  const { t } = useI18n()
  const connection = usePanelConnection()
  const { selectedObject } = usePanelNavigation()
  const targetConnection = selectedObject?.connection ?? connection
  const [tables, setTables] = useState<string[]>([])
  const [table, setTable] = useState('')
  const [fetchLimit, setFetchLimit] = useState(100)
  const [where, setWhere] = useState('')
  const [orderBy, setOrderBy] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)
  const [details, setDetails] = useState<MasterDetailRelation[]>([])
  const [view, setView] = useState<View>('design')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const database = selectedObject?.database ?? targetConnection?.database ?? ''
  const columns = useMemo(() => result?.columns ?? [], [result])
  const visibleColumns = useMemo(() => columns.filter((column) => selectedColumns.includes(column)), [columns, selectedColumns])

  useEffect(() => {
    if (!targetConnection || !database) { setTables([]); return }
    void window.tuxsql.listTables(targetConnection.id, database).then((items) => { setTables(items); setTable(selectedObject?.object.kind === 'table' && items.includes(selectedObject.object.name) ? selectedObject.object.name : items[0] || '') }).catch((error: unknown) => setMessage(errorText(error)))
  }, [targetConnection, database, selectedObject?.object.name, selectedObject?.object.kind])

  async function fetchMaster(): Promise<void> {
    if (!targetConnection || !database || !table) { setMessage(t('md.selectMaster')); return }
    const limit = Math.max(1, Math.min(5000, Math.trunc(fetchLimit) || 100))
    const projection = selectedColumns.length && result?.columns.length ? selectedColumns.map(quote).join(', ') : '*'
    const whereClause = where.trim() ? ` WHERE ${where.trim()}` : ''
    const orderClause = orderBy ? ` ORDER BY ${quote(orderBy)} ASC` : ''
    setBusy(true); setMessage(t('md.loading')); setDetails([]); setSelectedRow(null)
    try {
      const outputs = await window.tuxsql.executeSql(targetConnection.id, `SELECT ${projection} FROM ${quote(database)}.${quote(table)}${whereClause}${orderClause} LIMIT ${limit}`, crypto.randomUUID(), database)
      const query = outputs[0]
      if (!query) throw new Error(t('md.noData'))
      const loadedRows = query.resultStoreId ? await window.tuxsql.readResultRows(query.resultStoreId, 0, Math.min(limit, query.rowCount ?? limit)) : query.rows
      setResult(query); setRows(loadedRows); setSelectedColumns(query.columns); setMessage(t('md.loaded', [String(loadedRows.length)]))
    } catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }

  async function chooseMasterRow(row: Record<string, unknown>): Promise<void> {
    if (!targetConnection || !result?.editable) { setMessage(t('md.noPrimaryKey')); return }
    setSelectedRow(row); setBusy(true); setMessage(t('md.loadingDetails'))
    try { const relations = await window.tuxsql.loadMasterDetails(targetConnection.id, result.editable, row); setDetails(relations); setMessage(t('md.detailCount', [String(relations.length)])) }
    catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }

  function toggleColumn(column: string): void { setSelectedColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]) }

  return <section className="master-detail-panel">
    <header className="md-header"><div><h2>{t('md.browser')}</h2><p>{targetConnection?.name ?? t('md.noConnection')} · {database || t('md.noDatabase')}</p></div><div className="md-actions"><button disabled={!targetConnection || busy} onClick={() => void fetchMaster()}>{t('md.refresh')}</button><button disabled={!rows.length} onClick={() => setView('data')}>{t('md.browse')}</button><button disabled={!table} onClick={() => { setView('data'); void fetchMaster() }}>{t('md.setMaster')}</button></div></header>
    <div className="md-toolbar"><label>{t('md.master')} <select value={table} onChange={(event) => { setTable(event.target.value); setResult(null); setRows([]); setSelectedColumns([]) }}>{tables.map((item) => <option key={item}>{item}</option>)}</select></label><label>{t('md.fetchLimit')} <input type="number" min={1} max={5000} value={fetchLimit} onChange={(event) => setFetchLimit(Number(event.target.value))} /></label><label className="md-where">{t('md.where')} <input value={where} onChange={(event) => setWhere(event.target.value)} placeholder="status = 'active'" /></label><button disabled={!result?.columns.length} onClick={() => setOrderBy(columns.find((item) => item !== orderBy) ?? '')}>{t('md.sortAscending')}</button></div>
    {columns.length > 0 && <details className="md-column-picker"><summary>{t('md.columns')} ({selectedColumns.length}/{columns.length})</summary><button onClick={() => setSelectedColumns(columns)}>{t('md.selectAll')}</button><button onClick={() => setSelectedColumns([])}>{t('md.unselectAll')}</button>{columns.map((column) => <label key={column}><input type="checkbox" checked={selectedColumns.includes(column)} onChange={() => toggleColumn(column)} />{column}</label>)}</details>}
    <div className="md-view-switch"><button aria-pressed={view === 'design'} onClick={() => setView('design')}>{t('md.design')}</button><button aria-pressed={view === 'data'} onClick={() => setView('data')}>{t('md.data')}</button></div>
    {view === 'design' ? <div className="md-canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const name = event.dataTransfer.getData('text/plain'); if (tables.includes(name)) { setTable(name); setMessage(t('md.masterSelected', [name])) } }}><p>{t('md.dragExplorer')}</p><article><strong>{table || t('md.noMaster')}</strong><small>{columns.join(' · ') || t('md.fetchDesign')}</small></article><div className="md-relations">{details.map((relation) => <article key={`${relation.table}:${relation.name}`}><strong>{relation.table}</strong><small>{relation.name} · {relation.rows.length}{relation.truncated ? '+' : ''} {t('md.rows')}</small></article>)}</div></div> : <div className="md-data-view"><div className="md-grid-wrap"><table><thead><tr><th>{t('md.row')}</th>{visibleColumns.map((column) => <th key={column} onClick={() => setOrderBy(column)}>{column}{orderBy === column ? ' ↑' : ''}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className={selectedRow === row ? 'selected' : ''} onClick={() => void chooseMasterRow(row)}><th>{index + 1}</th>{visibleColumns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}</tr>)}</tbody></table>{!rows.length && <p>{t('md.empty')}</p>}</div><aside><h3>{t('md.related')}</h3>{details.map((relation) => <section key={`${relation.table}:${relation.name}`}><strong>{relation.table}</strong><small>{relation.name}{relation.truncated ? ' · …' : ''}</small>{relation.rows.length ? <div className="md-grid-wrap"><table><thead><tr>{Object.keys(relation.rows[0] ?? {}).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{relation.rows.map((row, index) => <tr key={index}>{Object.keys(relation.rows[0] ?? {}).map((column) => <td key={column}>{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div> : <p>{t('md.noRelatedRows')}</p>}</section>)}</aside></div>}
    <p role="status" className="md-status">{busy ? '◌ ' : ''}{message || t('md.emptyStatus')}</p>
    <style>{`.master-detail-panel{height:100%;display:flex;flex-direction:column;gap:8px;overflow:auto;color:var(--text)}.md-header,.md-actions,.md-toolbar,.md-view-switch{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.md-header{justify-content:space-between}.md-header h2{margin:0}.md-header p{margin:3px 0;color:var(--text-secondary)}.md-toolbar{padding:8px 0;border-block:1px solid var(--border)}.md-toolbar label{display:flex;align-items:center;gap:5px}.md-toolbar .md-where{flex:1}.md-where input{flex:1}.md-column-picker{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.md-column-picker summary{width:100%;cursor:pointer}.md-view-switch button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}.md-canvas{min-height:230px;flex:1;border:1px dashed var(--border);border-radius:5px;padding:14px;background:var(--bg-surface-alt)}.md-canvas>p{text-align:center;color:var(--text-secondary)}.md-canvas article,.md-relations article{display:inline-flex;flex-direction:column;gap:5px;padding:12px;margin:10px;border:1px solid var(--border);border-radius:5px;background:var(--bg-surface);min-width:170px}.md-canvas small,.md-data-view small{color:var(--text-secondary)}.md-relations{display:flex;flex-wrap:wrap;gap:12px}.md-data-view{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:10px;min-height:220px;flex:1}.md-data-view aside{overflow:auto;border:1px solid var(--border);border-radius:4px;padding:8px}.md-data-view aside section{margin-bottom:10px}.md-grid-wrap{overflow:auto;max-height:100%;border:1px solid var(--border)}.md-grid-wrap table{border-collapse:collapse;width:100%;font-size:12px}.md-grid-wrap th,.md-grid-wrap td{padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap;text-align:left}.md-grid-wrap th{position:sticky;top:0;background:var(--bg-surface-alt)}.md-grid-wrap tbody tr{cursor:pointer}.md-grid-wrap tbody tr.selected{background:var(--accent-soft)}.md-status{margin:0;color:var(--text-secondary)}`}</style>
  </section>
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Master-detail request failed.' }
function formatValue(value: unknown): string { return value == null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value) }
