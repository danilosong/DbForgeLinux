import { useEffect, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { DataCompareResult } from '../../../../../shared/contracts/data-compare.js'

export default function Panel(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState(''); const [sourceTable, setSourceTable] = useState(''); const [targetTable, setTargetTable] = useState('')
  const [keys, setKeys] = useState('id'); const [columns, setColumns] = useState(''); const [allowDeletes, setAllowDeletes] = useState(false)
  const [result, setResult] = useState<DataCompareResult | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); setSource(items[0]?.id ?? ''); setTarget(items[1]?.id ?? items[0]?.id ?? '') }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [])
  async function operate(sync: boolean): Promise<void> {
    const keyNames = keys.split(',').map((part) => part.trim()).filter(Boolean); const columnNames = columns.split(',').map((part) => part.trim()).filter(Boolean)
    if (!keyNames.length) { setMessage('Comparison Key: informe ao menos uma coluna-chave.'); return }
    if (sync && !window.confirm(`Data Synchronization\n${allowDeletes ? 'Registros podem ser excluídos do destino. ' : ''}Aplicar alterações em ${targetDb}.${targetTable}?`)) return
    setBusy(true); setMessage(sync ? 'Sincronizando dados…' : 'Comparando dados…'); setResult(null)
    let sourceId = ''; let targetId = ''
    try {
      const a = records.find((item) => item.id === source); const b = records.find((item) => item.id === target)
      if (!a || !b || !sourceDb || !targetDb || !sourceTable || !targetTable) throw new Error('Selecione as conexões, databases e tabelas.')
      const [ca, cb] = await Promise.all([window.dbforge.connect(a), window.dbforge.connect(b)]); sourceId = ca.id; targetId = cb.id
      if (!sync) {
        const compared = await window.dbforge.compareData(sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keyNames, columnNames)
        setResult(compared); const r = compared.report
        setMessage(`${r.compared} rows compared · ${r.sourceOnly} Only in source records · ${r.targetOnly} Only in target records · ${r.different} Different records · ${r.same} Identical records`)
      } else {
        const report = await window.dbforge.synchronizeData(sourceId, sourceDb, sourceTable, targetId, targetDb, targetTable, keyNames, columnNames, allowDeletes, true)
        setMessage(`Synchronization complete: ${report.succeeded} succeeded, ${report.failed} failed${report.errors.length ? ` — ${report.errors.join('; ')}` : ''}`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comparison failed.') }
    finally { if (sourceId) void window.dbforge.disconnect(sourceId); if (targetId && targetId !== sourceId) void window.dbforge.disconnect(targetId); setBusy(false) }
  }
  return <section className="tool-panel"><h2>⇄ Data Compare</h2><p>Selecione as tabelas e a Comparison Key. Tabelas sem chave única não podem ser comparadas com segurança.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <fieldset><legend>Source</legend><label>Connection <select value={source} onChange={(event) => setSource(event.target.value)}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Database <input value={sourceDb} onChange={(event) => setSourceDb(event.target.value)} /></label><label>Table <input value={sourceTable} onChange={(event) => setSourceTable(event.target.value)} /></label></fieldset>
      <fieldset style={{ borderColor: 'var(--error)' }}><legend>Target (será modificado)</legend><label>Connection <select value={target} onChange={(event) => setTarget(event.target.value)}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Database <input value={targetDb} onChange={(event) => setTargetDb(event.target.value)} /></label><label>Table <input value={targetTable} onChange={(event) => setTargetTable(event.target.value)} /></label></fieldset>
    </div>
    <label>Comparison Key <input value={keys} onChange={(event) => setKeys(event.target.value)} placeholder="id, tenant_id" /></label>
    <label>Columns in Comparison <input value={columns} onChange={(event) => setColumns(event.target.value)} placeholder="vazio = todas as colunas" /></label>
    <label style={{ display: 'block', margin: '8px 0' }}><input type="checkbox" checked={allowDeletes} onChange={(event) => setAllowDeletes(event.target.checked)} /> Allow deleting rows only in target</label>
    <div style={{ display: 'flex', gap: 8 }}><button disabled={busy || !records.length} onClick={() => void operate(false)}>Compare (F5)</button><button disabled={busy || !result} onClick={() => void operate(true)}>Synchronize</button></div>
    <p role="status">{message}</p>
    {result && <><h3>Results by row</h3><div style={{ maxHeight: 280, overflow: 'auto' }}>{result.differences.slice(0, 200).map((row, index) => <details key={`${index}-${JSON.stringify(row.key)}`}><summary>{row.kind === 'source-only' ? 'Only in source' : row.kind === 'target-only' ? 'Only in target' : row.kind === 'different' ? 'Different' : 'Identical'} · {JSON.stringify(row.key)}{row.changedColumns?.length ? ` · ${row.changedColumns.join(', ')}` : ''}</summary><pre>{JSON.stringify({ source: row.source, target: row.target }, null, 2)}</pre></details>)}</div>{result.differences.length > 200 && <p>Exibindo as primeiras 200 diferenças.</p>}</>}
  </section>
}
