import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionRecord, ConnectionSummary, DatabaseObject, DatabaseObjectKind } from '../../../../shared/contracts'
import { databaseObjectDragType } from '../../../../shared/databaseObjectDrag.js'
import { Button } from './Button'
import { useI18n } from '../i18n/useI18n.js'
import { explorerContextMenu, explorerFolderContextMenu, type ExplorerMenuItem } from './explorerContextMenu.js'
import { isValidExplorerRegex, matchesExplorerFilter } from './explorerFilter.js'
import type { Translator } from '../../i18n/types.js'

export type ExplorerContext = { connection: ConnectionSummary; database?: string; object?: DatabaseObject; target: 'server' | 'database' | DatabaseObjectKind }

interface Props {
  records: ConnectionRecord[]
  active: ConnectionSummary[]
  databases: Record<string, string[]>
  objects: Record<string, DatabaseObject[]>
  loadingObjects: string[]
  connecting: string[]
  errors: Record<string, string>
  onNew(): void
  onManage(): void
  onConnect(record: ConnectionRecord): void
  onDisconnect(connection: ConnectionSummary): void
  onExpand(record: ConnectionRecord): void
  onLoadObjects(connection: ConnectionSummary, database: string): void
  onSelectDatabase(connection: ConnectionSummary, database: string): void
  onDropObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onOpenObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onCreateObject(connection: ConnectionSummary, database: string, kind: DatabaseObjectKind): void
  onRenameTable(connection: ConnectionSummary, database: string, object: DatabaseObject, newName: string): void
  onTruncateTable(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onSelectObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onProperties(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onEdit(record: ConnectionRecord): void
  onContextAction(action: string, context: ExplorerContext): void
}

function connectionSecurityLabel(connection: ConnectionSummary, record: ConnectionRecord, t: Translator): { compact: string; text: string; alert: boolean } {
  if (connection.tlsVersion) {
    const text = t(connection.tlsVerified ? 'ui.explorer.tlsVerified' : 'ui.explorer.tlsUnverified', [connection.tlsVersion])
    return { compact: t(connection.tlsVerified ? 'ui.explorer.tlsBadgeVerified' : 'ui.explorer.tlsBadgeUnverified'), text, alert: false }
  }
  if (connection.sshTunnel) return { compact: t('ui.explorer.sshTunnel'), text: t('ui.explorer.sshTunnelDetails'), alert: false }
  if (connection.httpTunnel && connection.httpTunnelSecure) return { compact: t('ui.explorer.httpsTunnel'), text: t('ui.explorer.httpsTunnelDetails'), alert: false }
  if (connection.httpTunnel && connection.httpTunnelRemote) return { compact: t('ui.explorer.noEncryption'), text: t('ui.explorer.remoteHttpTunnelWarning'), alert: true }
  if (connection.httpTunnel) return { compact: t('ui.explorer.mysqlTlsOff'), text: t('ui.explorer.localHttpTunnelDetails'), alert: false }
  const host = record.host.trim().toLowerCase().replace(/^\[|\]$/g, '')
  const loopback = Boolean(record.socketPath) || host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
  const text = t('ui.explorer.plaintextWarning')
  return { compact: t('ui.explorer.noEncryption'), text: loopback ? `${text} (loopback)` : text, alert: !loopback }
}

const kinds: Array<{ kind: DatabaseObjectKind; icon: string }> = [
  { kind: 'table', icon: '▤' }, { kind: 'view', icon: '◫' },
  { kind: 'procedure', icon: 'ƒ' }, { kind: 'function', icon: 'λ' },
  { kind: 'trigger', icon: 'ϟ' }, { kind: 'event', icon: '◷' }
]

export function DatabaseExplorer(props: Props): React.JSX.Element {
  const { t } = useI18n()
  const { records, active, databases, objects, loadingObjects, connecting, errors, onNew, onManage, onConnect, onDisconnect, onExpand, onLoadObjects, onSelectDatabase, onCreateObject, onEdit, onSelectObject, onContextAction } = props
  const [filter, setFilter] = useState('')
  const [regexFilter, setRegexFilter] = useState(false)
  const [caseSensitiveFilter, setCaseSensitiveFilter] = useState(false)
  const [showSystemDatabases, setShowSystemDatabases] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([])
  const [expandedKinds, setExpandedKinds] = useState<string[]>([])
  const [folderFilters, setFolderFilters] = useState<Record<string, string>>({})
  const [context, setContext] = useState<{ x: number; y: number; value: ExplorerContext }>()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const visible = useMemo(() => records.filter((record) => matchesExplorerFilter(`${record.name} ${record.host} ${record.category ?? ''}`, filter, regexFilter, caseSensitiveFilter)), [records, filter, regexFilter, caseSensitiveFilter])
  const groups = new Map<string, ConnectionRecord[]>()
  for (const record of visible) { const category = record.category?.trim() || 'Connections'; groups.set(category, [...(groups.get(category) ?? []), record]) }

  function toggleRecord(record: ConnectionRecord): void {
    const isExpanded = expanded.includes(record.id)
    setExpanded((current) => isExpanded ? current.filter((id) => id !== record.id) : [...current, record.id])
    if (!isExpanded) onExpand(record)
  }
  function toggleDatabase(recordId: string, connection: ConnectionSummary, database: string): void {
    const key = `${recordId}:${database}`
    const isExpanded = expandedDatabases.includes(key)
    setExpandedDatabases((current) => isExpanded ? current.filter((id) => id !== key) : [...current, key])
    if (!isExpanded) onLoadObjects(connection, database)
  }
  function toggleKind(key: string): void { setExpandedKinds((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]) }
  useEffect(() => {
    if (!context) return
    const closeOutside = (event: PointerEvent): void => { if (!contextMenuRef.current?.contains(event.target as Node)) setContext(undefined) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [context])
  useEffect(() => {
    if (!context) return
    const frame = window.requestAnimationFrame(() => {
      const bounds = contextMenuRef.current?.getBoundingClientRect()
      if (!bounds) return
      const x = Math.max(8, Math.min(context.x, window.innerWidth - bounds.width - 8))
      const y = Math.max(8, Math.min(context.y, window.innerHeight - bounds.height - 8))
      if (x !== context.x || y !== context.y) setContext((current) => current ? { ...current, x, y } : current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [context])

  function showContextMenu(event: React.MouseEvent, value: ExplorerContext): void {
    event.preventDefault()
    event.stopPropagation()
    setSelectedConnectionId(value.connection.recordId)
    setContext({ x: Math.min(event.clientX, window.innerWidth - 280), y: Math.min(event.clientY, window.innerHeight - 520), value })
  }

  function renderMenu(items: ExplorerMenuItem[], path: string[] = [], intercept?: (action: string) => boolean): React.JSX.Element[] {
    return items.map((item, index) => item.type === 'separator'
      ? <div key={`separator-${index}`} className="explorer-context-separator" role="separator" />
      : item.type === 'submenu'
        ? <details key={item.id} className="explorer-context-submenu"><summary>{t(`explorer.menu.${item.id}`)}<span>›</span></summary><div className="explorer-context-nested">{renderMenu(item.items, [...path, item.id], intercept)}</div></details>
        : <button key={item.id} type="button" role="menuitem" onClick={() => { const action = [...path, item.id].join('.'); if (!intercept?.(action)) onContextAction(action, context!.value); setContext(undefined) }}><span>{t(`explorer.menu.${item.id}`)}</span>{item.shortcut && <small>{item.shortcut}</small>}</button>)
  }

  const titleConnection = active.find((item) => item.recordId === selectedConnectionId) ?? active[0]

  return <aside className="explorer-dock">
    <header className="dock-heading"><strong title={titleConnection ? `${t('explorer.title')} - ${titleConnection.name}` : t('explorer.title')}>{t('explorer.title')}{titleConnection && <span className="explorer-title-connection"> - {titleConnection.name}</span>}</strong><div><Button className="icon-button" title={t('conn.new')} onClick={onNew}>＋</Button><Button className="icon-button" title={t('conn.manager.title')} onClick={onManage}>⚙</Button></div></header>
    <input className="explorer-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('explorer.filter')} aria-label={t('explorer.filter')} aria-invalid={regexFilter && !isValidExplorerRegex(filter)} />
    <div className="explorer-filter-options"><label><input type="checkbox" checked={regexFilter} onChange={(event) => setRegexFilter(event.target.checked)} />{t('explorer.regex')}</label><label><input type="checkbox" checked={caseSensitiveFilter} onChange={(event) => setCaseSensitiveFilter(event.target.checked)} />{t('explorer.caseSensitive')}</label></div>
    <label className="system-database-toggle"><input type="checkbox" checked={showSystemDatabases} onChange={(event) => setShowSystemDatabases(event.target.checked)} />{t('explorer.showSystemDatabases')}</label>
    <div className="explorer-tree">
      {visible.length === 0 ? <div className="empty-state compact"><strong>{filter ? t('explorer.empty.search', [filter]) : t('explorer.empty.title')}</strong><p>{t('explorer.empty.hint')}</p><Button variant="primary" onClick={onNew}>{t('conn.new')}</Button></div> : <div role="tree" aria-label="Database Explorer">{[...groups.entries()].map(([category, items]) => <div className="explorer-group" role="group" aria-label={category} key={category}>
        <div className="group-label" role="presentation">▾ {category}</div>
        {items.map((record) => {
          const connection = active.find((item) => item.recordId === record.id)
          const isConnecting = connecting.includes(record.id)
          const isExpanded = expanded.includes(record.id)
          const status = isConnecting ? 'connecting' : connection ? 'connected' : errors[record.id] ? 'error' : 'disconnected'
          const securityLabel = connection ? connectionSecurityLabel(connection, record, t) : undefined
          return <div role="treeitem" aria-expanded={isExpanded} key={record.id} className={`connection-node state-${status}`}>
            <div className="node-line" onContextMenu={(event) => connection && showContextMenu(event, { connection, target: 'server' })} style={{ borderLeftColor: record.color ?? (record.environment === 'prod' ? '#c62828' : record.environment === 'test' ? '#ed6c02' : record.environment === 'dev' ? '#2e7d32' : 'transparent') }}>
              <button className="node-expander" onClick={() => toggleRecord(record)} aria-label={isExpanded ? t('ui.explorer.collapseConnection') : t('ui.explorer.expandConnection')}>{isExpanded ? '▾' : '▸'}</button>
              <span className={`connection-dot ${status}`} title={status} aria-label={status}>{status === 'connecting' ? '◌' : status === 'error' ? '!' : '●'}</span>
              <button className="node-name" onClick={() => { setSelectedConnectionId(record.id); if (connection) toggleRecord(record); else onConnect(record) }} onDoubleClick={() => connection ? undefined : onEdit(record)} title={errors[record.id] ?? `${record.user}@${record.host}:${record.port}`}>{record.name}</button>{securityLabel && <span className={`connection-security ${securityLabel.alert ? 'unsafe' : ''}`} role={securityLabel.alert ? 'alert' : undefined} title={securityLabel.text}>{securityLabel.compact}</span>}{record.environment !== 'none' && <span data-shape={record.environmentShape ?? ({ dev: 'square', test: 'diamond', prod: 'circle', sandbox: 'triangle', custom: 'triangle' }[record.environment])} className={`environment-badge env-${record.environment}`} style={{ '--environment-color': record.color ?? (record.environment === 'prod' ? '#c62828' : record.environment === 'test' ? '#ed6c02' : record.environment === 'sandbox' ? '#1565c0' : '#2e7d32') } as React.CSSProperties}>{t(`conn.environment.${record.environment}`)}</span>}
              <button className="node-menu" title={connection ? 'Disconnect' : 'Connect'} onClick={() => { setSelectedConnectionId(record.id); if (connection) onDisconnect(connection); else onConnect(record) }}>{connection ? '⏻' : '⋯'}</button>
            </div>
            {errors[record.id] && <div className="node-error" role="alert">{errors[record.id]}</div>}
            {isExpanded && connection && <div className="node-children">
              {(databases[record.id] ?? []).filter((database) => showSystemDatabases || !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(database.toLowerCase())).map((database) => {
                const dbKey = `${record.id}:${database}`
                const dbExpanded = expandedDatabases.includes(dbKey)
                const dbObjects = objects[dbKey] ?? []
                return <div className="database-node" key={database}>
                  <button className={`database-name${connection.database === database ? ' active-database' : ''}`} onClick={() => onSelectDatabase(connection, database)} onDoubleClick={() => toggleDatabase(record.id, connection, database)} onContextMenu={(event) => showContextMenu(event, { connection, database, target: 'database' })}><span onClick={(event) => { event.stopPropagation(); toggleDatabase(record.id, connection, database) }}>{dbExpanded ? '▾' : '▸'}</span> ◈ {database}</button>
                  {dbExpanded && <div className="object-groups">{loadingObjects.includes(dbKey) ? <small>{t('common.loading')}</small> : kinds.map(({ kind, icon }) => {
                    const members = dbObjects.filter((object) => object.kind === kind)
                    const groupKey = `${dbKey}:${kind}`
                    const matchingMembers = members.filter((object) => matchesExplorerFilter(object.name, folderFilters[groupKey] ?? '', regexFilter, caseSensitiveFilter))
                    return <div className="object-group" key={kind}><div className="object-group-heading" onContextMenu={(event) => showContextMenu(event, { connection, database, target: kind })}><button className="object-group-name" onClick={() => toggleKind(groupKey)}>{expandedKinds.includes(groupKey) ? '▾' : '▸'} {t(`explorer.kind.${kind}`)} ({members.length})</button><button className="object-create" title={t('explorer.menu.newObject')} onClick={() => onCreateObject(connection, database, kind)}>＋</button></div>
                      {expandedKinds.includes(groupKey) && matchingMembers.map((object) => <button key={`${kind}:${object.name}`} className="object-name" draggable={kind === 'table' || kind === 'view'} onDragStart={(event) => { if (kind !== 'table' && kind !== 'view') return; event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(databaseObjectDragType, JSON.stringify({ connectionId: connection.recordId, database, kind, name: object.name })); event.dataTransfer.setData('text/plain', `${database}.${object.name}`) }} onClick={() => onSelectObject(connection, database, object)} onDoubleClick={() => onContextAction('defaultOpen', { connection, database, object, target: kind })} onContextMenu={(event) => { onSelectObject(connection, database, object); showContextMenu(event, { connection, database, object, target: kind }) }}>{icon} {object.name}</button>)}
                    </div>
                  })}</div>}
                </div>
              })}
              {!databases[record.id]?.length && <small>{t('explorer.noDatabases')}</small>}
            </div>}
          </div>
        })}
      </div>)}</div>}
    </div>
    {context && <div ref={contextMenuRef} className="object-context explorer-context-menu" style={{ left: context.x, top: context.y }} role="menu" aria-label={t('explorer.contextMenu')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') setContext(undefined) }}>{renderMenu(context.value.target !== 'server' && context.value.target !== 'database' && !context.value.object ? explorerFolderContextMenu(context.value.target) : explorerContextMenu(context.value.target), [], (action) => { if (action === 'filter') { const key = `${context.value.connection.recordId}:${context.value.database}:${context.value.target}`; const value = window.prompt(t('explorer.menu.filterPrompt'), folderFilters[key] ?? ''); if (value !== null) setFolderFilters((current) => ({ ...current, [key]: value })); return true } return false })}</div>}
  </aside>
}
