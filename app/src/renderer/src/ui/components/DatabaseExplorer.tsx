import { useState } from 'react'
import type { ConnectionRecord, ConnectionSummary } from '../../../../shared/contracts'
import { Button } from './Button'

interface Props {
  records: ConnectionRecord[]
  active: ConnectionSummary[]
  databases: Record<string, string[]>
  tables: Record<string, string[]>
  connecting: string[]
  errors: Record<string, string>
  onNew(): void
  onManage(): void
  onConnect(record: ConnectionRecord): void
  onDisconnect(connection: ConnectionSummary): void
  onExpand(record: ConnectionRecord): void
  onEdit(record: ConnectionRecord): void
}

export function DatabaseExplorer({ records, active, databases, tables, connecting, errors, onNew, onManage, onConnect, onDisconnect, onExpand, onEdit }: Props): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const visible = records.filter((record) => `${record.name} ${record.host} ${record.category ?? ''}`.toLowerCase().includes(filter.toLowerCase()))
  const groups = new Map<string, ConnectionRecord[]>()
  for (const record of visible) {
    const category = record.category?.trim() || 'Connections'
    groups.set(category, [...(groups.get(category) ?? []), record])
  }

  function toggle(record: ConnectionRecord): void {
    const isExpanded = expanded.includes(record.id)
    setExpanded((current) => isExpanded ? current.filter((id) => id !== record.id) : [...current, record.id])
    if (!isExpanded) onExpand(record)
  }

  return <aside className="explorer-dock">
    <header className="dock-heading"><strong>Database Explorer</strong><div><Button className="icon-button" title="New Connection" onClick={onNew}>＋</Button><Button className="icon-button" title="Connection Manager" onClick={onManage}>⚙</Button></div></header>
    <input className="explorer-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter connections…" aria-label="Filter connections" />
    <div className="explorer-tree" role="tree" aria-label="Database Explorer">
      {visible.length === 0 ? <div className="empty-state compact"><strong>Nenhuma conexão</strong><p>Adicione uma conexão para começar.</p><Button variant="primary" onClick={onNew}>New Connection</Button></div> : [...groups.entries()].map(([category, items]) => <div className="explorer-group" key={category}>
        <div className="group-label">▾ {category}</div>
        {items.map((record) => {
          const connection = active.find((item) => item.recordId === record.id)
          const isConnecting = connecting.includes(record.id)
          const isExpanded = expanded.includes(record.id)
          const status = isConnecting ? 'connecting' : connection ? 'connected' : errors[record.id] ? 'error' : 'disconnected'
          return <div role="treeitem" aria-expanded={isExpanded} key={record.id} className={`connection-node state-${status}`}>
            <div className="node-line" style={{ borderLeftColor: record.environment === 'prod' ? '#c62828' : record.color ?? 'transparent' }}>
              <button className="node-expander" onClick={() => toggle(record)} aria-label={isExpanded ? 'Recolher conexão' : 'Expandir conexão'}>{isExpanded ? '▾' : '▸'}</button>
              <span className={`connection-dot ${status}`} title={status} aria-label={status}>{status === 'connecting' ? '◌' : status === 'error' ? '!' : '●'}</span>
              <button className="node-name" onClick={() => connection ? toggle(record) : onConnect(record)} onDoubleClick={() => connection ? undefined : onEdit(record)} title={errors[record.id] ?? `${record.user}@${record.host}:${record.port}`}>{record.name}</button>
              <button className="node-menu" title={connection ? 'Disconnect' : 'Connect'} onClick={() => connection ? onDisconnect(connection) : onConnect(record)}>{connection ? '⏻' : '⋯'}</button>
            </div>
            {errors[record.id] && <div className="node-error" role="alert">{errors[record.id]}</div>}
            {isExpanded && connection && <div className="node-children">
              {(databases[record.id] ?? []).map((database) => <div className="database-node" key={database}>
                <button className="database-name" onClick={() => onExpand(record)}>▸ {database}</button>
                {(tables[`${record.id}:${database}`] ?? []).map((table) => <div className="table-node" key={table}>▤ {table}</div>)}
              </div>)}
              {!databases[record.id]?.length && <small>Sem databases disponíveis.</small>}
            </div>}
          </div>
        })}
      </div>)}
    </div>
  </aside>
}
