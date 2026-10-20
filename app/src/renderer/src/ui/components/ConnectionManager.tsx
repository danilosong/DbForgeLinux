import { useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../shared/contracts'
import { Button, Dialog } from './Button'

interface Props {
  records: ConnectionRecord[]
  onNew(): void
  onEdit(record: ConnectionRecord): void
  onDuplicate(record: ConnectionRecord): void
  onDelete(records: ConnectionRecord[]): Promise<void>
  onClose(): void
}

export function ConnectionManager({ records, onNew, onEdit, onDuplicate, onDelete, onClose }: Props): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const filtered = useMemo(() => records.filter((record) => `${record.name} ${record.host} ${record.user} ${record.database ?? ''} ${record.category ?? ''}`.toLowerCase().includes(search.toLowerCase())), [records, search])
  const selectedRecords = selected.map((id) => records.find((record) => record.id === id)).filter((record): record is ConnectionRecord => Boolean(record))

  async function remove(): Promise<void> {
    if (!selectedRecords.length) return
    const suffix = selectedRecords.length === 1 ? selectedRecords[0].name : `${selectedRecords.length} conexões`
    if (!window.confirm(`Excluir ${suffix}? Credenciais salvas sem outras referências também serão removidas.`)) return
    setBusy(true)
    try { await onDelete(selectedRecords); setSelected([]) } finally { setBusy(false) }
  }

  return <Dialog title="Connection Manager" className="manager-dialog">
    <div className="manager-toolbar">
      <Button variant="primary" onClick={onNew}>＋ New</Button>
      <Button onClick={() => selectedRecords[0] && onEdit(selectedRecords[0])} disabled={selectedRecords.length !== 1}>Edit</Button>
      <Button onClick={() => selectedRecords[0] && onDuplicate(selectedRecords[0])} disabled={selectedRecords.length !== 1}>Duplicate</Button>
      <Button variant="danger" onClick={() => void remove()} disabled={!selectedRecords.length || busy}>Delete</Button>
      <input className="manager-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conexões…" aria-label="Buscar conexões" />
    </div>
    {filtered.length === 0 ? <div className="empty-state"><strong>Nenhuma conexão salva</strong><p>Crie uma conexão ou importe uma lista JSON sem senhas.</p><Button variant="primary" onClick={onNew}>New Connection</Button></div> : <div className="manager-table-wrap">
      <table className="manager-table"><thead><tr><th></th><th>Nome</th><th>Tipo</th><th>Host:Porta</th><th>Usuário</th><th>Database</th><th>Categoria</th><th>Último uso</th></tr></thead>
        <tbody>{filtered.map((record) => <tr key={record.id} className={selected.includes(record.id) ? 'selected' : ''} onDoubleClick={() => onEdit(record)}>
          <td><input type="checkbox" checked={selected.includes(record.id)} aria-label={`Selecionar ${record.name}`} onChange={(event) => setSelected((current) => event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id))} /></td>
          <td><button className="text-action" onClick={() => onEdit(record)}>{record.name}</button></td><td>{record.type.toUpperCase()}</td><td>{record.socketPath || `${record.host}:${record.port}`}</td><td>{record.user}</td><td>{record.database || '—'}</td><td>{record.category || '—'}</td><td>{record.lastUsedAt ? new Date(record.lastUsedAt).toLocaleString() : '—'}</td>
        </tr>)}</tbody></table>
      </div>}
    <footer className="dialog-footer"><span className="footer-spacer" /><Button onClick={onClose}>Close</Button></footer>
  </Dialog>
}
