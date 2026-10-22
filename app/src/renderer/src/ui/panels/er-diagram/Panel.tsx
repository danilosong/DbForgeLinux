import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { DiagramPoint, DiagramRelation, ERDiagram, DiagramTable } from '../../../../../modules/er-diagram/types.js'
import { avoidTableOverlap, routeERRelation } from '../../../../../modules/er-diagram/routing.js'
import { databaseObjectDragType, parseDatabaseObjectDrag } from '../../../../../shared/databaseObjectDrag.js'
import { encodeBmp24, encodeGif, encodeTiff24 } from '../../../../../modules/er-diagram/bitmap.js'
import { usePanelConnection } from '../registry.js'
import './Panel.css'

type DisplayMode = 'names' | 'types' | 'keys'
const cardWidth = 250
const cardHeight = (table: DiagramTable): number => 42 + (table.collapsed ? 0 : Math.max(1, table.columns.length) * 25 + [['Constraints', table.constraintNames], ['Indexes', table.indexNames], ['Triggers', table.triggerNames]].reduce((height, [section, values]) => height + 20 + (table.collapsedSections?.[section as 'Constraints' | 'Indexes' | 'Triggers'] ? 0 : (values as string[] | undefined)?.length ? (values as string[]).length * 18 : 0), 0))
const typeName = (value: string): string => value.replace(/\s*\([^)]*\)/g, '').trim()
const color = (name: string, fallback: string): string => `var(${name},${fallback})`

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [connectionId, setConnectionId] = useState(activeConnection?.recordId ?? activeConnection?.id ?? '')
  const [database, setDatabase] = useState(activeConnection?.database ?? ''); const [databases, setDatabases] = useState<string[]>([])
  const [diagram, setDiagram] = useState<ERDiagram | null>(null); const [selectedTable, setSelectedTable] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('types'); const [zoom, setZoom] = useState(1); const [pan, setPan] = useState<DiagramPoint>({ x: 0, y: 0 })
  const [message, setMessage] = useState(t('ui.erDiagram.initial'))
  const [busy, setBusy] = useState(false); const [relationName, setRelationName] = useState(''); const [fromTable, setFromTable] = useState(''); const [fromColumns, setFromColumns] = useState(''); const [toTable, setToTable] = useState(''); const [toColumns, setToColumns] = useState(''); const [relationComment, setRelationComment] = useState('')
  const [showRelations, setShowRelations] = useState(false); const [search, setSearch] = useState(''); const [editingRelationId, setEditingRelationId] = useState(''); const [relationDdl, setRelationDdl] = useState('')
  const [showOverview, setShowOverview] = useState(false)
  const [relationPropertiesTab, setRelationPropertiesTab] = useState<'General' | 'Advanced'>('General')
  const [relationOnDelete, setRelationOnDelete] = useState('RESTRICT')
  const [relationOnUpdate, setRelationOnUpdate] = useState('RESTRICT')
  const svgRef = useRef<SVGSVGElement>(null); const dragRef = useRef<{ table?: string; container?: string; note?: string; pointerX: number; pointerY: number; startX: number; startY: number; panning: boolean } | null>(null)
  const overviewDragRef = useRef(false)
  const activeRecord = connections.find((record) => record.id === connectionId)
  const visibleTables = useMemo(() => diagram?.tables.filter((table) => table.name.toLowerCase().includes(search.toLowerCase())) ?? [], [diagram, search])

  useEffect(() => { void window.tuxsql.getConnections().then((items) => { setConnections(items); setConnectionId((current) => items.some((item) => item.id === current) ? current : activeConnection?.recordId && items.some((item) => item.id === activeConnection.recordId) ? activeConnection.recordId : activeConnection?.id && items.some((item) => item.id === activeConnection.id) ? activeConnection.id : items[0]?.id ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('ui.erDiagram.connectionsLoadError'))) }, [activeConnection, t])
  useEffect(() => { if (!connectionId) { setDatabases([]); return } void window.tuxsql.connect(connections.find((item) => item.id === connectionId)!).then(async (connected) => { try { setDatabases(await window.tuxsql.listDatabases(connected.id)) } finally { await window.tuxsql.disconnect(connected.id) } }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : t('ui.erDiagram.databasesLoadError'))) }, [connectionId, connections, t])

  async function load(): Promise<void> {
    if (!activeRecord || !database) { setMessage(t('ui.erDiagram.selectConnectionDatabase')); return }
    setBusy(true); setMessage(t('ui.erDiagram.loading'))
    try {
      const connected = await window.tuxsql.connect(activeRecord)
      try { const next = await window.tuxsql.loadERDiagram(connected.id, database, activeRecord.id); setDiagram(next); setSelectedTable(next.tables[0]?.name ?? ''); setPan({ x: 0, y: 0 }); setZoom(1); setMessage(t('ui.erDiagram.loaded', [next.tables.length, next.relations.length])) }
      finally { await window.tuxsql.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : t('ui.erDiagram.loadFailed')) }
    finally { setBusy(false) }
  }
  async function dropExplorerObject(event: React.DragEvent<HTMLDivElement>): Promise<void> {
    const payload = parseDatabaseObjectDrag(event.dataTransfer.getData(databaseObjectDragType))
    if (!payload) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const requested = { x: Math.max(20, (event.clientX - bounds.left - pan.x) / zoom), y: Math.max(20, (event.clientY - bounds.top - pan.y) / zoom) }
    const payloadRecord = connections.find((item) => item.id === payload.connectionId)
    const targetRecord = connections.find((item) => item.id === connectionId)
    if (!payloadRecord || targetRecord && targetRecord.id !== payloadRecord.id || database && database !== payload.database || diagram && (diagram.connectionId !== payload.connectionId || diagram.database !== payload.database)) { setMessage(t('extras.erd.dropContextMismatch')); return }
    const sourceRecord = targetRecord ?? payloadRecord
    if (!targetRecord) setConnectionId(sourceRecord.id)
    if (!database) setDatabase(payload.database)
    if (diagram?.connectionId === payload.connectionId && diagram.database === payload.database && diagram.tables.some((table) => table.name === payload.name)) { setSelectedTable(payload.name); return }
    setBusy(true)
    try {
      const connected = await window.tuxsql.connect(sourceRecord)
      try {
        let fresh: ERDiagram | null = null
        if (payload.kind === 'table') fresh = await window.tuxsql.loadERDiagram(connected.id, payload.database, sourceRecord.id)
        const querySchema = payload.kind === 'view' ? await window.tuxsql.getQueryBuilderSchema(connected.id, payload.database) : undefined
        let added = fresh?.tables.find((table) => table.name === payload.name)
        if (!added && querySchema) {
          const source = querySchema.tables.find((table) => table.name === payload.name)
          if (source) added = { name: source.name, columns: source.columns.map((column) => ({ name: column.name, type: column.type, nullable: column.nullable ?? true, ...(column.primaryKey ? { default: undefined } : {}) })), position: { x: 40, y: 40 } }
        }
        if (!added) { setMessage(t('extras.erd.dropUnavailable', [payload.name])); return }
        const base = diagram?.connectionId === payload.connectionId && diagram.database === payload.database ? diagram : { version: 1 as const, connectionId: payload.connectionId, database: payload.database, tables: [], relations: [], virtualRelations: [] }
        const others = base.tables.map((table) => ({ position: table.position, width: cardWidth, height: cardHeight(table) }))
        added = { ...added, position: avoidTableOverlap(requested, cardWidth, cardHeight(added), others) }
        const names = new Set([...base.tables.map((table) => table.name), added.name])
        const relations = fresh ? [...base.relations.filter((relation) => !relation.virtual), ...fresh.relations.filter((relation) => names.has(relation.fromTable) && names.has(relation.toTable) && !base.relations.some((item) => item.id === relation.id))] : base.relations
        const next = { ...base, tables: [...base.tables.filter((table) => table.name !== added!.name), added], relations }
        setDiagram(next); setSelectedTable(added.name); setMessage(t('extras.erd.dropAdded', [added.name]))
      } finally { await window.tuxsql.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : t('extras.erd.dropFailed')) }
    finally { setBusy(false) }
  }
  async function persistRelations(relations: DiagramRelation[]): Promise<void> {
    if (!diagram) return
    const next = { ...diagram, virtualRelations: relations, relations: [...diagram.relations.filter((item) => !item.virtual), ...relations] }
    setDiagram(next)
    try { await window.tuxsql.saveVirtualRelations(diagram.connectionId, diagram.database, relations); setMessage(t('extras.erd.saved')) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('ui.erDiagram.saveRelationsFailed')) }
  }
  function addVirtualRelation(): void {
    if (!diagram) return
    const childColumns = fromColumns.split(',').map((value) => value.trim()).filter(Boolean); const parentColumns = toColumns.split(',').map((value) => value.trim()).filter(Boolean)
    if (!childColumns.length || childColumns.length !== parentColumns.length) { setMessage(t('ui.erDiagram.relationInvalid')); return }
    if (!diagram.tables.some((table) => table.name === fromTable) || !diagram.tables.some((table) => table.name === toTable)) { setMessage(t('extras.erd.selectTables')); return }
    const prior = diagram.virtualRelations.find((item) => item.id === editingRelationId)
    const baseName = relationName.trim() || `${fromTable}_VR`
    const nextNumber = Math.max(0, ...diagram.virtualRelations.filter((item) => item.id !== prior?.id && item.name.startsWith(baseName)).map((item) => Number(item.name.slice(baseName.length)) || 0)) + 1
    const finalName = relationName.trim() || `${baseName}${nextNumber}`
    const relation: DiagramRelation = { id: prior?.id ?? `virtual:${Date.now()}:${finalName}`, name: finalName, fromTable, fromColumns: childColumns, toTable, toColumns: parentColumns, comment: relationComment.trim(), onDelete: relationOnDelete, onUpdate: relationOnUpdate, virtual: true }
    void persistRelations([...diagram.virtualRelations.filter((item) => item.id !== relation.id), relation]); setEditingRelationId(''); setRelationName(''); setFromTable(''); setFromColumns(''); setToTable(''); setToColumns(''); setRelationComment('')
  }
  function editRelation(relation: DiagramRelation): void { setEditingRelationId(relation.id); setRelationPropertiesTab('General'); setRelationName(relation.name); setFromTable(relation.fromTable); setFromColumns(relation.fromColumns.join(', ')); setToTable(relation.toTable); setToColumns(relation.toColumns.join(', ')); setRelationComment(relation.comment ?? ''); setRelationOnDelete(relation.onDelete ?? 'RESTRICT'); setRelationOnUpdate(relation.onUpdate ?? 'RESTRICT') }
  async function showRelationDdl(relation: DiagramRelation): Promise<void> {
    if (!diagram) return
    const quote = (value: string): string => `\`${value.replaceAll('`', '``')}\``
    const constraint = `${relation.fromTable}_${relation.name}`.replace(/[^A-Za-z0-9_$]/g, '_')
    const ddl = `ALTER TABLE ${quote(diagram.database)}.${quote(relation.fromTable)}\n  ADD CONSTRAINT ${quote(constraint)} FOREIGN KEY (${relation.fromColumns.map(quote).join(', ')})\n  REFERENCES ${quote(diagram.database)}.${quote(relation.toTable)} (${relation.toColumns.map(quote).join(', ')});`
    setRelationDdl(ddl)
  }
  async function convertRelation(relation: DiagramRelation): Promise<void> {
    if (!diagram || !activeRecord) return
    const child = diagram.tables.find((table) => table.name === relation.fromTable); const parent = diagram.tables.find((table) => table.name === relation.toTable)
    const childColumns = relation.fromColumns.map((name) => child?.columns.find((column) => column.name === name)); const parentColumns = relation.toColumns.map((name) => parent?.columns.find((column) => column.name === name))
    if (childColumns.some((column) => !column) || parentColumns.some((column) => !column)) { setMessage(t('extras.erd.missingColumns')); return }
    if (childColumns.some((column, index) => column!.type.toLowerCase().replace(/\s+/g, '') !== parentColumns[index]!.type.toLowerCase().replace(/\s+/g, ''))) { setMessage(t('extras.erd.typeMismatch')); return }
    const quote = (value: string): string => `\`${value.replaceAll('`', '``')}\``
    const childAlias = 'c'; const parentAlias = 'p'
    const joins = relation.fromColumns.map((column, index) => `${childAlias}.${quote(column)} = ${parentAlias}.${quote(relation.toColumns[index]!)}`).join(' AND ')
    const nonNull = relation.fromColumns.map((column) => `${childAlias}.${quote(column)} IS NOT NULL`).join(' AND ')
    const sql = `SELECT 1 FROM ${quote(diagram.database)}.${quote(relation.fromTable)} ${childAlias} LEFT JOIN ${quote(diagram.database)}.${quote(relation.toTable)} ${parentAlias} ON ${joins} WHERE ${nonNull} AND ${parentAlias}.${quote(relation.toColumns[0]!)} IS NULL LIMIT 1`
    try {
      const connected = await window.tuxsql.connect(activeRecord!)
      try { const results = await window.tuxsql.executeSql(connected.id, sql); if (results[0]?.rows?.length) { setMessage(t('extras.erd.orphans')); return } } finally { await window.tuxsql.disconnect(connected.id) }
      const quoteConstraint = `${relation.fromTable}_${relation.name}`.replace(/[^A-Za-z0-9_$]/g, '_')
      const finalDdl = `ALTER TABLE ${quote(diagram.database)}.${quote(relation.fromTable)} ADD CONSTRAINT ${quote(quoteConstraint)} FOREIGN KEY (${relation.fromColumns.map(quote).join(', ')}) REFERENCES ${quote(diagram.database)}.${quote(relation.toTable)} (${relation.toColumns.map(quote).join(', ')});`
      if (!window.confirm(t('extras.erd.confirmConvert'))) return
      await window.tuxsql.queueSchemaUpdate({ connectionId: diagram.connectionId, database: diagram.database, source: `Virtual relation · ${relation.name}`, script: finalDdl })
      setMessage(t('extras.erd.queued'))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Foreign key check failed.') }
  }
  function layout(): void {
    if (!diagram) return
    const groups = new Map<number, DiagramTable[]>()
    const parents = diagram.relations.filter((item) => !item.virtual).map((item) => [item.toTable, item.fromTable] as const)
    const depth = new Map(diagram.tables.map((table) => [table.name, 0]))
    for (let pass = 0; pass < diagram.tables.length; pass++) for (const [parent, child] of parents) depth.set(child, Math.max(depth.get(child) ?? 0, (depth.get(parent) ?? 0) + 1))
    for (const table of diagram.tables) { const level = depth.get(table.name) ?? 0; const group = groups.get(level) ?? []; group.push(table); groups.set(level, group) }
    const next = { ...diagram, tables: diagram.tables.map((table) => { const level = depth.get(table.name) ?? 0; const index = groups.get(level)!.findIndex((item) => item.name === table.name); return { ...table, position: { x: 40 + level * 370, y: 40 + index * 310 } } }) }
    setDiagram(next); setMessage(t('ui.erDiagram.layoutComplete'))
  }
  function dragStart(event: PointerEvent<SVGGElement>, table: DiagramTable): void { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedTable(table.name); dragRef.current = { table: table.name, pointerX: event.clientX, pointerY: event.clientY, startX: table.position.x, startY: table.position.y, panning: false } }
  function panStart(event: PointerEvent<SVGSVGElement>): void { if (event.target !== event.currentTarget) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, startX: pan.x, startY: pan.y, panning: true } }
  function pointerMove(event: PointerEvent<SVGSVGElement>): void {
    const drag = dragRef.current; if (!drag || !diagram) return
    const dx = (event.clientX - drag.pointerX) / zoom; const dy = (event.clientY - drag.pointerY) / zoom
    if (drag.panning) setPan({ x: drag.startX + dx * zoom, y: drag.startY + dy * zoom })
    else if (drag.table) setDiagram((current) => current ? { ...current, tables: current.tables.map((table) => table.name === drag.table ? { ...table, position: { x: Math.max(0, drag.startX + dx), y: Math.max(0, drag.startY + dy) } } : table) } : current)
    else if (drag.container) setDiagram((current) => current ? { ...current, containers: (current.containers ?? []).map((item) => item.id === drag.container ? { ...item, position: { x: Math.max(0, drag.startX + dx), y: Math.max(0, drag.startY + dy) } } : item) } : current)
    else if (drag.note) setDiagram((current) => current ? { ...current, notes: (current.notes ?? []).map((item) => item.id === drag.note ? { ...item, position: { x: Math.max(0, drag.startX + dx), y: Math.max(0, drag.startY + dy) } } : item) } : current)
  }
  function finishDrag(): void {
    const dragged = dragRef.current?.table
    dragRef.current = null
    if (!dragged) return
    setDiagram((current) => {
      if (!current) return current
      const moving = current.tables.find((table) => table.name === dragged)
      if (!moving) return current
      const others = current.tables.filter((table) => table.name !== dragged).map((table) => ({ position: table.position, width: cardWidth, height: cardHeight(table) }))
      const position = avoidTableOverlap(moving.position, cardWidth, cardHeight(moving), others)
      if (position === moving.position) return current
      return { ...current, tables: current.tables.map((table) => table.name === dragged ? { ...table, position } : table) }
    })
  }
  function wheel(event: WheelEvent<SVGSVGElement>): void { if (!event.ctrlKey) return; event.preventDefault(); setZoom((current) => Math.max(0.25, Math.min(2, current * (event.deltaY < 0 ? 1.1 : 0.9)))) }
  function fit(): void {
    if (!diagram?.tables.length) { setPan({ x: 0, y: 0 }); setZoom(1); return }
    const maxX = Math.max(...diagram.tables.map((table) => table.position.x + cardWidth)); const maxY = Math.max(...diagram.tables.map((table) => table.position.y + cardHeight(table)))
    const bounds = svgRef.current?.getBoundingClientRect(); if (!bounds) return
    setZoom(Math.max(0.25, Math.min(1.5, Math.min(1100 / (maxX + 80), 700 / (maxY + 80))))); setPan({ x: 30, y: 30 })
  }
  function addContainer(): void { if (!diagram) return; const id = `container-${Date.now()}`; setDiagram({ ...diagram, containers: [...(diagram.containers ?? []), { id, title: `Group ${(diagram.containers?.length ?? 0) + 1}`, position: { x: 60, y: 330 }, width: 380, height: 260 }] }); setMessage('Grouping area added; drag it to arrange related objects.') }
  function addNote(): void { if (!diagram) return; const id = `note-${Date.now()}`; setDiagram({ ...diagram, notes: [...(diagram.notes ?? []), { id, text: 'Add a design note', position: { x: 720, y: 390 } }] }); setMessage('Sticky note added; drag it to arrange the diagram.') }
  async function exportImage(format: 'svg' | 'png' | 'jpg' | 'bmp' | 'gif' | 'tiff'): Promise<void> {
    const source = svgRef.current; if (!source) return
    const clone = source.cloneNode(true) as SVGSVGElement; clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', '1100'); clone.setAttribute('height', '700')
    const svgText = new XMLSerializer().serializeToString(clone); const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    if (format === 'svg') { download(blob, `${diagram?.database ?? 'diagram'}.svg`); return }
    const image = new Image(); const url = URL.createObjectURL(blob)
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 700; const context = canvas.getContext('2d'); if (context) { context.fillStyle = getComputedStyle(source).backgroundColor || '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); const extension = format; if (format === 'bmp' || format === 'tiff' || format === 'gif') { const pixels = context.getImageData(0, 0, canvas.width, canvas.height); const bytes = format === 'bmp' ? encodeBmp24(canvas.width, canvas.height, pixels.data) : format === 'gif' ? encodeGif(canvas.width, canvas.height, pixels.data) : encodeTiff24(canvas.width, canvas.height, pixels.data); download(new Blob([bytes.buffer as ArrayBuffer], { type: format === 'bmp' ? 'image/bmp' : format === 'gif' ? 'image/gif' : 'image/tiff' }), `${diagram?.database ?? 'diagram'}.${format}`); URL.revokeObjectURL(url) } else canvas.toBlob((output) => { if (output) download(output, `${diagram?.database ?? 'diagram'}.${extension}`); URL.revokeObjectURL(url) }, format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.92 : undefined) } else URL.revokeObjectURL(url) }
    image.onerror = () => { URL.revokeObjectURL(url); setMessage('The error occurred while diagram exporting.') }; image.src = url
  }
  async function saveDiagram(): Promise<void> { if (!diagram) return; try { const path = await window.tuxsql.saveERDiagram(diagram); if (path) setMessage(`Diagram saved: ${path}`) } catch (error) { setMessage(error instanceof Error ? error.message : t('ui.erDiagram.saveFailed')) } }
  async function openDiagram(): Promise<void> { try { const opened = await window.tuxsql.openERDiagram(); if (opened) { setDiagram(opened); setConnectionId(opened.connectionId); setDatabase(opened.database); setSelectedTable(opened.tables[0]?.name ?? ''); setMessage(`Database Diagram · ${opened.database}`) } } catch (error) { setMessage(error instanceof Error ? error.message : 'Diagram deserialization failed.') } }
  function download(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }

  const tablesByName = new Map(diagram?.tables.map((table) => [table.name, table]) ?? [])
  const viewTop = diagram ? Math.min(0, ...diagram.tables.map((table) => table.position.y - 30 - diagram.relations.length * 10)) : 0
  const viewBottom = diagram ? Math.max(700, ...diagram.tables.map((table) => table.position.y + cardHeight(table) + 90)) : 700
  const overviewBounds = diagram ? { minX: Math.min(0, ...diagram.tables.map((table) => table.position.x)), maxX: Math.max(1100, ...diagram.tables.map((table) => table.position.x + cardWidth)), minY: viewTop, maxY: viewBottom } : { minX: 0, maxX: 1100, minY: 0, maxY: 700 }
  const overviewWidth = Math.max(1, overviewBounds.maxX - overviewBounds.minX); const overviewHeight = Math.max(1, overviewBounds.maxY - overviewBounds.minY)
  const viewport = { left: Math.max(0, Math.min(100, ((-pan.x / zoom - overviewBounds.minX) / overviewWidth) * 100)), top: Math.max(0, Math.min(100, ((viewTop - pan.y / zoom - overviewBounds.minY) / overviewHeight) * 100)), width: Math.min(100, 1100 / zoom / overviewWidth * 100), height: Math.min(100, Math.max(700, viewBottom - viewTop) / zoom / overviewHeight * 100) }
  function moveOverview(clientX: number, clientY: number, element: HTMLDivElement): void { const bounds = element.getBoundingClientRect(); const x = overviewBounds.minX + Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * overviewWidth; const y = overviewBounds.minY + Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)) * overviewHeight; setPan({ x: 550 - x * zoom, y: Math.max(700, viewBottom - viewTop) / 2 - (y - viewTop) * zoom }) }
  return <section className="tool-panel er-panel" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === '0') fit(); else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') layout(); else if (event.key === 'Delete' && selectedTable) { setDiagram((current) => current ? { ...current, tables: current.tables.filter((table) => table.name !== selectedTable), relations: current.relations.filter((relation) => relation.fromTable !== selectedTable && relation.toTable !== selectedTable) } : current); setSelectedTable('') } }} tabIndex={0}>
    <header className="er-header"><div><h2>{t('erd.title')}</h2><p>{diagram ? `${diagram.database} · ${diagram.tables.length} tables` : 'Create an empty database diagram'}</p></div><div className="er-toolbar"><label>{t('panel.er.diagram.me4e270ec49')}<select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t('panel.er.diagram.mc5a6e6c2aa')}<select value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">{t('panel.er.diagram.m1883614bfd')}</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={busy || !database} onClick={() => void load()}>{busy ? 'Loading…' : 'Load Diagram'}</button><button disabled={!diagram} onClick={layout}>{t('erd.cmd.layout')}</button><button onClick={() => void openDiagram()}>{t('panel.er.diagram.m6ee5a92468')}</button><button disabled={!diagram} onClick={() => void saveDiagram()}>{t('panel.er.diagram.m0ff6109a08')}</button><button disabled={!diagram} onClick={addContainer}>Add container</button><button disabled={!diagram} onClick={addNote}>Add note</button><button disabled={!diagram} onClick={() => { setEditingRelationId(''); setRelationPropertiesTab('General'); setShowRelations((value) => !value) }}>{t('erd.vr.manager')}</button><select aria-label={t('panel.er.diagram.m068b6d907a')} value={displayMode} onChange={(event) => setDisplayMode(event.target.value as DisplayMode)}><option value="names">{t('panel.er.diagram.meb0366a3ba')}</option><option value="types">{t('panel.er.diagram.mf61b88b7be')}</option><option value="keys">{t('panel.er.diagram.mc7f0b33a8c')}</option></select>{(['svg', 'png', 'jpg', 'bmp', 'gif', 'tiff'] as const).map((format) => <button key={format} disabled={!diagram} onClick={() => void exportImage(format)}>{format.toUpperCase()}</button>)}<button disabled={!diagram} onClick={fit}>{t('panel.er.diagram.m2253454c16')}</button><label>{t('panel.er.diagram.m9425de4cca')}<input aria-label={t('panel.er.diagram.m9425de4cca')} type="range" min="25" max="150" value={zoom * 100} onChange={(event) => setZoom(Number(event.target.value) / 100)} /></label></div></header>
    {!diagram ? <div className="er-empty" role="status" onDragOver={(event) => { if (event.dataTransfer.types.includes(databaseObjectDragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={(event) => { event.preventDefault(); void dropExplorerObject(event) }}>{message} <span>{t('extras.erd.dropHint')}</span></div> : <div className="er-workspace">
      <div className="er-canvas-wrap" onDragOver={(event) => { if (event.dataTransfer.types.includes(databaseObjectDragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={(event) => { event.preventDefault(); void dropExplorerObject(event) }}><svg ref={svgRef} className="er-canvas" viewBox={`0 ${viewTop} 1100 ${Math.max(700, viewBottom - viewTop)}`} onPointerDown={panStart} onPointerMove={pointerMove} onPointerUp={finishDrag} onPointerCancel={() => { dragRef.current = null }} onWheel={wheel} role="application" aria-label={t('panel.er.diagram.m70a8059fb6')} tabIndex={0}>
        <defs><marker id="erd-many" markerWidth="12" markerHeight="12" refX="11" refY="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L11 6 L0 12 M0 6 L11 6 M0 12 L11 6" fill="none" stroke={color('--muted', '#777')} strokeWidth="1.5" /></marker><marker id="erd-one" markerWidth="10" markerHeight="12" refX="1" refY="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M2 0 L2 12 M7 0 L7 12" fill="none" stroke={color('--muted', '#777')} strokeWidth="1.5" /></marker></defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {(diagram.containers ?? []).map((item) => <g key={item.id} transform={`translate(${item.position.x} ${item.position.y})`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { container: item.id, pointerX: event.clientX, pointerY: event.clientY, startX: item.position.x, startY: item.position.y, panning: false } }}><rect width={item.width} height={item.height} rx="8" className="er-container"/><text x="12" y="23" className="er-container-title">{item.title}</text></g>)}
          {diagram.relations.map((relation, relationIndex) => { const from = tablesByName.get(relation.fromTable); const to = tablesByName.get(relation.toTable); if (!from || !to) return null; const box = (table: DiagramTable) => ({ position: table.position, width: cardWidth, height: cardHeight(table) }); const obstacles = diagram.tables.map(box); const cardinality = relation.cardinality ?? { from: '0..N' as const, to: '0..1' as const }; return <g key={relation.id} aria-label={`${relation.name}: ${cardinality.from} — ${cardinality.to}`}><path d={routeERRelation(box(from), box(to), obstacles, relationIndex * 10)} fill="none" stroke={relation.virtual ? color('--accent', '#548bd8') : color('--muted', '#777')} strokeWidth="2" strokeDasharray={relation.virtual ? '7 5' : undefined} markerStart="url(#erd-many)" markerEnd="url(#erd-one)"/><text x={from.position.x + cardWidth / 2} y={from.position.y - 5} textAnchor="middle" className="er-cardinality">{cardinality.from}</text><text x={to.position.x + cardWidth / 2} y={to.position.y - 5} textAnchor="middle" className="er-cardinality">{cardinality.to}</text><text x={(from.position.x + to.position.x + cardWidth) / 2} y={Math.min(from.position.y, to.position.y) - 22 - relationIndex * 10} textAnchor="middle" className="er-relation-label">{relation.name}</text><title>{relation.name} · {relation.fromTable} ({cardinality.from}) → {relation.toTable} ({cardinality.to}) · {relation.fromColumns.join(', ')}{t('panel.er.diagram.me943e24809')} {relation.toColumns.join(', ')}{relation.virtual ? ' · virtual' : ''}</title></g> })}
          {(diagram.notes ?? []).map((item) => <g key={item.id} transform={`translate(${item.position.x} ${item.position.y})`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { note: item.id, pointerX: event.clientX, pointerY: event.clientY, startX: item.position.x, startY: item.position.y, panning: false } }}><rect width="190" height="110" rx="3" className="er-sticky-note"/><foreignObject x="10" y="10" width="170" height="90"><textarea aria-label="Diagram note" value={item.text} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setDiagram((current) => current ? { ...current, notes: (current.notes ?? []).map((note) => note.id === item.id ? { ...note, text: event.target.value.slice(0, 500) } : note) } : current)} /></foreignObject></g>)}
          {visibleTables.map((table) => <g key={table.name} transform={`translate(${table.position.x} ${table.position.y})`} onPointerDown={(event) => dragStart(event, table)} onPointerMove={(event) => { if (dragRef.current?.table) pointerMove(event as unknown as PointerEvent<SVGSVGElement>) }} onClick={() => setSelectedTable(table.name)} className={`er-table ${selectedTable === table.name ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Table ${table.name}`}>
            <rect width={cardWidth} height={cardHeight(table)} rx="6" /><rect width={cardWidth} height="42" rx="6" className="er-table-head"/><text x="12" y="27" className="er-table-title">▦ {table.name}</text><text x={cardWidth - 28} y="26" className="er-collapse" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setDiagram((current) => current ? { ...current, tables: current.tables.map((item) => item.name === table.name ? { ...item, collapsed: !item.collapsed } : item) } : current) }}>{table.collapsed ? '+' : '−'}</text>
            {!table.collapsed && <>{table.columns.map((column, index) => { const isForeign = diagram.relations.some((relation) => relation.fromTable === table.name && relation.fromColumns.includes(column.name)); const isPrimary = table.primaryColumns?.includes(column.name) ?? false; const isKey = isPrimary || isForeign || diagram.relations.some((relation) => relation.toTable === table.name && relation.toColumns.includes(column.name)); if (displayMode === 'keys' && !isKey) return null; return <g key={column.name}><text x="10" y={63 + index * 25} className="er-column-key">{isPrimary ? 'PK' : isForeign ? 'FK' : '·'}</text><text x="34" y={63 + index * 25} className="er-column-name">{column.name}</text><text x={cardWidth - 10} y={63 + index * 25} textAnchor="end" className="er-column-type">{displayMode === 'types' ? typeName(column.type) : ''}{!column.nullable ? ' · NOT NULL' : ''}</text></g> })}{(['Constraints', 'Indexes', 'Triggers'] as const).map((section, sectionIndex) => { const items = section === 'Constraints' ? table.constraintNames ?? [] : section === 'Indexes' ? table.indexNames ?? [] : table.triggerNames ?? []; const yStart = 63 + table.columns.length * 25 + sectionIndex * 20 + (sectionIndex > 0 ? (table.constraintNames?.length ?? 0) * 18 : 0) + (sectionIndex > 1 ? (table.indexNames?.length ?? 0) * 18 : 0); const collapsed = Boolean(table.collapsedSections?.[section]); return <g key={section}><text x="10" y={yStart} className="er-section" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setDiagram((current) => current ? { ...current, tables: current.tables.map((item) => item.name === table.name ? { ...item, collapsedSections: { ...item.collapsedSections, [section]: !item.collapsedSections?.[section] } } : item) } : current) }}>{collapsed ? '▸' : '▾'} {section} ({items.length})</text>{!collapsed && items.map((name, itemIndex) => <text key={name} x="25" y={yStart + 18 + itemIndex * 18} className="er-section-item">{name}</text>)}</g> })}</>}
          </g>)}
        </g>
      </svg><div className="er-canvas-status">{message}</div></div>
      <aside className="er-side">
        <div><h3>{t('panel.er.diagram.mf656460d09')}</h3><input placeholder={t('panel.er.diagram.mb06d39f488')} value={search} onChange={(event) => setSearch(event.target.value)} /><ul>{visibleTables.map((table) => <li key={table.name}><button className={selectedTable === table.name ? 'selected' : ''} onClick={() => { setSelectedTable(table.name); setPan({ x: 100 - table.position.x * zoom, y: 100 - table.position.y * zoom }) }}>{table.name}</button></li>)}</ul></div>
        <div className="er-properties"><h3>{t('panel.er.diagram.m88564ee79c')}</h3>{diagram.tables.find((table) => table.name === selectedTable) ? <><b>{selectedTable}</b><span>{diagram.tables.find((table) => table.name === selectedTable)!.columns.length} {t('panel.er.diagram.m59ee64a001')}</span><span>{diagram.relations.filter((relation) => relation.fromTable === selectedTable || relation.toTable === selectedTable).length} {t('panel.er.diagram.mee5252bb95')}</span><button onClick={() => setDiagram((current) => current ? { ...current, tables: current.tables.filter((table) => table.name !== selectedTable), relations: current.relations.filter((relation) => relation.fromTable !== selectedTable && relation.toTable !== selectedTable) } : current)}>{t('erd.cmd.removeFromDiagram')}</button></> : <span>{t('panel.er.diagram.mb4774373de')}</span>}</div>
      </aside>
      <button className="er-overview-toggle" aria-label="Toggle diagram overview" title="Diagram overview" disabled={!diagram} onClick={() => setShowOverview((value) => !value)}>⌕</button>
      {showOverview && diagram && <div className="er-overview-popover" aria-label="Diagram overview"><strong>Diagram overview</strong><div className="er-minimap" data-testid="er-diagram-overview" aria-label={t('erd.overview')} onPointerDown={(event) => { overviewDragRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); moveOverview(event.clientX, event.clientY, event.currentTarget) }} onPointerMove={(event) => { if (overviewDragRef.current) moveOverview(event.clientX, event.clientY, event.currentTarget) }} onPointerUp={() => { overviewDragRef.current = false }} onPointerCancel={() => { overviewDragRef.current = false }}>{diagram.tables.map((item) => <span key={item.name} title={item.name} style={{ left: `${Math.max(0, Math.min(98, ((item.position.x - overviewBounds.minX) / overviewWidth) * 100))}%`, top: `${Math.max(0, Math.min(92, ((item.position.y - overviewBounds.minY) / overviewHeight) * 100))}%` }} />)}<i className="er-minimap-viewport" aria-hidden="true" style={{ left: `${viewport.left}%`, top: `${viewport.top}%`, width: `${viewport.width}%`, height: `${viewport.height}%` }} /></div></div>}
    </div>}
    {showRelations && diagram && <div className="er-relations" role="dialog" aria-label={t('erd.vr.manager')}><header><h3>{editingRelationId ? t('Relation Properties') : t('erd.vr.manager')}</h3><button onClick={() => setShowRelations(false)}>{t('panel.er.diagram.md72510b688')}</button></header>{editingRelationId && <nav className="module-tabs" aria-label={t('Relation Properties')}><button aria-pressed={relationPropertiesTab === 'General'} onClick={() => setRelationPropertiesTab('General')}>{t('General')}</button><button aria-pressed={relationPropertiesTab === 'Advanced'} onClick={() => setRelationPropertiesTab('Advanced')}>{t('Advanced')}</button></nav>}<div className="er-rel-form">{relationPropertiesTab === 'General' ? <><label>{t('Foreign key name')}<input aria-label={t('Foreign key name')} value={relationName} placeholder={fromTable ? `${fromTable}_VR1` : t('Automatically generated when blank')} onChange={(event) => setRelationName(event.target.value)} /></label><label>{t('Referenced database name')}<input value={diagram.database} readOnly /></label><label>{t('panel.er.diagram.me602b5049a')}<select value={fromTable} onChange={(event) => setFromTable(event.target.value)}><option value="">{t('panel.er.diagram.m548bbb794e')}</option>{diagram.tables.map((table) => <option key={table.name}>{table.name}</option>)}</select></label><label>{t('panel.er.diagram.m99531e1578')}<input value={fromColumns} onChange={(event) => setFromColumns(event.target.value)} placeholder={t('panel.er.diagram.mcb996c6ecb')} /></label><label>{t('panel.er.diagram.m8e0b9bbbdc')}<select value={toTable} onChange={(event) => setToTable(event.target.value)}><option value="">{t('panel.er.diagram.m548bbb794e')}</option>{diagram.tables.map((table) => <option key={table.name}>{table.name}</option>)}</select></label><label>{t('panel.er.diagram.m86c59b290c')}<input value={toColumns} onChange={(event) => setToColumns(event.target.value)} placeholder={t('panel.er.diagram.mf5ebbae88a')} /></label></> : <><label>{t('ON DELETE')}<select value={relationOnDelete} onChange={(event) => setRelationOnDelete(event.target.value)}>{['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'].map((value) => <option key={value}>{value}</option>)}</select></label><label>{t('ON UPDATE')}<select value={relationOnUpdate} onChange={(event) => setRelationOnUpdate(event.target.value)}>{['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'].map((value) => <option key={value}>{value}</option>)}</select></label><label>{t('panel.er.diagram.m2422471bc2')}<input value={relationComment} onChange={(event) => setRelationComment(event.target.value)} /></label></>}<button onClick={addVirtualRelation}>{editingRelationId ? t('extras.erd.save') : t('panel.er.diagram.m54b199f39b')}</button>{editingRelationId && <button onClick={() => { setEditingRelationId(''); setRelationName(''); setFromTable(''); setFromColumns(''); setToTable(''); setToColumns(''); setRelationComment('') }}>{t('extras.erd.cancelEdit')}</button>}</div>{!editingRelationId && <div className="er-relation-list">{diagram.virtualRelations.length ? diagram.virtualRelations.map((relation) => <div key={relation.id}><span>{relation.name} · {relation.fromTable}.{relation.fromColumns.join(',')} → {relation.toTable}.{relation.toColumns.join(',')}</span><button onClick={() => editRelation(relation)}>{t('extras.erd.edit')}</button><button onClick={() => void showRelationDdl(relation)}>{t('extras.erd.ddl')}</button><button onClick={() => void convertRelation(relation)}>{t('extras.erd.convert')}</button><button onClick={() => void persistRelations(diagram.virtualRelations.filter((item) => item.id !== relation.id))}>{t('panel.er.diagram.m24678722b6')}</button></div>) : <p>{t('panel.er.diagram.m6f614bc328')}</p>}</div>}{relationDdl && <pre className="er-relation-ddl">{relationDdl}</pre>}</div>}
  </section>
}
