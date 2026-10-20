import { useEffect, useMemo, useRef, useState } from 'react'
import type { QueryResult } from '../../../../shared/contracts'
import type { GridChange } from '../../../../modules/grid-editing/index.js'

const ROW_HEIGHT = 26
const OVERSCAN = 8

export function ResultGrid({ result, index, onLoadMore, fetchRows, currentConnection, autoCommit, transactionRevision, transactionCommitted }: { result: QueryResult; index: number; onLoadMore?(): Promise<void>; fetchRows?(offset: number, limit: number): Promise<Array<Record<string, unknown>>>; currentConnection?: { id: string }; autoCommit: boolean; transactionRevision: number; transactionCommitted: boolean }): React.JSX.Element {
  const [scrollTop, setScrollTop] = useState(0)
  const [sort, setSort] = useState<{ column: string; direction: 1 | -1 }>()
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [order, setOrder] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [selectedCell, setSelectedCell] = useState<{ row: number; column: string }>()
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [selectionAnchor, setSelectionAnchor] = useState<number>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [remoteRows, setRemoteRows] = useState<Map<number, Record<string, unknown>>>(() => new Map())
  const [pending, setPending] = useState<Map<number, GridChange>>(() => new Map())
  const [newRows, setNewRows] = useState<Array<Record<string, unknown>>>([])
  const [savedRows, setSavedRows] = useState<Map<number, Record<string, unknown>>>(() => new Map())
  const [savedInserts, setSavedInserts] = useState<Set<number>>(() => new Set())
  const [savedDeletes, setSavedDeletes] = useState<Set<number>>(() => new Set())
  const [editing, setEditing] = useState<{ row: number; column: string; value: string }>()
  const [preview, setPreview] = useState<Array<{ sql: string; values: unknown[] }> | null>(null)
  const [editError, setEditError] = useState('')
  const requested = useRef(new Set<number>())
  const lastTransactionRevision = useRef(transactionRevision)
  const visiblePage = useRef(0)
  const remote = Boolean(result.resultStoreId && fetchRows)
  const totalRows = (result.rowCount ?? result.rows.length) + savedInserts.size - savedDeletes.size
  const editable = result.editable?.keyColumns.length ? result.editable : undefined
  const changes = [...pending.values(), ...newRows.map((values) => ({ kind: 'insert' as const, values }))]
  const columns = order.length ? order : result.columns
  const rows = useMemo(() => {
    if (remote) return []
    const filtered = result.rows.filter((row) => {
      const matchesQuickFilter = !filter || columns.some((column) => display(row[column]).toLowerCase().includes(filter.toLowerCase()))
      const matchesColumnFilters = Object.entries(columnFilters).every(([column, value]) => !value || display(row[column]).toLowerCase().includes(value.toLowerCase()))
      return matchesQuickFilter && matchesColumnFilters
    })
    if (!sort) return filtered
    return [...filtered].sort((left, right) => compare(left[sort.column], right[sort.column]) * sort.direction)
  }, [result.rows, sort, filter, columns, columnFilters, remote])
  const visibleCount = Math.max(remote ? totalRows : rows.length + savedInserts.size - savedDeletes.size, ...[...savedRows.keys()].map((row) => row + 1), 0)
  const viewport = 500
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(visibleCount, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)

  useEffect(() => { requested.current.clear(); visiblePage.current = 0; setRemoteRows(new Map()) }, [result.resultStoreId])
  useEffect(() => { if (lastTransactionRevision.current === transactionRevision) return; lastTransactionRevision.current = transactionRevision; if (!transactionCommitted) { setSavedRows(new Map()); setSavedInserts(new Set()); setSavedDeletes(new Set()) } }, [transactionCommitted, transactionRevision])
  useEffect(() => {
    if (!remote || !fetchRows || last <= first) return
    const offset = Math.floor(first / 100) * 100
    visiblePage.current = offset
    if (requested.current.has(offset)) return
    requested.current.add(offset)
    void fetchRows(offset, 100).then((loaded) => {
      requested.current.delete(offset)
      if (visiblePage.current !== offset) return
      setRemoteRows(() => { const next = new Map<number, Record<string, unknown>>(); loaded.forEach((row, position) => next.set(offset + position, row)); return next })
    }).catch(() => requested.current.delete(offset))
  }, [remote, fetchRows, first, last])

  async function copy(value: unknown): Promise<void> { await navigator.clipboard.writeText(value === null ? 'NULL' : String(value)) }
  function rowAt(index: number): Record<string, unknown> | undefined { if (savedDeletes.has(index)) return undefined; return savedRows.get(index) ?? (remote ? remoteRows.get(index) : rows[index]) }
  function updateCell(rowIndex: number, column: string, raw: unknown): void {
    const row = rowAt(rowIndex); if (!row || !editable) return
    const value = raw === null ? null : parseEditedValue(raw, editable.columns.find((item) => item.name === column)?.dataType ?? '')
    const error = value === null && !editable.columns.find((item) => item.name === column)?.nullable ? `${column} cannot be NULL.` : undefined
    if (error) { setEditError(error); return }
    setEditError('')
    setPending((current) => {
      const existing = current.get(rowIndex)
      const original = existing?.kind === 'update' ? existing.original : row
      const values = { ...(existing?.kind === 'update' ? existing.values : row), [column]: value }
      const same = editable.columns.every((item) => Object.is(original[item.name], values[item.name]))
      const next = new Map(current)
      if (same) next.delete(rowIndex)
      else next.set(rowIndex, { kind: 'update', original, values })
      return next
    })
  }
  async function showPreview(): Promise<void> {
    if (!editable || !changes.length) return
    try { setPreview(await window.dbforge.previewGridChanges(editable, changes)) }
    catch (error) { setEditError(error instanceof Error ? error.message : 'Could not preview grid changes.') }
  }
  async function postChanges(): Promise<void> {
    if (!editable || !currentConnection || !changes.length) return
    try {
      const sql = await window.dbforge.previewGridChanges(editable, changes)
      setPreview(sql)
      if (!window.confirm(`Apply ${changes.length} pending row change(s)? The batch will use a transaction when auto-commit is enabled.`)) return
      const count = await window.dbforge.applyGridChanges(currentConnection.id, editable, changes, autoCommit)
      if (!autoCommit) { /* Document transaction remains open for the global Commit/Rollback actions. */ }
      setSavedRows((current) => { const next = new Map(current); for (const [rowIndex, change] of pending) if (change.kind === 'update') next.set(rowIndex, change.values); newRows.forEach((row, offset) => next.set((result.rowCount ?? result.rows.length) + offset, row)); return next })
      setSavedInserts((current) => { const next = new Set(current); newRows.forEach((_, offset) => next.add((result.rowCount ?? result.rows.length) + offset)); for (const [rowIndex, change] of pending) if (change.kind === 'delete') next.delete(rowIndex); return next })
      setSavedDeletes((current) => { const next = new Set(current); for (const [rowIndex, change] of pending) if (change.kind === 'delete' && !savedInserts.has(rowIndex) && !(rowIndex >= (result.rowCount ?? result.rows.length) && rowIndex < (result.rowCount ?? result.rows.length) + newRows.length)) next.add(rowIndex); return next })
      setPending(new Map()); setNewRows([]); setEditError(''); setPreview(null)
      if (count.updated + count.inserted + count.deleted) setEditError(`${count.updated} updated, ${count.inserted} inserted, ${count.deleted} deleted.`)
    } catch (error) { setEditError(error instanceof Error ? error.message : 'Could not apply grid changes.') }
  }
  function deleteSelected(): void {
    if (!editable) return
    setPending((current) => { const next = new Map(current); for (const index of selectedRows) { const row = rowAt(index); if (!row) continue; next.set(index, { kind: 'delete', original: row }) } return next })
  }
  function insertRow(): void { if (editable) setNewRows((current) => [...current, {}]) }
  function cancelChanges(): void { setPending(new Map()); setNewRows([]); setEditing(undefined); setEditError(''); setPreview(null) }
  function exportCsv(): void {
    if (remote) return
    const exportRows = selectedRows.length ? selectedRows.map((rowIndex) => rows[rowIndex]).filter((row): row is Record<string, unknown> => Boolean(row)) : rows
    const csv = [columns, ...exportRows].map((row) => (Array.isArray(row) ? row : columns.map((column) => row[column])).map(csvCell).join(',')).join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `result-${index + 1}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  function selectRow(row: number, event: React.MouseEvent): void {
    if (remote) { setSelectedRows([row]); setSelectionAnchor(row); return }
    if (event.shiftKey && selectionAnchor !== undefined) { const low = Math.min(selectionAnchor, row); const high = Math.max(selectionAnchor, row); setSelectedRows(Array.from({ length: high - low + 1 }, (_, offset) => low + offset)) }
    else if (event.ctrlKey || event.metaKey) { setSelectedRows((current) => current.includes(row) ? current.filter((item) => item !== row) : [...current, row]); setSelectionAnchor(row) }
    else { setSelectedRows([row]); setSelectionAnchor(row) }
  }
  function filterColumn(column: string): void { const value = window.prompt(`Filtrar ${column} por conteúdo:`, columnFilters[column] ?? ''); if (value !== null) setColumnFilters((current) => ({ ...current, [column]: value })) }
  const displayRows = Array.from({ length: Math.max(0, last - first) }, (_, offset) => first + offset)

  return <section className="grid-result" aria-label={`Result ${index + 1}`}>
    {result.editable && !editable && <div className="grid-edit-readonly" title={result.editable.reason ?? 'A unique key is required to edit rows.'}>Read only · {result.editable.reason ?? 'A unique key is required to edit rows.'}</div>}
    {editable && <div className="grid-edit-toolbar"><button onClick={insertRow}>Insert Row</button><button onClick={deleteSelected} disabled={!selectedRows.length}>Delete Row</button><button onClick={() => selectedCell && updateCell(selectedCell.row, selectedCell.column, null)} disabled={!selectedCell}>Set NULL</button><button onClick={() => void showPreview()} disabled={!changes.length}>Preview SQL</button><button onClick={() => void postChanges()} disabled={!changes.length}>Post / Apply</button><button onClick={cancelChanges} disabled={!changes.length}>Cancel</button>{editError && <span role="status" className="grid-edit-error">{editError}</span>}</div>}
    <div className="result-grid-scroll" tabIndex={0} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <table className="result-grid"><thead><tr><th className="row-number-head">#</th>{columns.map((column) => <th key={column} draggable={!remote} style={{ width: widths[column] }} onClick={() => !remote && setSort((current) => ({ column, direction: current?.column === column ? current.direction === 1 ? -1 : 1 : 1 }))} onDragStart={(event) => event.dataTransfer.setData('text/plain', column)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moved = event.dataTransfer.getData('text/plain'); const next = [...columns]; const from = next.indexOf(moved); const to = next.indexOf(column); if (from >= 0 && to >= 0) { next.splice(from, 1); next.splice(to, 0, moved); setOrder(next) } }} title="Sort ascending / descending; drag to reorder">{column}{sort?.column === column ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}<button disabled={remote} className="column-filter-button" onClick={(event) => { event.stopPropagation(); filterColumn(column) }} aria-label={`Filter ${column}`}>⌕</button><span className="column-resizer" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); const startX = event.clientX; const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 120; const move = (moveEvent: PointerEvent): void => setWidths((current) => ({ ...current, [column]: Math.max(60, Math.min(360, startWidth + moveEvent.clientX - startX)) })); window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }} /></th>)}</tr></thead>
        <tbody><tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: first * ROW_HEIGHT }} /></tr>{displayRows.map((rowIndex) => { const base = rowAt(rowIndex); const change = pending.get(rowIndex); const row = change?.kind === 'update' ? change.values : base; const deleted = change?.kind === 'delete' || savedDeletes.has(rowIndex); return <tr key={rowIndex} className={`${selectedRows.includes(rowIndex) ? 'selected-row ' : ''}${change?.kind === 'update' ? 'grid-row-updated ' : ''}${deleted ? 'grid-row-deleted' : ''}`} style={{ height: ROW_HEIGHT }}><td className="row-number" onClick={(event) => selectRow(rowIndex, event)}>{rowIndex + 1}</td>{columns.map((column) => <td key={column} title={row ? display(row[column]) : deleted ? 'Deleted' : 'Loading…'} className={`${row?.[column] === null ? 'null-cell' : typeof row?.[column] === 'number' ? 'number-cell' : ''}${selectedCell?.row === rowIndex && selectedCell.column === column ? ' selected-cell' : ''}`} onClick={() => setSelectedCell({ row: rowIndex, column })} onDoubleClick={() => editable && row && !deleted ? setEditing({ row: rowIndex, column, value: row[column] == null ? '' : String(row[column]) }) : row && void copy(row[column])}>{editing?.row === rowIndex && editing.column === column ? <input autoFocus aria-label={`Edit ${column}`} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={() => { updateCell(rowIndex, column, editing.value); setEditing(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { updateCell(rowIndex, column, editing.value); setEditing(undefined) } else if (event.key === 'Escape') setEditing(undefined) }} /> : row ? display(row[column]) : deleted ? '' : '…'}</td>)}</tr> })}{newRows.map((row, newIndex) => <tr key={`new-${newIndex}`} className="grid-row-inserted" style={{ height: ROW_HEIGHT }}><td className="row-number">+</td>{columns.map((column) => <td key={column} onDoubleClick={() => setEditing({ row: -1 - newIndex, column, value: row[column] == null ? '' : String(row[column]) })}>{editing?.row === -1 - newIndex && editing.column === column ? <input autoFocus aria-label={`New ${column}`} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={() => { setNewRows((current) => current.map((item, i) => i === newIndex ? { ...item, [column]: parseEditedValue(editing.value, editable?.columns.find((c) => c.name === column)?.dataType ?? '') } : item)); setEditing(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { setNewRows((current) => current.map((item, i) => i === newIndex ? { ...item, [column]: parseEditedValue(editing.value, editable?.columns.find((c) => c.name === column)?.dataType ?? '') } : item)); setEditing(undefined) } else if (event.key === 'Escape') setEditing(undefined) }} /> : row[column] === undefined ? 'Double-click to enter' : display(row[column])}</td>)}</tr>)}<tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: Math.max(0, (visibleCount - last) * ROW_HEIGHT) }} /></tr></tbody>
      </table>{!totalRows && <div className="grid-empty">Nenhuma linha retornada.</div>}
    </div>
    {preview && <div className="grid-edit-preview" role="dialog" aria-label="Pending SQL preview"><button onClick={() => setPreview(null)}>Close preview</button>{preview.map((item, itemIndex) => <pre key={itemIndex}>{item.sql}{'\n'}Parameters: {JSON.stringify(item.values)}</pre>)}</div>}
    <footer className="grid-footer"><span>{visibleCount} rows{selectedRows.length ? ` · ${selectedRows.length} selected` : ''}</span>{onLoadMore && <button disabled={loadingMore} onClick={() => { setLoadingMore(true); void onLoadMore().finally(() => setLoadingMore(false)) }}>{loadingMore ? 'Loading…' : 'Load more'}</button>}<input className="grid-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter rows…" aria-label="Filter result rows" disabled={remote} /><span className="toolbar-spacer" /><button disabled={remote} onClick={() => { const copied = selectedRows.length ? selectedRows.map((rowIndex) => rows[rowIndex]).filter((row): row is Record<string, unknown> => Boolean(row)) : rows; void copy([columns.join('\t'), ...copied.map((row) => columns.map((column) => row[column] === null ? 'NULL' : String(row[column])).join('\t'))].join('\n')) }}>Copy TSV</button><button disabled={remote} onClick={exportCsv}>Export CSV</button></footer>
  </section>
}

function compare(left: unknown, right: unknown): number { if (left === right) return 0; if (left === null) return -1; if (right === null) return 1; if (typeof left === 'number' && typeof right === 'number') return left - right; return String(left).localeCompare(String(right), undefined, { numeric: true }) }
function csvCell(value: unknown): string { const text = typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value); return `"${text.replace(/"/g, '""')}"` }
function display(value: unknown): string { if (value === null) return 'NULL'; if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', ''); if (value instanceof Uint8Array) return `[BLOB ${value.byteLength.toLocaleString()} B]`; if (typeof value === 'object') return JSON.stringify(value); return String(value) }
function parseEditedValue(raw: unknown, dataType: string): unknown {
  if (raw === null) return null
  if (typeof raw !== 'string') return raw
  if (/^(tinyint|smallint|mediumint|int|integer|bigint)/i.test(dataType) && /^[+-]?\d+$/.test(raw.trim())) return Number(raw)
  if (/^(decimal|numeric|float|double|real)/i.test(dataType) && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return Number(raw)
  return raw
}
