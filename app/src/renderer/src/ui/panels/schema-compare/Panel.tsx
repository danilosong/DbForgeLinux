import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { SchemaCompareResult } from '../../../../../shared/contracts/schema-compare.js'
import type { SchemaDifference } from '../../../../../modules/schema/model.js'
import { createTable } from '../../../../../modules/schema/ddl.js'
import './Panel.css'
import { usePanelConnection } from '../registry'

type Filter = 'all' | 'different' | 'added' | 'removed'
const keyOf = (item: SchemaDifference): string => `${item.kind}:${item.object}:${item.change}`
const splitSql = (script: string): string[] => script.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean).map((part) => `${part};`)

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState('')
  const [includeDrops, setIncludeDrops] = useState(false); const [result, setResult] = useState<SchemaCompareResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [active, setActive] = useState<SchemaDifference | null>(null)
  const [filter, setFilter] = useState<Filter>('all'); const [search, setSearch] = useState(''); const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Selecione origem e destino e clique Compare.'); const [confirmOpen, setConfirmOpen] = useState(false); const [riskAccepted, setRiskAccepted] = useState(false)
  const [scriptPreview, setScriptPreview] = useState(false)
  const selectedScript = useMemo(() => {
    if (!result) return ''
    const included = result.differences.filter((item) => selected.has(keyOf(item)))
    return splitSql(result.script).filter((statement) => included.some((item) => {
      const [tableName, childName] = item.object.split('.')
      const hasTable = statement.includes('`' + tableName.replaceAll('`', '``') + '`')
      if (item.kind === 'table' || !childName) return hasTable && statement.includes(item.kind === 'table' ? 'TABLE' : '`' + item.object.replaceAll('`', '``') + '`')
      return hasTable && statement.includes('`' + childName.replaceAll('`', '``') + '`')
    })).join('\n\n')
  }, [result, selected])
  const destructive = useMemo(() => /\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(selectedScript), [selectedScript])
  const visible = useMemo(() => result?.differences.filter((item) => {
    const stateMatch = filter === 'all' || (filter === 'different' ? item.change === 'changed' : filter === 'added' ? item.change === 'added' : item.change === 'removed')
    return stateMatch && item.object.toLowerCase().includes(search.toLowerCase())
  }) ?? [], [result, filter, search])

  useEffect(() => { void window.dbforge.getConnections().then((items) => { const selected = items.find((item) => item.id === activeConnection?.recordId || item.name === activeConnection?.name)?.id ?? items[0]?.id ?? ''; setRecords(items); setSource(selected); setTarget(selected) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [activeConnection?.name, activeConnection?.recordId])
  function invalidate(): void { if (result) { setResult(null); setMessage('Resultados desatualizados — Compare novamente.') } }
  const label = (id: string): string => records.find((record) => record.id === id)?.name ?? id
  function markDefaults(next: SchemaCompareResult): void { setSelected(new Set(next.differences.filter((item) => includeDrops || item.change !== 'removed').map(keyOf))) }
  async function runCompare(): Promise<void> {
    setBusy(true); setMessage('Lendo origem…'); setResult(null); setActive(null)
    let sourceConnection = ''; let targetConnection = ''
    try {
      const a = records.find((record) => record.id === source); const b = records.find((record) => record.id === target)
      if (!a || !b || !sourceDb.trim() || !targetDb.trim()) throw new Error('Selecione origem e destino e clique Compare.')
      const [connectedSource, connectedTarget] = await Promise.all([window.dbforge.connect(a), window.dbforge.connect(b)])
      sourceConnection = connectedSource.id; targetConnection = connectedTarget.id; setMessage('Lendo destino…')
      const next = await window.dbforge.compareSchemas(sourceConnection, sourceDb, targetConnection, targetDb, includeDrops)
      setResult(next); markDefaults(next); setMessage(next.differences.length ? `${next.differences.length} diferenças: ${next.differences.filter((d) => d.change === 'added').length} novos, ${next.differences.filter((d) => d.change === 'changed').length} alterados, ${next.differences.filter((d) => d.change === 'removed').length} removidos` : 'Os esquemas são idênticos.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comparison failed.') }
    finally { if (sourceConnection) void window.dbforge.disconnect(sourceConnection); if (targetConnection && targetConnection !== sourceConnection) void window.dbforge.disconnect(targetConnection); setBusy(false) }
  }
  async function synchronize(): Promise<void> {
    if (!selectedScript.trim()) { setMessage('No objects selected to synchronize.'); return }
    setBusy(true); setMessage('Sincronizando…')
    try {
      const record = records.find((item) => item.id === target); if (!record) throw new Error('Escolha uma conexão de destino.')
      const connected = await window.dbforge.connect(record)
      try { const summary = await window.dbforge.synchronizeSchema(connected.id, targetDb, selectedScript, destructive && riskAccepted); setMessage(`Synchronization complete: ${summary.succeeded} succeeded, ${summary.failed} failed${summary.errors.length ? ` — ${summary.errors.join('; ')}` : ''}`) }
      finally { await window.dbforge.disconnect(connected.id) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na sincronização.') }
    finally { setBusy(false); setConfirmOpen(false); setRiskAccepted(false) }
  }
  function exportScript(): void { const blob = new Blob([selectedScript], { type: 'text/sql;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'schema-sync.sql'; anchor.click(); URL.revokeObjectURL(url) }
  const selectedDdl = (side: 'source' | 'target'): string => {
    if (!result || !active) return ''
    const model = side === 'source' ? result.source : result.target
    const table = model.tables.find((item) => item.name === active.object.split('.')[0])
    if (table) return createTable(table, model.name)
    const object = [...model.views, ...model.procedures, ...model.functions, ...model.triggers, ...model.events].find((item) => item.name === active.object)
    return object?.createSql ?? ('definition' in (object ?? {}) ? String(object?.definition ?? '') : '')
  }

  return <section className="tool-panel compare-panel">
    <h2>⇆ Schema Compare</h2><p>Compare a origem com o destino. O destino será modificado durante a sincronização.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <fieldset><legend>{t('cmp.dest.connection')}</legend><div className="compare-form"><label>Source connection<select value={source} onChange={(event) => { invalidate(); setSource(event.target.value) }}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Source database<input value={sourceDb} onChange={(event) => { invalidate(); setSourceDb(event.target.value) }} /></label></div></fieldset>
      <fieldset style={{ borderColor: 'var(--error)' }}><legend>Target (será modificado)</legend><div className="compare-form"><label>Destination connection<select value={target} onChange={(event) => { invalidate(); setTarget(event.target.value) }}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Destination database<input value={targetDb} onChange={(event) => { invalidate(); setTargetDb(event.target.value) }} /></label></div></fieldset>
    </div>
    <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={includeDrops} onChange={(event) => { setIncludeDrops(event.target.checked); setMessage('Resultados desatualizados — Compare novamente.'); setResult(null) }} /> Include drops (possible data loss)</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button onClick={() => void runCompare()} disabled={busy || records.length === 0}>Compare (F5)</button><button onClick={() => { setScriptPreview(true); setConfirmOpen(false) }} disabled={!selectedScript}>{t('cmp.generateScript')}</button><button onClick={() => { setConfirmOpen(true); setScriptPreview(false) }} disabled={busy || !selectedScript}>Synchronize (Ctrl+Shift+Y)</button><button onClick={exportScript} disabled={!selectedScript}>Export script</button><button onClick={() => { setSource(target); setTarget(source); setSourceDb(targetDb); setTargetDb(sourceDb); setResult(null); setMessage('Resultados desatualizados — Compare novamente.') }}>Swap ⇄</button></div>
    {result && <><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}><select aria-label="Filter differences" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All ({result.differences.length})</option><option value="different">Different ({result.differences.filter((x) => x.change === 'changed').length})</option><option value="added">Only in Source ({result.differences.filter((x) => x.change === 'added').length})</option><option value="removed">Only in Target ({result.differences.filter((x) => x.change === 'removed').length})</option></select><input aria-label="Search objects" placeholder="Search object" value={search} onChange={(event) => setSearch(event.target.value)} /><button onClick={() => setSelected(new Set(visible.filter((x) => includeDrops || x.change !== 'removed').map(keyOf)))}>Mark visible</button><button onClick={() => setSelected(new Set())}>Uncheck all</button></div>
      <div style={{ maxHeight: 230, overflow: 'auto', border: '1px solid var(--border)' }} role="tree" aria-label="Schema differences">{visible.map((item) => <label key={keyOf(item)} role="treeitem" style={{ display: 'flex', gap: 8, padding: 5, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}><input type="checkbox" aria-label={`Include in Synchronization: ${item.object}`} checked={selected.has(keyOf(item))} onChange={() => setSelected((old) => { const next = new Set(old); if (next.has(keyOf(item))) next.delete(keyOf(item)); else next.add(keyOf(item)); return next })} /><button style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setActive(item)}>{item.change === 'added' ? 'Only in Source +' : item.change === 'removed' ? 'Only in Target −' : 'Different ≠'} · {item.kind} · {item.object} — {item.detail}</button></label>)}</div><small>{selected.size} of {result.differences.length} objects included in synchronization</small>
      <h3>DDL side by side {active ? `· ${active.object}` : ''}</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><div><b>{t('cmp.dest.connection')}</b><Editor height="220px" language="sql" theme="vs-dark" value={selectedDdl('source')} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }} /></div><div><b>Target</b><Editor height="220px" language="sql" theme="vs-dark" value={selectedDdl('target')} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }} /></div></div>
    </>}
    <p role="status">{busy ? 'Calculando diferenças… ' : ''}{message}</p>
    {scriptPreview && <div role="dialog" aria-modal="true" aria-label="Generated synchronization script"><h3>{t('cmp.generateScript')}</h3><textarea aria-label="Sync SQL preview" readOnly value={selectedScript} style={{ width: '100%', height: 220, fontFamily: 'monospace' }} /><button onClick={() => { void navigator.clipboard.writeText(selectedScript); setMessage('Script copiado.') }}>Copy script</button><button onClick={exportScript}>Export script</button><button onClick={() => setScriptPreview(false)}>Close</button></div>}
    {confirmOpen && <div role="dialog" aria-modal="true" aria-label="Synchronization confirmation"><h3>Data Synchronization</h3><p>Destino: {label(target)} / {targetDb}</p><p>{selected.size} objetos incluídos. Create {result?.differences.filter((x) => selected.has(keyOf(x)) && x.change === 'added').length ?? 0} · Alter {result?.differences.filter((x) => selected.has(keyOf(x)) && x.change === 'changed').length ?? 0} · Drop {result?.differences.filter((x) => selected.has(keyOf(x)) && x.change === 'removed').length ?? 0}</p>{destructive && <fieldset style={{ borderColor: 'var(--error)' }}><legend>Risco de perda de dados</legend><p>{t('cmp.risk.dropColumns')}</p><label><input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /> Entendo que dados podem ser perdidos</label></fieldset>}<label><input type="checkbox" defaultChecked /> Backup target schema before running this script</label><textarea aria-label="Synchronization script" readOnly value={selectedScript} style={{ width: '100%', height: 120, fontFamily: 'monospace' }} /><button disabled={destructive && !riskAccepted} onClick={() => void synchronize()}>Synchronize</button><button onClick={() => setScriptPreview(true)}>Show Script</button><button onClick={() => { setConfirmOpen(false); setRiskAccepted(false) }}>Cancel</button></div>}
  </section>
}
