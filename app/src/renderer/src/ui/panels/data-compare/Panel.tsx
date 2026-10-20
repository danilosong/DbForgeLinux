import { useI18n } from '../../i18n/useI18n.js'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { DataCompareResult } from '../../../../../shared/contracts/data-compare.js'
import type { DataCompareDifference } from '../../../../../modules/data-compare/types.js'
import './Panel.css'
import { usePanelConnection } from '../registry'

type Filter = 'all' | 'same' | 'different' | 'source-only' | 'target-only'
const keyOf = (row: DataCompareDifference): string => JSON.stringify(row.key)
const statementFor = (row: DataCompareDifference, result: DataCompareResult): string | undefined => {
  const entry = result.keyedStatements.find((item) => JSON.stringify(item.key) === keyOf(row))
  const statement = entry?.statement
  return statement ? `${statement.kind} ${statement.sql};` : undefined
}

function formatCompareCell(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return '—'
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([]); const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState(''); const [sourceTable, setSourceTable] = useState(''); const [targetTable, setTargetTable] = useState('')
  const [keys, setKeys] = useState('id'); const [columns, setColumns] = useState(''); const [allowDeletes, setAllowDeletes] = useState(false)
  const [result, setResult] = useState<DataCompareResult | null>(null); const [selected, setSelected] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<Filter>('all'); const [scrollTop, setScrollTop] = useState(0); const [confirmOpen, setConfirmOpen] = useState(false); const [confirmed, setConfirmed] = useState(false); const [scriptOpen, setScriptOpen] = useState(false)
  const visible = useMemo(() => result?.differences.filter((row) => filter === 'all' || row.kind === filter) ?? [], [result, filter])
  const rowHeight = 38; const viewportHeight = 360; const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 4); const endIndex = Math.min(visible.length, startIndex + Math.ceil(viewportHeight / rowHeight) + 8); const virtualRows = visible.slice(startIndex, endIndex)
  const dataColumns = useMemo(() => [...new Set((result?.differences ?? []).flatMap((row) => [...Object.keys(row.source ?? {}), ...Object.keys(row.target ?? {})]))], [result])
  const selectedRows = useMemo(() => result?.differences.filter((row) => selected.has(keyOf(row)) && row.kind !== 'same') ?? [], [result, selected])
  const selectedStatements = useMemo(() => selectedRows.flatMap((row) => { const statement = result ? statementFor(row, result) : undefined; return statement ? [statement] : [] }).join('\n\n'), [selectedRows, result])
  const destructive = selectedRows.some((row) => row.kind === 'target-only')

  useEffect(() => { void window.dbforge.getConnections().then((items) => { const selected = items.find((item) => item.id === activeConnection?.recordId || item.name === activeConnection?.name)?.id ?? items[0]?.id ?? ''; setRecords(items); setSource(selected); setTarget(selected) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [activeConnection?.name, activeConnection?.recordId])
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
        setResult(compared); setSelected(new Set(compared.differences.filter((row) => row.kind !== 'same' && (allowDeletes || row.kind !== 'target-only')).map(keyOf))); setScrollTop(0)
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

  return <section className="tool-panel compare-panel"><h2>{t('panel.data.compare.m2163e76049')}</h2><p>{t('panel.data.compare.m91930e9f4f')}</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <fieldset><legend>{t('cmp.dest.connection')}</legend><div className="compare-form"><label>{t('panel.data.compare.m01a5ca1ebb')}<select value={source} onChange={(event) => { invalidate(); setSource(event.target.value) }}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{t('panel.data.compare.m04765eab65')}<input value={sourceDb} onChange={(event) => { invalidate(); setSourceDb(event.target.value) }} /></label><label>{t('panel.data.compare.m8a976ef767')}<input value={sourceTable} onChange={(event) => { invalidate(); setSourceTable(event.target.value) }} /></label></div></fieldset>
      <fieldset style={{ borderColor: 'var(--error)' }}><legend>{t('panel.data.compare.mecd901df72')}</legend><div className="compare-form"><label>{t('panel.data.compare.m644fda7c82')}<select value={target} onChange={(event) => { invalidate(); setTarget(event.target.value) }}>{records.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{t('panel.data.compare.m3064a39982')}<input value={targetDb} onChange={(event) => { invalidate(); setTargetDb(event.target.value) }} /></label><label>{t('panel.data.compare.m1ed342c97d')}<input value={targetTable} onChange={(event) => { invalidate(); setTargetTable(event.target.value) }} /></label></div></fieldset>
    </div>
    <div className="compare-form compare-options"><label>{t('panel.data.compare.me34ea2dada')}<input value={keys} onChange={(event) => { invalidate(); setKeys(event.target.value) }} placeholder={t('panel.data.compare.m3572e623b6')} /></label><label>{t('panel.data.compare.m355d4b9833')}<input value={columns} onChange={(event) => { invalidate(); setColumns(event.target.value) }} placeholder={t('panel.data.compare.m82b3c19da2')} /></label></div>
    <label style={{ display: 'block', margin: '8px 0' }}><input type="checkbox" checked={allowDeletes} onChange={(event) => { invalidate(); setAllowDeletes(event.target.checked) }} /> {t('panel.data.compare.m0f7fcd5d29')}</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button disabled={busy || !records.length} onClick={() => void operate(false)}>{t('panel.data.compare.m8f0e836200')}</button><button disabled={busy || !selectedRows.length} onClick={() => { setConfirmOpen(true); setScriptOpen(false) }}>{t('panel.data.compare.md12490c5e5')}</button><button disabled={!selectedStatements} onClick={() => setScriptOpen(true)}>{t('panel.data.compare.m19a5071fc4')}</button><button disabled={!selectedStatements} onClick={exportScript}>{t('panel.data.compare.m84b54d8f23')}</button></div>
    <p role="status">{message}</p>
    {result && <><h3>{t('panel.data.compare.m2a5a4ede9f')}</h3><p>{result.report.compared} {t('panel.data.compare.m7f0a540aca')} {result.report.sourceOnly} {t('panel.data.compare.m5d2a455a62')} {result.report.targetOnly} {t('panel.data.compare.m33a818172a')} {result.report.different} {t('panel.data.compare.m8ea9e4bc05')} {result.report.same} {t('cmp.data.identical')}</p>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}><select aria-label={t('panel.data.compare.mcca8bc1ca3')} value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setScrollTop(0) }}><option value="all">{t('panel.data.compare.me78ffac444')} ({result.report.compared})</option><option value="same">{t('cmp.data.identical')} ({result.report.same})</option><option value="different">{t('panel.data.compare.m9778d52c5a')} ({result.report.different})</option><option value="source-only">{t('panel.data.compare.m524bfee195')} ({result.report.sourceOnly})</option><option value="target-only">{t('panel.data.compare.m66c15f855c')} ({result.report.targetOnly})</option></select><button onClick={() => setSelected((old) => new Set([...old, ...visible.filter((row) => row.kind !== 'same' && (allowDeletes || row.kind !== 'target-only')).map(keyOf)]))}>{t('panel.data.compare.m9227a1eb59')}</button><button onClick={() => setSelected(new Set())}>{t('panel.data.compare.m878a2e05e1')}</button></div>
      <div role="grid" aria-label={t('panel.data.compare.m2a5a4ede9f')} className="data-compare-grid" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} style={{ height: viewportHeight, overflow: 'auto', border: '1px solid var(--border)' }}><table style={{ borderCollapse: 'collapse', minWidth: '100%', width: 'max-content' }}><thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-surface)' }}><tr><th>{t('panel.data.compare.m9227a1eb59')}</th><th>{t('panel.data.compare.mcca8bc1ca3')}</th><th>Key</th>{dataColumns.map((column) => <Fragment key={column}><th>{t('cmp.dest.connection')}: {column}</th><th>{t('panel.data.compare.m165229c8e9')}: {column}</th></Fragment>)}</tr></thead><tbody><tr aria-hidden="true" style={{ height: startIndex * rowHeight }}><td colSpan={3 + dataColumns.length * 2} /></tr>{virtualRows.map((row) => <tr key={keyOf(row)} className={`compare-row-${row.kind}`} style={{ height: rowHeight, background: row.kind === 'source-only' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : row.kind === 'target-only' ? 'color-mix(in srgb, var(--error) 12%, transparent)' : row.kind === 'different' ? 'color-mix(in srgb, orange 12%, transparent)' : undefined }}><td><input aria-label={`Include in Synchronization ${keyOf(row)}`} type="checkbox" checked={selected.has(keyOf(row))} disabled={row.kind === 'same' || (row.kind === 'target-only' && allowDeletes)} onChange={() => toggle(row)} /></td><td>{row.kind}</td><td>{JSON.stringify(row.key)}</td>{dataColumns.map((column) => <Fragment key={column}><td className={row.changedColumns?.includes(column) ? 'compare-cell-changed' : undefined}>{formatCompareCell(row.source?.[column])}</td><td className={row.changedColumns?.includes(column) ? 'compare-cell-changed' : undefined}>{formatCompareCell(row.target?.[column])}</td></Fragment>)}</tr>)}<tr aria-hidden="true" style={{ height: Math.max(0, (visible.length - endIndex) * rowHeight) }}><td colSpan={3 + dataColumns.length * 2} /></tr></tbody></table></div>
      <small>{selectedRows.length} {t('panel.data.compare.m4477c70324')}</small>
    </>}
    {scriptOpen && <div role="dialog" aria-modal="true" aria-label={t('panel.data.compare.m395376dfc6')}><h3>{t('cmp.out.scriptOnly')}</h3><textarea aria-label={t('panel.data.compare.m5df5d3719c')} readOnly value={selectedStatements} style={{ width: '100%', height: 220, fontFamily: 'monospace' }} /><button onClick={exportScript}>{t('panel.data.compare.m84b54d8f23')}</button><button onClick={() => setScriptOpen(false)}>{t('panel.data.compare.m2e3e2d5a9a')}</button></div>}
    {confirmOpen && <div role="dialog" aria-modal="true" aria-label={t('panel.data.compare.m972713788b')}><h3>{t('panel.data.compare.m3848a2014c')}</h3><p>INSERT {selectedRows.filter((row) => row.kind === 'source-only').length} {t('panel.data.compare.mfff4af6df7')} {selectedRows.filter((row) => row.kind === 'different').length} {t('panel.data.compare.m7b7062e979')} {selectedRows.filter((row) => row.kind === 'target-only').length}</p><p>{t('panel.data.compare.m9067dd8498')} {targetDb}.{targetTable}</p>{destructive && <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> {t('panel.data.compare.mb0d882fd0e')}</label>}<textarea aria-label={t('panel.data.compare.mda8e25dba0')} readOnly value={selectedStatements} style={{ width: '100%', height: 180, fontFamily: 'monospace' }} /><button disabled={destructive && !confirmed} onClick={() => void operate(true)}>{t('panel.data.compare.md12490c5e5')}</button><button onClick={() => { setConfirmOpen(false); setConfirmed(false) }}>{t('common.cancel')}</button></div>}
  </section>
}
