import { useEffect, useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { SchemaCompareResult } from '../../../../../shared/contracts/schema-compare.js'

export default function Panel(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState('')
  const [includeDrops, setIncludeDrops] = useState(false); const [result, setResult] = useState<SchemaCompareResult | null>(null)
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const destructive = useMemo(() => /\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(result?.script ?? ''), [result])
  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); setSource(items[0]?.id ?? ''); setTarget(items[1]?.id ?? items[0]?.id ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [])
  const label = (id: string): string => records.find((record) => record.id === id)?.name ?? id
  async function runCompare(): Promise<void> {
    setBusy(true); setMessage('Lendo origem e destino…'); setResult(null)
    let sourceConnection = ''; let targetConnection = ''
    try {
      const a = records.find((record) => record.id === source); const b = records.find((record) => record.id === target)
      if (!a || !b || !sourceDb.trim() || !targetDb.trim()) throw new Error('Selecione origem e destino e clique Compare.')
      const [connectedSource, connectedTarget] = await Promise.all([window.dbforge.connect(a), window.dbforge.connect(b)])
      sourceConnection = connectedSource.id; targetConnection = connectedTarget.id
      const next = await window.dbforge.compareSchemas(sourceConnection, sourceDb, targetConnection, targetDb, includeDrops)
      setResult(next); setMessage(next.differences.length ? `${next.differences.length} diferenças encontradas.` : 'Os esquemas são idênticos.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comparison failed.') }
    finally { if (sourceConnection) void window.dbforge.disconnect(sourceConnection); if (targetConnection && targetConnection !== sourceConnection) void window.dbforge.disconnect(targetConnection); setBusy(false) }
  }
  async function synchronize(): Promise<void> {
    if (!result?.script.trim()) { setMessage('No objects selected to synchronize.'); return }
    const text = `Destino: ${label(target)} / ${targetDb}\n${result.differences.length} diferenças serão aplicadas. ${destructive ? 'O script pode remover objetos ou colunas.' : ''}\n\nDeseja continuar?`
    if (!window.confirm(text)) return
    setBusy(true); setMessage('Sincronizando…')
    try {
      const record = records.find((item) => item.id === target)
      if (!record) throw new Error('Escolha uma conexão de destino.')
      const connected = await window.dbforge.connect(record)
      try {
        const summary = await window.dbforge.synchronizeSchema(connected.id, targetDb, result.script, destructive)
        setMessage(`Synchronization complete: ${summary.succeeded} succeeded, ${summary.failed} failed${summary.errors.length ? ` — ${summary.errors.join('; ')}` : ''}`)
      } finally { await window.dbforge.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na sincronização.') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel"><h2>⇆ Schema Compare</h2>
    <p>Selecione origem e destino e clique Compare. O script sincroniza a origem no destino selecionado.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <fieldset><legend>Source</legend><label>Source connection: <select value={source} onChange={(event) => setSource(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Source database: <input value={sourceDb} onChange={(event) => setSourceDb(event.target.value)} /></label></fieldset>
      <fieldset style={{ borderColor: 'var(--error)' }}><legend>Target (será modificado)</legend><label>Destination connection: <select value={target} onChange={(event) => setTarget(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Destination database: <input value={targetDb} onChange={(event) => setTargetDb(event.target.value)} /></label></fieldset>
    </div>
    <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={includeDrops} onChange={(event) => setIncludeDrops(event.target.checked)} /> Include drops (possible data loss)</label>
    <div style={{ display: 'flex', gap: 8 }}><button onClick={() => void runCompare()} disabled={busy || records.length === 0}>Compare (F5)</button><button onClick={() => void synchronize()} disabled={busy || !result?.script}>Synchronize (Ctrl+Shift+Y)</button><button onClick={() => result && navigator.clipboard.writeText(result.script)} disabled={!result?.script}>Generate Script / Copy</button></div>
    <p role="status">{message}</p>
    {result && <><h3>{result.differences.length ? 'Differences' : 'Identical'}</h3><div style={{ maxHeight: 220, overflow: 'auto' }}>{result.differences.map((item, index) => <div key={`${item.kind}-${item.object}-${index}`} style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{item.change === 'added' ? 'Only in Source +' : item.change === 'removed' ? 'Only in Target −' : 'Different ≠'} · {item.kind} · {item.object} — {item.detail}</div>)}</div><h3>Sync SQL</h3><textarea aria-label="Sync SQL" readOnly value={result.script} style={{ width: '100%', height: 160, fontFamily: 'monospace' }} /></>}
  </section>
}
