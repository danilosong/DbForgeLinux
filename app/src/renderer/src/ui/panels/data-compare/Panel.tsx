import { useEffect, useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { DataCompareResult } from '../../../../../shared/contracts/data-compare.js'
import type { DataCompareDifference } from '../../../../../modules/data-compare/types.js'

type Filter = 'all' | 'different' | 'source-only' | 'target-only'
const keyOf = (row: DataCompareDifference): string => JSON.stringify(row.key)
const statementFor = (row: DataCompareDifference, result: DataCompareResult): string | undefined => {
  const entry = result.keyedStatements.find((item) => JSON.stringify(item.key) === keyOf(row))
  const statement = entry?.statement
  return statement ? `${statement.kind} ${statement.sql};` : undefined
}

export default function Panel(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState(''); const [sourceTable, setSourceTable] = useState(''); const [targetTable, setTargetTable] = useState('')
  const [keys, setKeys] = useState('id'); const [columns, setColumns] = useState(''); const [allowDeletes, setAllowDeletes] = useState(false)
  const [result, setResult] = useState<DataCompareResult | null>(null); const [selected, setSelected] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<Filter>('all'); const [page, setPage] = useState(0); const [confirmOpen, setConfirmOpen] = useState(false); const [confirmed, setConfirmed] = useState(false); const [scriptOpen, setScriptOpen] = useState(false)
  const pageSize = 50
  const visible = useMemo(() => result?.differences.filter((row) => filter === 'all' || row.kind === filter) ?? [], [result, filter])
  const pages = Math.max(1, Math.ceil(visible.length / pageSize)); const pageRows = visible.slice(page * pageSize, (page + 1) * pageSize)
  const selectedRows = useMemo(() => result?.differences.filter((row) => selected.has(keyOf(row)) && row.kind !== 'same') ?? [], [result, selected])
  const selectedStatements = useMemo(() => selectedRows.flatMap((row) => { const statement = result ? statementFor(row, result) : undefined; return statement ? [statement] : [] }).join('\n\n'), [selectedRows, result])
  const destructive = selectedRows.some((row) => row.kind === 'target-only')

  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); setSource(items[0]?.id ?? ''); setTarget(items[1]?.id ?? items[0]?.id ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [])
  function invalidate(): void { if (result) { setResult(null); setSelected(new Set()); setMessage('Resultados desatualizados — Compare novamente.') } }
  async function operate(sync: boolean): Promise<void> {
    const keyNames = keys.split(',').map((part) => part.trim()).filter(Boolean); const columnNames = columns.split(',').map((part) => part.trim()).filter(Boolean)
    if (!keyNames.length) { setMessage('Comparison Key: informe ao menos uma coluna-chave.'); return }
    if (sync && !selectedRows.length) { setMessage('No objects selected to synchronize.'); return }
    setBusy(true); setMessage(sync ? 'Sincronizando dados…' : 'Comparando dados…')
    let sourceId = ''; let targetId = ''
    try {
      const a = records.find((item) => item.id === source); const b = records.find((item) => item.id === target)
      if (!a || !b || !sourceDb || !targetDb || !sourceTable || !targetTable) throw new Error('Selecione as conexões, databases e tabelas.')
      const [ca, cb] = await Promise.all([window.dbforge.connect(a), window.dbforge.connect(b)]); sourceId = ca.id; targetId = cb.id
      if (!sync) {
        const compared = await window.dbforge.compareData(sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keyNames, columnNames, allowDeletes)
        setResult(compared); setSelected(new Set(compared.differences.filter((row) => row.kind !== 'same' && (allowDeletes || row.kind !== 'target-only')).map(keyOf))); setPage(0)
        const r = compared.report; setMessage(`${r.compared} rows compared · ${r.sourceOnly} Only in source records · ${r.targetOnly} Only in target records · ${r.different} Different records · ${r.same} Identical records`)
      } else {
        const report = await window.dbforge.synchronizeData(sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keyNames, columnNames, allowDeletes, true, selectedRows.map((row) => row.key))
        setMessage(`Synchronization complete: ${report.succeeded} succeeded, ${report.failed} failed${report.errors.length ? ` — ${report.errors.join('; ')}` : ''}`); setConfirmOpen(false); setConfirmed(false)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comparison failed.') }
    finally { if (sourceId) void window.dbforge.disconnect(sourceId); if (targetId && targetId !== sourceId) void window.dbforge.disconnect(targetId); setBusy(false) }
  }
  function exportScript(): void { const blob = new Blob([selectedStatements], { type: 'text/sql;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'data-sync.sql'; anchor.click(); URL.revokeObjectURL(url) }
  function toggle(row: DataCompareDifference): void { setSelected((old) => { const next = new Set(old); if (next.has(keyOf(row))) next.delete(keyOf(row)); else next.add(keyOf(row)); return next }) }

  return <section className="tool-panel"><h2>⇄ Data Compare</h2><p>Selecione tabelas correspondentes e a Comparison Key. Sincronização aplica dados no destino.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <fieldset><legend>Source</legend><label>Source connection <select value={source} onChange={(event) => { invalidate(); setSource(event.target.value) }}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Source database <input value={sourceDb} onChange={(event) => { invalidate(); setSourceDb(event.target.value) }} /></label><label>Source table <input value={sourceTable} onChange={(event) => { invalidate(); setSourceTable(event.target.value) }} /></label></fieldset>
      <fieldset style={{ borderColor: 'var(--error)' }}><legend>Target (será modificado)</legend><label>Destination connection <select value={target} onChange={(event) => { invalidate(); setTarget(event.target.value) }}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Destination database <input value={targetDb} onChange={(event) => { invalidate(); setTargetDb(event.target.value) }} /></label><label>Destination table <input value={targetTable} onChange={(event) => { invalidate(); setTargetTable(event.target.value) }} /></label></fieldset>
    </div>
    <label>Comparison Key <input value={keys} onChange={(event) => { invalidate(); setKeys(event.target.value) }} placeholder="id, tenant_id" /></label><label>Columns in Comparison <input value={columns} onChange={(event) => { invalidate(); setColumns(event.target.value) }} placeholder="vazio = todas as colunas" /></label>
    <label style={{ display: 'block', margin: '8px 0' }}><input type="checkbox" checked={allowDeletes} onChange={(event) => { invalidate(); setAllowDeletes(event.target.checked) }} /> Allow deleting target-only rows</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button disabled={busy || !records.length} onClick={() => void operate(false)}>Compare (F5)</button><button disabled={busy || !selectedRows.length} onClick={() => { setConfirmOpen(true); setScriptOpen(false) }}>Synchronize</button><button disabled={!selectedStatements} onClick={() => setScriptOpen(true)}>Generate Data Script</button><button disabled={!selectedStatements} onClick={exportScript}>Export script</button></div>
    <p role="status">{message}</p>
    {result && <><h3>Summary</h3><p>{result.report.compared} rows compared · {result.report.sourceOnly} Only in source records · {result.report.targetOnly} Only in target records · {result.report.different} Different records · {result.report.same} Identical records</p>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}><select aria-label="Filter row differences" value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(0) }}><option value="all">All differences ({result.report.sourceOnly + result.report.targetOnly + result.report.different})</option><option value="different">Different ({result.report.different})</option><option value="source-only">Only in Source ({result.report.sourceOnly})</option><option value="target-only">Only in Target ({result.report.targetOnly})</option></select><button onClick={() => setSelected((old) => new Set([...old, ...pageRows.filter((row) => row.kind !== 'same' && (allowDeletes || row.kind !== 'target-only')).map(keyOf)]))}>Select page</button><button onClick={() => setSelected(new Set())}>None</button></div>
      <div style={{ maxHeight: 360, overflow: 'auto' }}>{pageRows.map((row, index) => <details key={`${page}-${index}-${keyOf(row)}`}><summary style={{ padding: 5, background: row.kind === 'source-only' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : row.kind === 'target-only' ? 'color-mix(in srgb, var(--error) 12%, transparent)' : 'color-mix(in srgb, orange 12%, transparent)' }}><input aria-label={`Include in Synchronization ${keyOf(row)}`} type="checkbox" checked={selected.has(keyOf(row))} disabled={row.kind === 'same' || (row.kind === 'target-only' && allowDeletes)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(row)} /> {row.kind === 'source-only' ? 'Only in Source +' : row.kind === 'target-only' ? 'Only in Target −' : row.kind === 'different' ? 'Different ≠' : 'Identical ='} · {JSON.stringify(row.key)}{row.changedColumns?.length ? ` · ${row.changedColumns.join(', ')}` : ''}</summary><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><div><b>Source</b><pre>{JSON.stringify(row.source ?? {}, null, 2)}</pre></div><div><b>Target</b><pre>{JSON.stringify(row.target ?? {}, null, 2)}</pre></div></div></details>)}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: 8 }}><button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>
      <small>{selectedRows.length} rows included in synchronization</small>
    </>}
    {scriptOpen && <div role="dialog" aria-modal="true" aria-label="Generated data synchronization script"><h3>Generate script without updating database</h3><textarea aria-label="Parameterized data script preview" readOnly value={selectedStatements} style={{ width: '100%', height: 220, fontFamily: 'monospace' }} /><button onClick={exportScript}>Export script</button><button onClick={() => setScriptOpen(false)}>Close</button></div>}
    {confirmOpen && <div role="dialog" aria-modal="true" aria-label="Data synchronization confirmation"><h3>Data Synchronization</h3><p>INSERT {selectedRows.filter((row) => row.kind === 'source-only').length} · UPDATE {selectedRows.filter((row) => row.kind === 'different').length} · DELETE {selectedRows.filter((row) => row.kind === 'target-only').length}</p><p>Destination: {targetDb}.{targetTable}</p>{destructive && <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Entendo que dados podem ser perdidos ao excluir registros</label>}<textarea aria-label="Selected data sync script" readOnly value={selectedStatements} style={{ width: '100%', height: 180, fontFamily: 'monospace' }} /><button disabled={destructive && !confirmed} onClick={() => void operate(true)}>Synchronize</button><button onClick={() => { setConfirmOpen(false); setConfirmed(false) }}>Cancel</button></div>}
  </section>
}
