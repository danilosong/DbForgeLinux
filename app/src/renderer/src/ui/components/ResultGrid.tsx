import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QueryResult } from '../../../../shared/contracts'
import type { GridChange } from '../../../../modules/grid-editing/index.js'
import { columnStatistics, display as displayGridValue, formatGridCopy, quickPivot, type CopyAsFormat, type PivotAggregation } from '../../../../modules/grid-viewer/index.js'
import { useI18n } from '../i18n/useI18n.js'
import { setSelectedGridRows } from './gridSelection.js'

const ROW_HEIGHT = 26
const OVERSCAN = 8

export function ResultGrid({ result, index, onLoadMore, fetchRows, currentConnection, autoCommit, transactionRevision, transactionCommitted, columnTypes, nullLabel = 'NULL' }: { result: QueryResult; index: number; onLoadMore?(): Promise<void>; fetchRows?(offset: number, limit: number): Promise<Array<Record<string, unknown>>>; currentConnection?: { id: string; environment?: string; database?: string }; autoCommit: boolean; transactionRevision: number; transactionCommitted: boolean; columnTypes?: Record<string, string>; nullLabel?: string }): React.JSX.Element {
  const { t } = useI18n()
  const [scrollTop, setScrollTop] = useState(0)
  const [sort, setSort] = useState<{ column: string; direction: 1 | -1 }>()
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [order, setOrder] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => new Set())
  const [frozenThrough, setFrozenThrough] = useState(-1)
  const [selectedCell, setSelectedCell] = useState<{ row: number; column: string }>()
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [selectionAnchor, setSelectionAnchor] = useState<number>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [remoteRows, setRemoteRows] = useState<Map<number, Record<string, unknown>>>(() => new Map())
  const [remoteSortedRows, setRemoteSortedRows] = useState<Array<Record<string, unknown>> | null>(null)
  const [pending, setPending] = useState<Map<number, GridChange>>(() => new Map())
  const [newRows, setNewRows] = useState<Array<Record<string, unknown>>>([])
  const [savedRows, setSavedRows] = useState<Map<number, Record<string, unknown>>>(() => new Map())
  const [savedInserts, setSavedInserts] = useState<Set<number>>(() => new Set())
  const [savedDeletes, setSavedDeletes] = useState<Set<number>>(() => new Set())
  const [editing, setEditing] = useState<{ row: number; column: string; value: string }>()
  const [preview, setPreview] = useState<Array<{ sql: string; values: unknown[] }> | null>(null)
  const [editError, setEditError] = useState('')
  const [gridMessage, setGridMessage] = useState('')
  const [copyFormatKind, setCopyFormatKind] = useState<CopyAsFormat>('json')
  const [detailMasterIndex, setDetailMasterIndex] = useState<number | null>(null)
  const [viewer, setViewer] = useState<{ row: number; column: string; value: unknown }>()
  const [viewerValue, setViewerValue] = useState('')
  const [viewerEditing, setViewerEditing] = useState(false)
  const [viewerMode, setViewerMode] = useState<'value' | 'json' | 'xml' | 'hex' | 'image'>('value')
  const [stats, setStats] = useState<{ column: string; value: ReturnType<typeof columnStatistics> }>()
  const [statsBusy, setStatsBusy] = useState(false)
  const [pivotOpen, setPivotOpen] = useState(false)
  const [pivotGroup, setPivotGroup] = useState('')
  const [pivotValue, setPivotValue] = useState('')
  const [pivotAggregation, setPivotAggregation] = useState<PivotAggregation>('count')
  const [pivotRows, setPivotRows] = useState<ReturnType<typeof quickPivot>>([])
  const [cardView, setCardView] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [cardRow, setCardRow] = useState<Record<string, unknown>>()
  const [cardLoading, setCardLoading] = useState(false)
  const cardRequest = useRef(0)
  const [detailRows, setDetailRows] = useState<Map<number, Awaited<ReturnType<typeof window.dbforge.loadMasterDetails>>>>(() => new Map())
  const requested = useRef(new Set<number>())
  const lastTransactionRevision = useRef(transactionRevision)
  const visiblePage = useRef(0)
  const remote = Boolean(result.resultStoreId && fetchRows)
  const totalRows = (result.rowCount ?? result.rows.length) + savedInserts.size - savedDeletes.size
  const editable = result.editable?.keyColumns.length ? result.editable : undefined
  const changes = [...pending.values(), ...newRows.map((values) => ({ kind: 'insert' as const, values }))]
  const allColumns = order.length ? [...order, ...result.columns.filter((column) => !order.includes(column))] : result.columns
  const columns = allColumns.filter((column) => !hiddenColumns.has(column))
  const columnSignature = result.columns.join('\0')
  const rows = useMemo(() => {
    const sourceRows = remote ? remoteSortedRows ?? [] : result.rows
    const filtered = sourceRows.filter((row) => {
      const matchesQuickFilter = !filter || columns.some((column) => display(row[column]).toLowerCase().includes(filter.toLowerCase()))
      const matchesColumnFilters = Object.entries(columnFilters).every(([column, value]) => !value || display(row[column]).toLowerCase().includes(value.toLowerCase()))
      return matchesQuickFilter && matchesColumnFilters
    })
    if (!sort) return filtered
    return [...filtered].sort((left, right) => compare(left[sort.column], right[sort.column]) * sort.direction)
  }, [result.rows, remoteSortedRows, sort, filter, columns, columnFilters, remote])
  const visibleCount = Math.max(remote && remoteSortedRows === null ? totalRows : rows.length + savedInserts.size - savedDeletes.size, ...[...savedRows.keys()].map((row) => row + 1), 0)
  const viewport = 500
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(visibleCount, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)

  useEffect(() => { requested.current.clear(); visiblePage.current = 0; setRemoteRows(new Map()); setRemoteSortedRows(null) }, [result.resultStoreId])
  useEffect(() => { setHiddenColumns(new Set()); setFrozenThrough(-1); setOrder([]); setDetailRows(new Map()) }, [result.resultStoreId, columnSignature])
  useEffect(() => { if (lastTransactionRevision.current === transactionRevision) return; lastTransactionRevision.current = transactionRevision; if (!transactionCommitted) { setSavedRows(new Map()); setSavedInserts(new Set()); setSavedDeletes(new Set()) } }, [transactionCommitted, transactionRevision])
  useEffect(() => {
    if (!remote || remoteSortedRows || !fetchRows || last <= first) return
    const offset = Math.floor(first / 100) * 100
    visiblePage.current = offset
    if (requested.current.has(offset)) return
    requested.current.add(offset)
    void fetchRows(offset, 100).then((loaded) => {
      requested.current.delete(offset)
      if (visiblePage.current !== offset) return
      setRemoteRows(() => { const next = new Map<number, Record<string, unknown>>(); loaded.forEach((row, position) => next.set(offset + position, row)); return next })
    }).catch(() => requested.current.delete(offset))
  }, [remote, remoteSortedRows, fetchRows, first, last])

  const rowAt = useCallback((index: number): Record<string, unknown> | undefined => { if (savedDeletes.has(index)) return undefined; return savedRows.get(index) ?? (remote ? remoteSortedRows !== null ? rows[index] : remoteRows.get(index) : rows[index]) }, [savedDeletes, savedRows, remote, remoteSortedRows, rows, remoteRows])
  useEffect(() => {
    const selected = selectedRows.map((rowIndex) => rowAt(rowIndex)).filter((row): row is Record<string, unknown> => Boolean(row))
    setSelectedGridRows(result.columns, selected)
  }, [selectedRows, result.columns, rowAt])
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
      if (currentConnection.environment === 'prod') {
        const databaseName = currentConnection.database ?? t('conn.database.none')
        if (window.prompt(t('security.prod.confirm', [databaseName])) !== databaseName) return
      }
      if (!window.confirm(t('grid.apply.confirm', [String(changes.length)]))) return
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
  async function collectRows(maxRows: number): Promise<Array<Record<string, unknown>>> {
    const count = result.rowCount ?? result.rows.length
    if (count > maxRows) throw new Error(t('grid.limit.rows', [maxRows.toLocaleString()]))
    if (!remote || !fetchRows) return rows
    const collected: Array<Record<string, unknown>> = []
    for (let offset = 0; offset < count; offset += 500) collected.push(...await fetchRows(offset, Math.min(500, count - offset)))
    return collected
  }
  async function copyFormat(format: CopyAsFormat, withHeaders = true): Promise<void> {
    try {
      const selected = selectedRows.length ? selectedRows.map((rowIndex) => rowAt(rowIndex)).filter((row): row is Record<string, unknown> => Boolean(row)) : await collectRows(20_000)
      const text = formatGridCopy(selected, columns, format, editable, withHeaders)
      if (text.length > 8_000_000) throw new Error(t('grid.limit.text'))
      await navigator.clipboard.writeText(text); setGridMessage(t('grid.copied', [String(selected.length)]))
    } catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.copy.error')) }
  }
  async function exportCsv(): Promise<void> {
    try { const exportRows = selectedRows.length ? selectedRows.map((rowIndex) => rowAt(rowIndex)).filter((row): row is Record<string, unknown> => Boolean(row)) : await collectRows(20_000); const csv = formatGridCopy(exportRows, columns, 'csv', editable, true); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `result-${index + 1}.csv`; link.click(); URL.revokeObjectURL(link.href) }
    catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.copy.error')) }
  }
  async function sortColumn(column: string): Promise<void> {
    const nextSort = { column, direction: sort?.column === column ? sort.direction === 1 ? -1 as const : 1 as const : 1 as const }
    setSort(nextSort)
    if (!remote || remoteSortedRows) return
    try { setRemoteSortedRows(await collectRows(50_000)) }
    catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.sort.error')) }
  }
  async function showColumnStats(column: string): Promise<void> {
    setStatsBusy(true); setStats(undefined); setGridMessage('')
    try { const values = await collectRows(100_000); setStats({ column, value: columnStatistics(values, column) }) }
    catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.stats.error')) }
    finally { setStatsBusy(false) }
  }
  async function buildQuickPivot(groupColumn = pivotGroup || columns[0] || '', valueColumn = pivotValue || columns[1] || columns[0] || ''): Promise<void> {
    try { const values = await collectRows(50_000); setPivotGroup(groupColumn); setPivotValue(valueColumn); setPivotRows(quickPivot(values, groupColumn, valueColumn, pivotAggregation)); setPivotOpen(true) }
    catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.pivot.error')) }
  }
  async function toggleDetails(rowIndex: number): Promise<void> {
    if (detailRows.has(rowIndex)) { setDetailRows((current) => { const next = new Map(current); next.delete(rowIndex); return next }); setDetailMasterIndex(null); return }
    const row = rowAt(rowIndex)
    if (!editable || !currentConnection || !row) return
    try { const details = await window.dbforge.loadMasterDetails(currentConnection.id, editable, row); setDetailRows((current) => new Map(current).set(rowIndex, details)); setGridMessage(details.length ? t('grid.detail.found', [String(details.length)]) : t('grid.masterDetail.empty')) }
    catch (error) { setGridMessage(error instanceof Error ? error.message : t('grid.detail.error')) }
  }
  function selectRow(row: number, event: React.MouseEvent): void {
    if (remote) { setSelectedRows([row]); setSelectionAnchor(row); return }
    if (event.shiftKey && selectionAnchor !== undefined) { const low = Math.min(selectionAnchor, row); const high = Math.max(selectionAnchor, row); setSelectedRows(Array.from({ length: high - low + 1 }, (_, offset) => low + offset)) }
    else if (event.ctrlKey || event.metaKey) { setSelectedRows((current) => current.includes(row) ? current.filter((item) => item !== row) : [...current, row]); setSelectionAnchor(row) }
    else { setSelectedRows([row]); setSelectionAnchor(row) }
  }
  function filterColumn(column: string): void { const value = window.prompt(t('grid.filterColumn.prompt', [column]), columnFilters[column] ?? ''); if (value !== null) setColumnFilters((current) => ({ ...current, [column]: value })) }
  const displayRows = Array.from({ length: Math.max(0, last - first) }, (_, offset) => first + offset)
  function frozenStyle(columnIndex: number): React.CSSProperties { return columnIndex <= frozenThrough ? { position: 'sticky', left: 48 + columns.slice(0, columnIndex).reduce((sum, column) => sum + (widths[column] ?? 140), 0), zIndex: columnIndex === frozenThrough ? 3 : 2, background: 'var(--bg-surface)' } : {} }
  function openViewer(rowIndex: number, column: string): void { const row = rowAt(rowIndex); if (!row) return; setViewer({ row: rowIndex, column, value: row[column] }); setViewerValue(displayGridValue(row[column])); setViewerEditing(false); setViewerMode('value') }
  async function openCard(index: number): Promise<void> {
    const request = ++cardRequest.current
    setCardIndex(index); setSelectedRows([index]); setGridMessage('')
    if (remote) {
      const cached = rowAt(index)
      if (cached) { setCardRow(cached); setCardLoading(false); return }
      setCardRow(undefined); setCardLoading(true)
      try {
        const loaded = await fetchRows?.(index, 1)
        if (request !== cardRequest.current) return
        const row = loaded?.[0]
        setCardRow(row)
        if (!row) setGridMessage(t('grid.cardLoadError'))
      } catch (error) {
        if (request !== cardRequest.current) return
        setCardRow(undefined)
        setGridMessage(error instanceof Error ? error.message : t('grid.cardLoadError'))
      } finally { if (request === cardRequest.current) setCardLoading(false) }
    } else { setCardRow(rowAt(index)); setCardLoading(false) }
  }

  return <section className="grid-result" aria-label={`Result ${index + 1}`} data-testid="result-grid" aria-busy={cardView ? cardLoading : remote && !remoteSortedRows && remoteRows.size === 0}>
    {result.editable && !editable && <div className="grid-edit-readonly" title={result.editable.reason ?? 'A unique key is required to edit rows.'}>Read only · {result.editable.reason ?? 'A unique key is required to edit rows.'}</div>}
    {editable && <div className="grid-edit-toolbar"><button onClick={insertRow}>Insert Row</button><button onClick={deleteSelected} disabled={!selectedRows.length}>Delete Row</button><button onClick={() => selectedCell && updateCell(selectedCell.row, selectedCell.column, null)} disabled={!selectedCell}>Set NULL</button><button onClick={() => void showPreview()} disabled={!changes.length}>Preview SQL</button><button onClick={() => void postChanges()} disabled={!changes.length}>Post / Apply</button><button onClick={cancelChanges} disabled={!changes.length}>Cancel</button>{editError && <span role="status" className="grid-edit-error">{editError}</span>}</div>}
    <div className="grid-tools"><details><summary>{t('grid.columns', [String(columns.length), String(allColumns.length)])}</summary><div className="grid-column-menu">{allColumns.map((column) => <label key={column}><input type="checkbox" checked={!hiddenColumns.has(column)} onChange={(event) => setHiddenColumns((current) => { const next = new Set(current); if (event.target.checked) next.delete(column); else next.add(column); return next })} />{column}</label>)}</div></details><button disabled={!columns.length || statsBusy} onClick={() => void showColumnStats(selectedCell?.column ?? columns[0] ?? '')}>{statsBusy ? t('grid.calculating') : t('grid.stats.title')}</button><button disabled={!columns.length} onClick={() => void buildQuickPivot(columns[0] ?? '', columns[1] ?? columns[0] ?? '')}>{t('grid.pivot.title')}</button><button disabled={!totalRows} aria-pressed={cardView} onClick={() => { setCardView((current) => !current); void openCard(selectedRows[0] ?? 0) }}>{t('grid.cardView')}</button><button disabled={!editable || !currentConnection || selectedRows.length !== 1} onClick={() => { const index = selectedRows[0]; if (index !== undefined) { setDetailMasterIndex(index); void toggleDetails(index) } }}>{t('grid.masterDetail')}</button><select aria-label={t('grid.copyAs')} value={copyFormatKind} onChange={(event) => setCopyFormatKind(event.target.value as CopyAsFormat)}><option value="csv">CSV</option><option value="json">JSON</option><option value="insert">SQL INSERT</option><option value="markdown">Markdown</option><option value="html">HTML</option></select><button onClick={() => void copyFormat(copyFormatKind)} disabled={copyFormatKind === 'insert' && !editable}>{t('grid.copyAs')}</button><button onClick={() => void copyFormat('csv', true)}>{t('grid.copyHeaders')}</button></div>
    {cardView ? <section className="grid-card-view" aria-label={t('grid.cardView')} data-testid="grid-card-view" aria-busy={cardLoading} data-state={cardLoading ? 'loading' : cardRow ? 'ready' : 'error'}><header><button disabled={cardIndex <= 0} onClick={() => void openCard(cardIndex - 1)}>‹</button><span data-testid="grid-card-position">{cardIndex + 1} / {visibleCount}</span><button disabled={cardIndex + 1 >= visibleCount} onClick={() => void openCard(cardIndex + 1)}>›</button><button onClick={() => setCardView(false)}>{t('grid.cardTable')}</button></header>{cardRow ? <dl data-testid="grid-card-record">{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{cardRow[column] === null ? nullLabel : display(cardRow[column])}</dd></div>)}</dl> : <p role={cardLoading ? 'status' : 'alert'}>{cardLoading ? t('grid.loading') : t('grid.cardLoadError')}</p>}</section> : <div className="result-grid-scroll" tabIndex={0} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <table className="result-grid"><thead><tr><th className="row-number-head">#</th>{columns.map((column, columnIndex) => <th key={column} draggable style={{ width: widths[column], ...frozenStyle(columnIndex) }} onClick={() => void sortColumn(column)} onDragStart={(event) => event.dataTransfer.setData('text/plain', column)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moved = event.dataTransfer.getData('text/plain'); const next = [...allColumns]; const from = next.indexOf(moved); const to = next.indexOf(column); if (from >= 0 && to >= 0) { next.splice(from, 1); next.splice(to, 0, moved); setOrder(next) } }} title={t('grid.sort.drag')}><span className="result-column-heading">{column}{columnTypes?.[column] && <small>{columnTypes[column]}</small>}</span>{sort?.column === column ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}<button className="freeze-column-button" title={columnIndex <= frozenThrough ? t('grid.unfreeze') : t('grid.freeze', [column])} onClick={(event) => { event.stopPropagation(); setFrozenThrough(columnIndex <= frozenThrough ? -1 : columnIndex) }}>{columnIndex <= frozenThrough ? '❄' : '◇'}</button><button disabled={remote && remoteSortedRows === null} className="column-filter-button" onClick={(event) => { event.stopPropagation(); filterColumn(column) }} aria-label={t('grid.filterColumn', [column])}>⌕</button><span className="column-resizer" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); const startX = event.clientX; const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 120; const move = (moveEvent: PointerEvent): void => setWidths((current) => ({ ...current, [column]: Math.max(60, Math.min(360, startWidth + moveEvent.clientX - startX), ) })); window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }} /></th>)}</tr></thead>
        <tbody><tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: first * ROW_HEIGHT }} /></tr>{displayRows.map((rowIndex) => { const base = rowAt(rowIndex); const change = pending.get(rowIndex); const row = change?.kind === 'update' ? change.values : base; const deleted = change?.kind === 'delete' || savedDeletes.has(rowIndex); return <tr key={rowIndex} className={`${selectedRows.includes(rowIndex) ? 'selected-row ' : ''}${change?.kind === 'update' ? 'grid-row-updated ' : ''}${deleted ? 'grid-row-deleted' : ''}`} style={{ height: ROW_HEIGHT }}><td className="row-number" onClick={(event) => selectRow(rowIndex, event)}>{rowIndex + 1}</td>{columns.map((column, columnIndex) => <td key={column} style={frozenStyle(columnIndex)} title={row ? display(row[column]) : deleted ? 'Deleted' : 'Loading…'} className={`${row?.[column] === null ? 'null-cell' : typeof row?.[column] === 'number' ? 'number-cell' : ''}${selectedCell?.row === rowIndex && selectedCell.column === column ? ' selected-cell' : ''}`} onClick={() => setSelectedCell({ row: rowIndex, column })} onDoubleClick={() => openViewer(rowIndex, column)}>{editing?.row === rowIndex && editing.column === column ? <input autoFocus aria-label={`Edit ${column}`} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={() => { updateCell(rowIndex, column, editing.value); setEditing(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { updateCell(rowIndex, column, editing.value); setEditing(undefined) } else if (event.key === 'Escape') setEditing(undefined) }} /> : row ? row[column] === null ? nullLabel : display(row[column]) : deleted ? '' : '…'}</td>)}</tr> })}{newRows.map((row, newIndex) => <tr key={`new-${newIndex}`} className="grid-row-inserted" style={{ height: ROW_HEIGHT }}><td className="row-number">+</td>{columns.map((column) => <td key={column} onDoubleClick={() => setEditing({ row: -1 - newIndex, column, value: row[column] == null ? '' : String(row[column]) })}>{editing?.row === -1 - newIndex && editing.column === column ? <input autoFocus aria-label={`New ${column}`} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={() => { setNewRows((current) => current.map((item, i) => i === newIndex ? { ...item, [column]: parseEditedValue(editing.value, editable?.columns.find((c) => c.name === column)?.dataType ?? '') } : item)); setEditing(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { setNewRows((current) => current.map((item, i) => i === newIndex ? { ...item, [column]: parseEditedValue(editing.value, editable?.columns.find((c) => c.name === column)?.dataType ?? '') } : item)); setEditing(undefined) } else if (event.key === 'Escape') setEditing(undefined) }} /> : row[column] === undefined ? 'Double-click to enter' : row[column] === null ? nullLabel : display(row[column])}</td>)}</tr>)}<tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: Math.max(0, (visibleCount - last) * ROW_HEIGHT) }} /></tr></tbody>
      </table>{!totalRows && <div className="grid-empty">{t('grid.empty')}</div>}
    </div>}
    {detailMasterIndex !== null && detailRows.get(detailMasterIndex) && <section className="grid-master-detail" aria-label={t('grid.masterDetail')}><header><strong>{t('grid.masterDetail')} · {t('grid.masterDetail.row', [String(detailMasterIndex + 1)])}</strong><button onClick={() => setDetailMasterIndex(null)}>{t('common.close')}</button></header>{detailRows.get(detailMasterIndex)!.length ? detailRows.get(detailMasterIndex)!.map((relation) => <section key={relation.name}><h4>{relation.table} · {relation.name}{relation.truncated ? ' · …' : ''}</h4>{relation.rows.length ? <div className="grid-detail-scroll"><table><thead><tr>{Object.keys(relation.rows[0] ?? {}).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{relation.rows.map((row, rowIndex) => <tr key={rowIndex}>{Object.keys(relation.rows[0] ?? {}).map((column) => <td key={column}>{displayGridValue(row[column])}</td>)}</tr>)}</tbody></table></div> : <p>{t('grid.masterDetail.empty')}</p>}</section>) : <p>{t('grid.masterDetail.empty')}</p>}</section>}
    {gridMessage && <p className="grid-status" role="status">{gridMessage}</p>}
    {viewer && <div className="grid-viewer-backdrop"><section className="grid-viewer" role="dialog" aria-modal="true" aria-label={`${t('grid.viewer')} ${viewer.column}`}><header><h3>{viewer.column}</h3><button onClick={() => { setViewer(undefined); setViewerEditing(false) }}>{t('common.close')}</button></header><div className="grid-viewer-tools"><select aria-label={t('grid.viewer.format')} value={viewerMode} onChange={(event) => setViewerMode(event.target.value as typeof viewerMode)}><option value="value">{t('grid.viewer.value')}</option><option value="json">JSON</option><option value="xml">XML</option>{viewer.value instanceof Uint8Array && <><option value="hex">{t('grid.viewer.hex')}</option>{imageDataUri(viewer.value) && <option value="image">{t('grid.viewer.image')}</option>}</>}</select>{editable && !(viewer.value instanceof Uint8Array) && !viewerEditing && <button onClick={() => { setViewerEditing(true); setViewerValue(viewer.value == null ? '' : typeof viewer.value === 'object' ? JSON.stringify(viewer.value, null, 2) : String(viewer.value)) }}>{t('grid.viewer.edit')}</button>}{viewerEditing && <><button onClick={() => { updateCell(viewer.row, viewer.column, viewerValue); setViewer({ ...viewer, value: viewerValue }); setViewerEditing(false) }}>{t('common.save')}</button><button onClick={() => setViewerEditing(false)}>{t('common.cancel')}</button></>}</div>{viewerMode === 'image' && viewer.value instanceof Uint8Array && imageDataUri(viewer.value) ? <div className="grid-viewer-image"><img src={imageDataUri(viewer.value)!} alt={t('grid.viewer.image')} /></div> : <textarea className="grid-viewer-content" readOnly={!viewerEditing} value={viewerEditing ? viewerValue : viewerContent(viewer.value, viewerMode)} onChange={(event) => setViewerValue(event.target.value)} />}</section></div>}
    {stats && <div className="grid-viewer-backdrop"><section className="grid-stats" role="dialog" aria-modal="true" aria-label={t('grid.stats.title')}><header><h3>{t('grid.stats.title')} · {stats.column}</h3><button onClick={() => setStats(undefined)}>{t('common.close')}</button></header><dl><dt>{t('grid.stats.count')}</dt><dd>{stats.value.count}</dd><dt>{t('grid.stats.distinct')}</dt><dd>{stats.value.distinct}</dd><dt>{t('grid.stats.nulls')}</dt><dd>{stats.value.nulls}</dd><dt>{t('grid.stats.min')}</dt><dd>{stats.value.min}</dd><dt>{t('grid.stats.max')}</dt><dd>{stats.value.max}</dd></dl></section></div>}
    {pivotOpen && <div className="grid-viewer-backdrop"><section className="grid-pivot" role="dialog" aria-modal="true" aria-label={t('grid.pivot.title')}><header><h3>{t('grid.pivot.title')}</h3><button onClick={() => setPivotOpen(false)}>{t('common.close')}</button></header><div className="grid-pivot-controls"><label>{t('grid.pivot.group')}<select value={pivotGroup} onChange={(event) => setPivotGroup(event.target.value)}>{allColumns.map((column) => <option key={column}>{column}</option>)}</select></label><label>{t('grid.pivot.value')}<select value={pivotValue} onChange={(event) => setPivotValue(event.target.value)}>{allColumns.map((column) => <option key={column}>{column}</option>)}</select></label><label>{t('grid.pivot.aggregation')}<select value={pivotAggregation} onChange={(event) => setPivotAggregation(event.target.value as PivotAggregation)}>{(['count', 'sum', 'avg', 'min', 'max'] as PivotAggregation[]).map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={() => void buildQuickPivot(pivotGroup, pivotValue)}>{t('grid.pivot.refresh')}</button></div><table><thead><tr><th>{pivotGroup}</th><th>{pivotAggregation}({pivotValue})</th></tr></thead><tbody>{pivotRows.map((row) => <tr key={row.group}><td>{row.group}</td><td>{row.value}</td></tr>)}</tbody></table></section></div>}
    {preview && <div className="grid-edit-preview" role="dialog" aria-label="Pending SQL preview"><button onClick={() => setPreview(null)}>Close preview</button>{preview.map((item, itemIndex) => <pre key={itemIndex}>{item.sql}{'\n'}Parameters: {JSON.stringify(item.values)}</pre>)}</div>}
    <footer className="grid-footer"><span>{t('grid.rows', [String(visibleCount)])}{selectedRows.length ? ` · ${selectedRows.length} ${t('grid.selected')}` : ''}</span>{onLoadMore && <button disabled={loadingMore} onClick={() => { setLoadingMore(true); void onLoadMore().finally(() => setLoadingMore(false)) }}>{loadingMore ? t('grid.loading') : t('grid.loadMore')}</button>}<input className="grid-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('grid.filter')} aria-label={t('grid.filter')} disabled={remote && remoteSortedRows === null} /><span className="toolbar-spacer" /><button onClick={() => void copyFormat('tsv', false)}>{t('grid.copyTsv')}</button><button onClick={exportCsv}>{t('grid.exportCsv')}</button></footer>
  </section>
}

function compare(left: unknown, right: unknown): number { if (left === right) return 0; if (left === null) return -1; if (right === null) return 1; if (typeof left === 'number' && typeof right === 'number') return left - right; return String(left).localeCompare(String(right), undefined, { numeric: true }) }
function display(value: unknown): string { if (value === null) return 'NULL'; if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', ''); if (value instanceof Uint8Array) return `[BLOB ${value.byteLength.toLocaleString()} B]`; if (typeof value === 'object') return JSON.stringify(value); return String(value) }
function viewerContent(value: unknown, mode: 'value' | 'json' | 'xml' | 'hex' | 'image'): string { if (mode === 'hex' && value instanceof Uint8Array) return Array.from(value, (byte, index) => `${index.toString(16).padStart(8, '0')}  ${byte.toString(16).padStart(2, '0')}`).join('\n'); if (mode === 'json') { try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2) } catch { return typeof value === 'string' ? value : JSON.stringify(value, null, 2) } } if (mode === 'xml') return typeof value === 'string' ? prettyXml(value) : displayGridValue(value); if (mode === 'image') return tbdImageText(value); return displayGridValue(value) }
function prettyXml(value: string): string {
  let depth = 0
  return value.replace(/>\s*</g, '>\n<').split('\n').map((line) => {
    const token = line.trim()
    const closes = /^<\//.test(token)
    if (closes) depth = Math.max(0, depth - 1)
    const formatted = `${'  '.repeat(Math.min(depth, 12))}${token}`
    const opens = /^<[^!?/][^>]*[^/]?>$/.test(token) && !/<[^>]+>.*<\//.test(token)
    if (opens) depth += 1
    return formatted
  }).join('\n')
}
function tbdImageText(value: unknown): string { return value instanceof Uint8Array ? `Binary image · ${value.byteLength.toLocaleString()} bytes` : '' }
function imageDataUri(value: Uint8Array): string | undefined { const bytes = value; let mime = ''; if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mime = 'image/png'; else if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = 'image/jpeg'; else if (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a') mime = 'image/gif'; else if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') mime = 'image/webp'; if (!mime) return undefined; let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)); return `data:${mime};base64,${btoa(binary)}` }
function parseEditedValue(raw: unknown, dataType: string): unknown {
  if (raw === null) return null
  if (typeof raw !== 'string') return raw
  if (/^(tinyint|smallint|mediumint|int|integer|bigint)/i.test(dataType) && /^[+-]?\d+$/.test(raw.trim())) return Number(raw)
  if (/^(decimal|numeric|float|double|real)/i.test(dataType) && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return Number(raw)
  return raw
}
