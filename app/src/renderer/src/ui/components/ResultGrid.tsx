import { useMemo, useState } from 'react'
import type { QueryResult } from '../../../../shared/contracts'

const ROW_HEIGHT = 26
const OVERSCAN = 8

export function ResultGrid({ result, index, onLoadMore }: { result: QueryResult; index: number; onLoadMore?(): Promise<void> }): React.JSX.Element {
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
  const columns = order.length ? order : result.columns
  const rows = useMemo(() => {
    const filtered = result.rows.filter((row) => {
      const matchesQuickFilter = !filter || columns.some((column) => display(row[column]).toLowerCase().includes(filter.toLowerCase()))
      const matchesColumnFilters = Object.entries(columnFilters).every(([column, value]) => !value || display(row[column]).toLowerCase().includes(value.toLowerCase()))
      return matchesQuickFilter && matchesColumnFilters
    })
    if (!sort) return filtered
    return [...filtered].sort((left, right) => compare(left[sort.column], right[sort.column]) * sort.direction)
  }, [result.rows, sort, filter, columns, columnFilters])
  const viewport = 500
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)

  async function copy(value: unknown): Promise<void> {
    await navigator.clipboard.writeText(value === null ? 'NULL' : String(value))
  }
  function exportCsv(): void {
    const exportRows = selectedRows.length ? selectedRows.map((index) => rows[index]).filter((row): row is Record<string, unknown> => Boolean(row)) : rows
    const csv = [columns, ...exportRows].map((row) => (Array.isArray(row) ? row : columns.map((column) => row[column])).map(csvCell).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `result-${index + 1}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedCell) {
      event.preventDefault()
      if (selectedRows.length) void copy(selectedRows.map((index) => columns.map((column) => rows[index]?.[column] === null ? 'NULL' : String(rows[index]?.[column] ?? '')).join('\t')).join('\n'))
      else void copy(rows[selectedCell.row]?.[selectedCell.column])
    }
  }
  function selectRow(row: number, event: React.MouseEvent): void {
    if (event.shiftKey && selectionAnchor !== undefined) {
      const low = Math.min(selectionAnchor, row); const high = Math.max(selectionAnchor, row)
      setSelectedRows(Array.from({ length: high - low + 1 }, (_, offset) => low + offset))
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedRows((current) => current.includes(row) ? current.filter((item) => item !== row) : [...current, row])
      setSelectionAnchor(row)
    } else { setSelectedRows([row]); setSelectionAnchor(row) }
  }
  function filterColumn(column: string): void {
    const value = window.prompt(`Filtrar ${column} por conteúdo:`, columnFilters[column] ?? '')
    if (value === null) return
    setColumnFilters((current) => ({ ...current, [column]: value }))
  }

  return <section className="grid-result" aria-label={`Result ${index + 1}`}>
    <div className="result-grid-scroll" tabIndex={0} onKeyDown={handleGridKeyDown} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <table className="result-grid"><thead><tr><th className="row-number-head">#</th>{columns.map((column) => <th key={column} draggable style={{ width: widths[column] }} onClick={() => setSort((current) => ({ column, direction: current?.column === column ? current.direction === 1 ? -1 : 1 : 1 }))} onDragStart={(event) => event.dataTransfer.setData('text/plain', column)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moved = event.dataTransfer.getData('text/plain'); const next = [...columns]; const from = next.indexOf(moved); const to = next.indexOf(column); if (from >= 0 && to >= 0) { next.splice(from, 1); next.splice(to, 0, moved); setOrder(next) } }} title="Sort ascending / descending; drag to reorder">{column}{sort?.column === column ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}<button className="column-filter-button" onClick={(event) => { event.stopPropagation(); filterColumn(column) }} aria-label={`Filter ${column}`}>⌕</button><span className="column-resizer" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); const startX = event.clientX; const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 120; const move = (moveEvent: PointerEvent): void => setWidths((current) => ({ ...current, [column]: Math.max(60, Math.min(360, startWidth + moveEvent.clientX - startX)) })); window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }} /></th>)}</tr></thead>
        <tbody><tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: first * ROW_HEIGHT }} /></tr>{rows.slice(first, last).map((row, offset) => <tr key={first + offset} className={selectedRows.includes(first + offset) ? 'selected-row' : ''} style={{ height: ROW_HEIGHT }}><td className="row-number" onClick={(event) => selectRow(first + offset, event)}>{first + offset + 1}</td>{columns.map((column) => <td key={column} title={display(row[column])} className={`${row[column] === null ? 'null-cell' : typeof row[column] === 'number' ? 'number-cell' : ''}${selectedCell?.row === first + offset && selectedCell.column === column ? ' selected-cell' : ''}`} onClick={() => setSelectedCell({ row: first + offset, column })} onDoubleClick={() => void copy(row[column])}>{display(row[column])}</td>)}</tr>)}<tr aria-hidden="true" className="grid-spacer"><td colSpan={columns.length + 1} style={{ height: Math.max(0, (rows.length - last) * ROW_HEIGHT) }} /></tr></tbody>
      </table>
      {rows.length === 0 && <div className="grid-empty">Nenhuma linha retornada.</div>}
    </div>
    <footer className="grid-footer"><span>{rows.length} rows{selectedRows.length ? ` · ${selectedRows.length} selected` : ''}</span>{onLoadMore && <button disabled={loadingMore} onClick={() => { setLoadingMore(true); void onLoadMore().finally(() => setLoadingMore(false)) }}>{loadingMore ? 'Loading…' : 'Load more'}</button>}<input className="grid-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter rows…" aria-label="Filter result rows" /><span className="toolbar-spacer" /><button onClick={() => { const copied = selectedRows.length ? selectedRows.map((index) => rows[index]).filter((row): row is Record<string, unknown> => Boolean(row)) : rows; void copy([columns.join('\t'), ...copied.map((row) => columns.map((column) => row[column] === null ? 'NULL' : String(row[column])).join('\t'))].join('\n')) }}>Copy TSV</button><button onClick={exportCsv}>Export CSV</button></footer>
  </section>
}

function compare(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true })
}

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value)
  return `"${text.replace(/"/g, '""')}"`
}

function display(value: unknown): string {
  if (value === null) return 'NULL'
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '')
  if (value instanceof Uint8Array) return `[BLOB ${value.byteLength.toLocaleString()} B]`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
