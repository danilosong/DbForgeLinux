import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { DiagramPoint, DiagramRelation, ERDiagram, DiagramTable } from '../../../../../modules/er-diagram/types.js'
import { usePanelConnection } from '../registry.js'
import './Panel.css'

type DisplayMode = 'names' | 'types' | 'keys'
const cardWidth = 250
const cardHeight = (table: DiagramTable): number => 42 + (table.collapsed ? 0 : Math.max(1, table.columns.length) * 25)
const color = (name: string, fallback: string): string => `var(${name},${fallback})`

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [connectionId, setConnectionId] = useState(activeConnection?.id ?? '')
  const [database, setDatabase] = useState(''); const [databases, setDatabases] = useState<string[]>([])
  const [diagram, setDiagram] = useState<ERDiagram | null>(null); const [selectedTable, setSelectedTable] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('types'); const [zoom, setZoom] = useState(1); const [pan, setPan] = useState<DiagramPoint>({ x: 0, y: 0 })
  const [message, setMessage] = useState('Selecione conexão e database para criar um diagrama.')
  const [busy, setBusy] = useState(false); const [relationName, setRelationName] = useState(''); const [fromTable, setFromTable] = useState(''); const [fromColumns, setFromColumns] = useState(''); const [toTable, setToTable] = useState(''); const [toColumns, setToColumns] = useState(''); const [relationComment, setRelationComment] = useState('')
  const [showRelations, setShowRelations] = useState(false); const [search, setSearch] = useState('')
  const svgRef = useRef<SVGSVGElement>(null); const dragRef = useRef<{ table?: string; pointerX: number; pointerY: number; startX: number; startY: number; panning: boolean } | null>(null)
  const activeRecord = connections.find((record) => record.id === connectionId)
  const visibleTables = useMemo(() => diagram?.tables.filter((table) => table.name.toLowerCase().includes(search.toLowerCase())) ?? [], [diagram, search])

  useEffect(() => { void window.dbforge.getConnections().then((items) => { setConnections(items); if (activeConnection) setConnectionId(activeConnection.id); else setConnectionId((current) => current || items[0]?.id || '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [activeConnection])
  useEffect(() => { if (!connectionId) { setDatabases([]); return } void window.dbforge.connect(connections.find((item) => item.id === connectionId)!).then(async (connected) => { try { setDatabases(await window.dbforge.listDatabases(connected.id)) } finally { await window.dbforge.disconnect(connected.id) } }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao listar databases.')) }, [connectionId, connections])

  async function load(): Promise<void> {
    if (!activeRecord || !database) { setMessage('Selecione uma conexão e um database.'); return }
    setBusy(true); setMessage('Lendo tabelas, colunas e relações…')
    try {
      const connected = await window.dbforge.connect(activeRecord)
      try { const next = await window.dbforge.loadERDiagram(connected.id, database, activeRecord.id); setDiagram(next); setSelectedTable(next.tables[0]?.name ?? ''); setPan({ x: 0, y: 0 }); setZoom(1); setMessage(`${next.tables.length} tabelas · ${next.relations.length} relações`) }
      finally { await window.dbforge.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar o diagrama.') }
    finally { setBusy(false) }
  }
  async function persistRelations(relations: DiagramRelation[]): Promise<void> {
    if (!diagram) return
    const next = { ...diagram, virtualRelations: relations, relations: [...diagram.relations.filter((item) => !item.virtual), ...relations] }
    setDiagram(next)
    try { await window.dbforge.saveVirtualRelations(diagram.connectionId, diagram.database, relations); setMessage('Relações virtuais salvas localmente.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar relações virtuais.') }
  }
  function addVirtualRelation(): void {
    if (!diagram) return
    const childColumns = fromColumns.split(',').map((value) => value.trim()).filter(Boolean); const parentColumns = toColumns.split(',').map((value) => value.trim()).filter(Boolean)
    if (!relationName.trim() || !childColumns.length || childColumns.length !== parentColumns.length) { setMessage('Informe um nome e o mesmo número de colunas em cada lado.'); return }
    const relation: DiagramRelation = { id: `virtual:${Date.now()}:${relationName.trim()}`, name: relationName.trim(), fromTable, fromColumns: childColumns, toTable, toColumns: parentColumns, comment: relationComment.trim(), virtual: true }
    void persistRelations([...diagram.virtualRelations, relation]); setRelationName(''); setFromColumns(''); setToColumns(''); setRelationComment('')
  }
  function layout(): void {
    if (!diagram) return
    const groups = new Map<number, DiagramTable[]>()
    const parents = diagram.relations.filter((item) => !item.virtual).map((item) => [item.toTable, item.fromTable] as const)
    const depth = new Map(diagram.tables.map((table) => [table.name, 0]))
    for (let pass = 0; pass < diagram.tables.length; pass++) for (const [parent, child] of parents) depth.set(child, Math.max(depth.get(child) ?? 0, (depth.get(parent) ?? 0) + 1))
    for (const table of diagram.tables) { const level = depth.get(table.name) ?? 0; const group = groups.get(level) ?? []; group.push(table); groups.set(level, group) }
    const next = { ...diagram, tables: diagram.tables.map((table) => { const level = depth.get(table.name) ?? 0; const index = groups.get(level)!.findIndex((item) => item.name === table.name); return { ...table, position: { x: 40 + level * 370, y: 40 + index * 310 } } }) }
    setDiagram(next); setMessage('Layout Diagram concluído.')
  }
  function dragStart(event: PointerEvent<SVGGElement>, table: DiagramTable): void { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedTable(table.name); dragRef.current = { table: table.name, pointerX: event.clientX, pointerY: event.clientY, startX: table.position.x, startY: table.position.y, panning: false } }
  function panStart(event: PointerEvent<SVGSVGElement>): void { if (event.target !== event.currentTarget) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, startX: pan.x, startY: pan.y, panning: true } }
  function pointerMove(event: PointerEvent<SVGSVGElement>): void {
    const drag = dragRef.current; if (!drag || !diagram) return
    const dx = (event.clientX - drag.pointerX) / zoom; const dy = (event.clientY - drag.pointerY) / zoom
    if (drag.panning) setPan({ x: drag.startX + dx * zoom, y: drag.startY + dy * zoom })
    else if (drag.table) setDiagram((current) => current ? { ...current, tables: current.tables.map((table) => table.name === drag.table ? { ...table, position: { x: Math.max(0, drag.startX + dx), y: Math.max(0, drag.startY + dy) } } : table) } : current)
  }
  function wheel(event: WheelEvent<SVGSVGElement>): void { if (!event.ctrlKey) return; event.preventDefault(); setZoom((current) => Math.max(0.25, Math.min(2, current * (event.deltaY < 0 ? 1.1 : 0.9)))) }
  function fit(): void {
    if (!diagram?.tables.length) { setPan({ x: 0, y: 0 }); setZoom(1); return }
    const maxX = Math.max(...diagram.tables.map((table) => table.position.x + cardWidth)); const maxY = Math.max(...diagram.tables.map((table) => table.position.y + cardHeight(table)))
    const bounds = svgRef.current?.getBoundingClientRect(); if (!bounds) return
    setZoom(Math.max(0.25, Math.min(1.5, Math.min(1100 / (maxX + 80), 700 / (maxY + 80))))); setPan({ x: 30, y: 30 })
  }
  async function exportImage(format: 'svg' | 'png'): Promise<void> {
    const source = svgRef.current; if (!source) return
    const clone = source.cloneNode(true) as SVGSVGElement; clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', '1100'); clone.setAttribute('height', '700')
    const svgText = new XMLSerializer().serializeToString(clone); const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    if (format === 'svg') { download(blob, `${diagram?.database ?? 'diagram'}.svg`); return }
    const image = new Image(); const url = URL.createObjectURL(blob)
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 700; const context = canvas.getContext('2d'); if (context) { context.fillStyle = getComputedStyle(source).backgroundColor || '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); canvas.toBlob((output) => { if (output) download(output, `${diagram?.database ?? 'diagram'}.png`); URL.revokeObjectURL(url) }, 'image/png') } else URL.revokeObjectURL(url) }
    image.onerror = () => { URL.revokeObjectURL(url); setMessage('The error occurred while diagram exporting.') }; image.src = url
  }
  async function saveDiagram(): Promise<void> { if (!diagram) return; try { const path = await window.dbforge.saveERDiagram(diagram); if (path) setMessage(`Diagrama salvo: ${path}`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar diagrama.') } }
  async function openDiagram(): Promise<void> { try { const opened = await window.dbforge.openERDiagram(); if (opened) { setDiagram(opened); setConnectionId(opened.connectionId); setDatabase(opened.database); setSelectedTable(opened.tables[0]?.name ?? ''); setMessage(`Database Diagram · ${opened.database}`) } } catch (error) { setMessage(error instanceof Error ? error.message : 'Diagram deserialization failed.') } }
  function download(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }

  const tablesByName = new Map(diagram?.tables.map((table) => [table.name, table]) ?? [])
  return <section className="tool-panel er-panel" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === '0') fit(); else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') layout(); else if (event.key === 'Delete' && selectedTable) { setDiagram((current) => current ? { ...current, tables: current.tables.filter((table) => table.name !== selectedTable), relations: current.relations.filter((relation) => relation.fromTable !== selectedTable && relation.toTable !== selectedTable) } : current); setSelectedTable('') } }} tabIndex={0}>
    <header className="er-header"><div><h2>{t('erd.title')}</h2><p>{diagram ? `${diagram.database} · ${diagram.tables.length} tables` : 'Create an empty database diagram'}</p></div><div className="er-toolbar"><label>Connection<select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Database<select value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">Select database</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={busy || !database} onClick={() => void load()}>{busy ? 'Loading…' : 'Load Diagram'}</button><button disabled={!diagram} onClick={layout}>{t('erd.cmd.layout')}</button><button onClick={() => void openDiagram()}>Open</button><button disabled={!diagram} onClick={() => void saveDiagram()}>Save</button><button disabled={!diagram} onClick={() => setShowRelations((value) => !value)}>{t('erd.vr.manager')}</button><select aria-label="Show columns" value={displayMode} onChange={(event) => setDisplayMode(event.target.value as DisplayMode)}><option value="names">Names</option><option value="types">Names + Types</option><option value="keys">Keys only</option></select><button disabled={!diagram} onClick={() => void exportImage('svg')}>Export SVG</button><button disabled={!diagram} onClick={() => void exportImage('png')}>Export PNG</button><button disabled={!diagram} onClick={fit}>Fit</button><label>Zoom<input aria-label="Zoom" type="range" min="25" max="150" value={zoom * 100} onChange={(event) => setZoom(Number(event.target.value) / 100)} /></label></div></header>
    {!diagram ? <div className="er-empty" role="status">{message}</div> : <div className="er-workspace">
      <div className="er-canvas-wrap"><svg ref={svgRef} className="er-canvas" viewBox="0 0 1100 700" onPointerDown={panStart} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} onWheel={wheel} role="application" aria-label="ER diagram canvas" tabIndex={0}>
        <defs><marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={color('--muted', '#777')} /></marker></defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {diagram.relations.map((relation) => { const from = tablesByName.get(relation.fromTable); const to = tablesByName.get(relation.toTable); if (!from || !to) return null; const x1 = from.position.x + cardWidth / 2; const y1 = from.position.y + cardHeight(from) / 2; const x2 = to.position.x + cardWidth / 2; const y2 = to.position.y + cardHeight(to) / 2; return <g key={relation.id} aria-label={`${relation.virtual ? 'Virtual' : 'Foreign key'} ${relation.name}`}><path d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} fill="none" stroke={relation.virtual ? color('--accent', '#548bd8') : color('--muted', '#777')} strokeWidth="2" strokeDasharray={relation.virtual ? '7 5' : undefined} markerEnd="url(#erd-arrow)"/><title>{relation.name} · {relation.fromTable}({relation.fromColumns.join(', ')}) → {relation.toTable}({relation.toColumns.join(', ')}){relation.virtual ? ' · virtual' : ''}</title></g> })}
          {visibleTables.map((table) => <g key={table.name} transform={`translate(${table.position.x} ${table.position.y})`} onPointerDown={(event) => dragStart(event, table)} onPointerMove={(event) => { if (dragRef.current?.table) pointerMove(event as unknown as PointerEvent<SVGSVGElement>) }} onClick={() => setSelectedTable(table.name)} className={`er-table ${selectedTable === table.name ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Table ${table.name}`}>
            <rect width={cardWidth} height={cardHeight(table)} rx="6" /><rect width={cardWidth} height="42" rx="6" className="er-table-head"/><text x="12" y="27" className="er-table-title">▦ {table.name}</text><text x={cardWidth - 28} y="26" className="er-collapse" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setDiagram((current) => current ? { ...current, tables: current.tables.map((item) => item.name === table.name ? { ...item, collapsed: !item.collapsed } : item) } : current) }}>{table.collapsed ? '+' : '−'}</text>
            {!table.collapsed && table.columns.map((column, index) => { const isKey = table.columns.some((item) => item.name === column.name && diagram.relations.some((relation) => relation.fromTable === table.name && relation.fromColumns.includes(column.name))) || diagram.relations.some((relation) => relation.toTable === table.name && relation.toColumns.includes(column.name)); if (displayMode === 'keys' && !isKey) return null; return <g key={column.name}><text x="12" y={63 + index * 25} className="er-column-key">{isKey ? '◆' : ' '}</text><text x="29" y={63 + index * 25} className="er-column-name">{column.name}</text>{displayMode === 'types' && <text x={cardWidth - 10} y={63 + index * 25} textAnchor="end" className="er-column-type">{column.type}</text>}</g> })}
          </g>)}
        </g>
      </svg><div className="er-canvas-status">{message}</div></div>
      <aside className="er-side"><div><h3>{t('erd.overview')}</h3><div className="er-minimap" onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setPan({ x: -(event.clientX - bounds.left) * 2, y: -(event.clientY - bounds.top) * 2 }) }}>{diagram.tables.map((table) => <span key={table.name} title={table.name} style={{ left: `${Math.min(90, table.position.x / 18)}%`, top: `${Math.min(90, table.position.y / 12)}%` }} />)}</div><label>Zoom<input type="range" min="25" max="150" value={zoom * 100} onChange={(event) => setZoom(Number(event.target.value) / 100)} /></label></div>
        <div><h3>Tables</h3><input placeholder="Search tables" value={search} onChange={(event) => setSearch(event.target.value)} /><ul>{visibleTables.map((table) => <li key={table.name}><button className={selectedTable === table.name ? 'selected' : ''} onClick={() => { setSelectedTable(table.name); setPan({ x: 100 - table.position.x * zoom, y: 100 - table.position.y * zoom }) }}>{table.name}</button></li>)}</ul></div>
        <div className="er-properties"><h3>Properties</h3>{diagram.tables.find((table) => table.name === selectedTable) ? <><b>{selectedTable}</b><span>{diagram.tables.find((table) => table.name === selectedTable)!.columns.length} columns</span><span>{diagram.relations.filter((relation) => relation.fromTable === selectedTable || relation.toTable === selectedTable).length} relations</span><button onClick={() => setDiagram((current) => current ? { ...current, tables: current.tables.filter((table) => table.name !== selectedTable), relations: current.relations.filter((relation) => relation.fromTable !== selectedTable && relation.toTable !== selectedTable) } : current)}>{t('erd.cmd.removeFromDiagram')}</button></> : <span>Select a table</span>}</div>
      </aside>
    </div>}
    {showRelations && diagram && <div className="er-relations" role="dialog" aria-label={t('erd.vr.manager')}><header><h3>{t('erd.vr.manager')}</h3><button onClick={() => setShowRelations(false)}>Close</button></header><div className="er-rel-form"><label>Name<input value={relationName} onChange={(event) => setRelationName(event.target.value)} /></label><label>Child table<select value={fromTable} onChange={(event) => setFromTable(event.target.value)}><option value="">Select table</option>{diagram.tables.map((table) => <option key={table.name}>{table.name}</option>)}</select></label><label>Child table columns<input value={fromColumns} onChange={(event) => setFromColumns(event.target.value)} placeholder="column_a, column_b" /></label><label>Parent table<select value={toTable} onChange={(event) => setToTable(event.target.value)}><option value="">Select table</option>{diagram.tables.map((table) => <option key={table.name}>{table.name}</option>)}</select></label><label>Parent table columns<input value={toColumns} onChange={(event) => setToColumns(event.target.value)} placeholder="id" /></label><label>Comment<input value={relationComment} onChange={(event) => setRelationComment(event.target.value)} /></label><button onClick={addVirtualRelation}>New Virtual Relation</button></div><div className="er-relation-list">{diagram.virtualRelations.length ? diagram.virtualRelations.map((relation) => <div key={relation.id}><span>{relation.name} · {relation.fromTable}.{relation.fromColumns.join(',')} → {relation.toTable}.{relation.toColumns.join(',')}</span><button onClick={() => void persistRelations(diagram.virtualRelations.filter((item) => item.id !== relation.id))}>Delete</button></div>) : <p>Nenhuma relação virtual</p>}</div></div>}
  </section>
}
