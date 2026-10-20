import { useMemo, useState } from 'react'
import type { ConnectionRecord, ConnectionSummary, DatabaseObject, DatabaseObjectKind } from '../../../../shared/contracts'
import { Button } from './Button'
import { useI18n } from '../i18n/useI18n.js'

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
  onSelectTop(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onGenerateScript(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onDropObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onOpenObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onCreateObject(connection: ConnectionSummary, database: string, kind: DatabaseObjectKind): void
  onRenameTable(connection: ConnectionSummary, database: string, object: DatabaseObject, newName: string): void
  onTruncateTable(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onSelectObject(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onProperties(connection: ConnectionSummary, database: string, object: DatabaseObject): void
  onEdit(record: ConnectionRecord): void
}

const kinds: Array<{ kind: DatabaseObjectKind; label: string; icon: string }> = [
  { kind: 'table', label: 'Tables', icon: '▤' }, { kind: 'view', label: 'Views', icon: '◫' },
  { kind: 'procedure', label: 'Procedures', icon: 'ƒ' }, { kind: 'function', label: 'Functions', icon: 'λ' },
  { kind: 'trigger', label: 'Triggers', icon: 'ϟ' }, { kind: 'event', label: 'Events', icon: '◷' }
]

export function DatabaseExplorer(props: Props): React.JSX.Element {
  const { t } = useI18n()
  const { records, active, databases, objects, loadingObjects, connecting, errors, onNew, onManage, onConnect, onDisconnect, onExpand, onLoadObjects, onSelectDatabase, onSelectTop, onGenerateScript, onDropObject, onOpenObject, onCreateObject, onRenameTable, onTruncateTable, onEdit, onSelectObject, onProperties } = props
  const [filter, setFilter] = useState('')
  const [showSystemDatabases, setShowSystemDatabases] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([])
  const [expandedKinds, setExpandedKinds] = useState<string[]>([])
  const [context, setContext] = useState<{ x: number; y: number; record: ConnectionSummary; database: string; object: DatabaseObject }>()
  const visible = useMemo(() => records.filter((record) => `${record.name} ${record.host} ${record.category ?? ''}`.toLowerCase().includes(filter.toLowerCase())), [records, filter])
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

  return <aside className="explorer-dock">
    <header className="dock-heading"><strong>{t('explorer.title')}</strong><div><Button className="icon-button" title={t('conn.new')} onClick={onNew}>＋</Button><Button className="icon-button" title={t('conn.manager.title')} onClick={onManage}>⚙</Button></div></header>
    <input className="explorer-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter connections…" aria-label="Filter connections" />
    <label className="system-database-toggle"><input type="checkbox" checked={showSystemDatabases} onChange={(event) => setShowSystemDatabases(event.target.checked)} />{t('explorer.showSystemDatabases')}</label>
    <div className="explorer-tree" role="tree" aria-label="Database Explorer">
      {visible.length === 0 ? <div className="empty-state compact"><strong>{filter ? t('explorer.empty.search', [filter]) : t('explorer.empty.title')}</strong><p>{t('explorer.empty.hint')}</p><Button variant="primary" onClick={onNew}>{t('conn.new')}</Button></div> : [...groups.entries()].map(([category, items]) => <div className="explorer-group" key={category}>
        <div className="group-label">▾ {category}</div>
        {items.map((record) => {
          const connection = active.find((item) => item.recordId === record.id)
          const isConnecting = connecting.includes(record.id)
          const isExpanded = expanded.includes(record.id)
          const status = isConnecting ? 'connecting' : connection ? 'connected' : errors[record.id] ? 'error' : 'disconnected'
          return <div role="treeitem" aria-expanded={isExpanded} key={record.id} className={`connection-node state-${status}`}>
            <div className="node-line" style={{ borderLeftColor: record.color ?? (record.environment === 'prod' ? '#c62828' : record.environment === 'test' ? '#ed6c02' : record.environment === 'dev' ? '#2e7d32' : 'transparent') }}>
              <button className="node-expander" onClick={() => toggleRecord(record)} aria-label={isExpanded ? 'Recolher conexão' : 'Expandir conexão'}>{isExpanded ? '▾' : '▸'}</button>
              <span className={`connection-dot ${status}`} title={status} aria-label={status}>{status === 'connecting' ? '◌' : status === 'error' ? '!' : '●'}</span>
              <button className="node-name" onClick={() => connection ? toggleRecord(record) : onConnect(record)} onDoubleClick={() => connection ? undefined : onEdit(record)} title={errors[record.id] ?? `${record.user}@${record.host}:${record.port}`}>{record.name}</button>{record.environment !== 'none' && <span className={`environment-badge env-${record.environment}`} style={{ '--environment-color': record.color ?? (record.environment === 'prod' ? '#c62828' : record.environment === 'test' ? '#ed6c02' : '#2e7d32') } as React.CSSProperties}>{t(`conn.environment.${record.environment}`)}</span>}
              <button className="node-menu" title={connection ? 'Disconnect' : 'Connect'} onClick={() => connection ? onDisconnect(connection) : onConnect(record)}>{connection ? '⏻' : '⋯'}</button>
            </div>
            {errors[record.id] && <div className="node-error" role="alert">{errors[record.id]}</div>}
            {isExpanded && connection && <div className="node-children">
              {(databases[record.id] ?? []).filter((database) => showSystemDatabases || !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(database.toLowerCase())).map((database) => {
                const dbKey = `${record.id}:${database}`
                const dbExpanded = expandedDatabases.includes(dbKey)
                const dbObjects = objects[dbKey] ?? []
                return <div className="database-node" key={database}>
                  <button className={`database-name${connection.database === database ? ' active-database' : ''}`} onClick={() => onSelectDatabase(connection, database)} onDoubleClick={() => toggleDatabase(record.id, connection, database)}><span onClick={(event) => { event.stopPropagation(); toggleDatabase(record.id, connection, database) }}>{dbExpanded ? '▾' : '▸'}</span> ◈ {database}</button>
                  {dbExpanded && <div className="object-groups">{loadingObjects.includes(dbKey) ? <small>Loading…</small> : kinds.map(({ kind, label, icon }) => {
                    const members = dbObjects.filter((object) => object.kind === kind)
                    const groupKey = `${dbKey}:${kind}`
                    return <div className="object-group" key={kind}><div className="object-group-heading"><button className="object-group-name" onClick={() => toggleKind(groupKey)}>{expandedKinds.includes(groupKey) ? '▾' : '▸'} {label} ({members.length})</button><button className="object-create" title={`Create ${kind}`} onClick={() => onCreateObject(connection, database, kind)}>＋</button></div>
                      {expandedKinds.includes(groupKey) && members.map((object) => <button key={`${kind}:${object.name}`} className="object-name" onClick={() => onSelectObject(connection, database, object)} onDoubleClick={() => kind === 'table' || kind === 'view' ? onSelectTop(connection, database, object) : onGenerateScript(connection, database, object)} onContextMenu={(event) => { event.preventDefault(); onSelectObject(connection, database, object); setContext({ x: event.clientX, y: event.clientY, record: connection, database, object }) }}>{icon} {object.name}</button>)}
                    </div>
                  })}</div>}
                </div>
              })}
              {!databases[record.id]?.length && <small>Sem databases disponíveis.</small>}
            </div>}
          </div>
        })}
      </div>)}
    </div>
    {context && <div className="object-context" style={{ left: context.x, top: context.y }} onMouseLeave={() => setContext(undefined)}><button onClick={() => { onProperties(context.record, context.database, context.object); setContext(undefined) }}>{t('nav.propertiesF4')}</button>{['table', 'view'].includes(context.object.kind) && <button onClick={() => { onSelectTop(context.record, context.database, context.object); setContext(undefined) }}>Select top 1000 rows</button>}<button onClick={() => { onOpenObject(context.record, context.database, context.object); setContext(undefined) }}>{context.object.kind === 'table' ? 'Design' : 'Edit'}</button><button onClick={() => { void navigator.clipboard.writeText(`\`${context.object.name.replace(/`/g, '``')}\``); setContext(undefined) }}>Copy name</button><button onClick={() => { onGenerateScript(context.record, context.database, context.object); setContext(undefined) }}>Generate script</button><button onClick={() => { onLoadObjects(context.record, context.database); setContext(undefined) }}>Refresh</button>{!records.find((record) => record.id === context.record.recordId)?.advanced.readOnly && <>{context.object.kind === 'table' && <><button onClick={() => { const name = window.prompt(`New table name for ${context.object.name}:`); if (name && window.prompt(`Type ${context.object.name} to confirm rename:`) === context.object.name && window.confirm(`Rename ${context.object.name} to ${name}?`)) onRenameTable(context.record, context.database, context.object, name); setContext(undefined) }}>Rename…</button><button className="drop-action" onClick={() => { if (window.prompt(`Type ${context.object.name} to confirm truncation:`) === context.object.name && window.confirm(`Truncate all rows from ${context.object.name}?`)) onTruncateTable(context.record, context.database, context.object); setContext(undefined) }}>Truncate…</button></>}<button className="drop-action" onClick={() => { const expected = context.object.name; if (window.prompt(`Type ${expected} to confirm drop:`) === expected && window.confirm(`Drop ${context.object.kind} ${expected}? This cannot be undone.`)) onDropObject(context.record, context.database, context.object); setContext(undefined) }}>Drop…</button></>}</div>}
  </aside>
}
