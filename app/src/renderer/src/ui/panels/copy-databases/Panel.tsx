import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import { usePanelConnection } from '../registry.js'

type CopyState = { status: 'pending' | 'running' | 'complete' | 'error' | 'skipped'; elapsedMs?: number; message?: string }
export default function CopyDatabasesPanel(): React.JSX.Element {
  const { t } = useI18n()
  const active = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [sourceId, setSourceId] = useState(active?.recordId ?? '')
  const [targetId, setTargetId] = useState('')
  const [sourceDatabases, setSourceDatabases] = useState<string[]>([])
  const [targetDatabases, setTargetDatabases] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [includeData, setIncludeData] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropIfExists, setDropIfExists] = useState(false)
  const [progress, setProgress] = useState<Record<string, CopyState>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const source = records.find((record) => record.id === sourceId)
  const target = records.find((record) => record.id === targetId)

  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); setSourceId((current) => current || active?.recordId || items[0]?.id || ''); setTargetId((current) => current || items.find((item) => item.id !== active?.recordId)?.id || items[0]?.id || '') }).catch((error: unknown) => setMessage(errorText(error))) }, [active?.recordId])
  useEffect(() => { if (!source) { setSourceDatabases([]); return }; void loadDatabases(source).then(setSourceDatabases).catch((error: unknown) => setMessage(errorText(error))) }, [source])
  useEffect(() => { if (!target) { setTargetDatabases([]); return }; void loadDatabases(target).then(setTargetDatabases).catch((error: unknown) => setMessage(errorText(error))) }, [target])
  useEffect(() => setSelected((current) => current.filter((item) => sourceDatabases.includes(item))), [sourceDatabases])

  async function loadDatabases(record: ConnectionRecord): Promise<string[]> {
    const connected = await window.dbforge.connect(record)
    try { return await window.dbforge.listDatabases(connected.id) }
    finally { await window.dbforge.disconnect(connected.id) }
  }
  async function runCopy(): Promise<void> {
    if (!source || !target || !selected.length) { setMessage(t('copy.selectSourceAndTarget')); return }
    if (sourceId === targetId && selected.some((item) => targetDatabases.includes(item))) { setMessage(t('copy.sameServerConflict')); return }
    setBusy(true); setMessage(t('copy.running'))
    for (const database of selected) {
      if (!targetDatabases.includes(database)) { setProgress((current) => ({ ...current, [database]: { status: 'error', message: t('copy.targetDatabaseMissing') } })); continue }
      const confirmationText = dropIfExists ? `DROP ${database}` : database
      const typed = window.prompt(t('copy.confirm', [database, confirmationText]))
      if (typed !== confirmationText) { setProgress((current) => ({ ...current, [database]: { status: 'skipped' } })); continue }
      setProgress((current) => ({ ...current, [database]: { status: 'running' } }))
      const started = performance.now()
      let sourceConnection: { id: string } | undefined
      let targetConnection: { id: string } | undefined
      try {
        sourceConnection = await window.dbforge.connect(source)
        targetConnection = await window.dbforge.connect(target)
        const report = await window.dbforge.copyDatabase(sourceConnection.id, database, targetConnection.id, database, confirmationText, includeData, dropIfExists)
        const elapsedMs = performance.now() - started
        setProgress((current) => ({ ...current, [database]: { status: report.errors.length ? 'error' : 'complete', elapsedMs, message: `${report.rows} ${t('copy.rows')} · ${report.errors.length} ${t('copy.errors')}` } }))
      } catch (error) { setProgress((current) => ({ ...current, [database]: { status: 'error', elapsedMs: performance.now() - started, message: errorText(error) } })) }
      finally { await Promise.allSettled([...(targetConnection ? [window.dbforge.disconnect(targetConnection.id)] : []), ...(sourceConnection ? [window.dbforge.disconnect(sourceConnection.id)] : [])]) }
    }
    setBusy(false); setMessage(t('copy.finished'))
  }

  return <section className="copy-databases-panel">
    <header><h2>{t('copy.title')}</h2><p>{t('copy.description')}</p></header>
    <div className="copy-server-selectors"><label>{t('copy.sourceServer')}<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button aria-label={t('copy.swap')} onClick={() => { setSourceId(targetId); setTargetId(sourceId) }}>⇄</button><label>{t('copy.targetServer')}<select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <div className="copy-selection"><header><strong>{t('copy.selected', [String(selected.length), String(sourceDatabases.length)])}</strong><label>{t('copy.search')} <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t('copy.searchHint')} /></label><button onClick={() => setSelected(sourceDatabases)}>{t('invalid.checkAll')}</button><button onClick={() => setSelected([])}>{t('invalid.uncheckAll')}</button></header><div className="copy-database-list">{sourceDatabases.filter((database) => database.toLowerCase().includes(searchTerm.toLowerCase())).map((database) => <label key={database}><input type="checkbox" checked={selected.includes(database)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, database] : current.filter((item) => item !== database))} />{database}</label>)}</div></div>
    <fieldset><legend>{t('copy.options')}</legend><label><input type="checkbox" checked={includeData} onChange={(event) => setIncludeData(event.target.checked)} />{t('copy.includeData')}</label><label className="copy-drop"><input type="checkbox" checked={dropIfExists} onChange={(event) => setDropIfExists(event.target.checked)} />{t('copy.dropIfExists')}<small>{t('copy.dropWarning')}</small></label></fieldset>
    <div className="copy-toolbar"><button className="button-primary" disabled={busy || !selected.length || !source || !target} onClick={() => void runCopy()}>{busy ? t('copy.running') : t('copy.start')}</button><span role="status">{message}</span></div>
    <table className="copy-progress"><thead><tr><th>{t('copy.database')}</th><th>{t('copy.includeDataShort')}</th><th>{t('copy.dropShort')}</th><th>{t('copy.target')}</th><th>{t('copy.progress')}</th><th>{t('copy.elapsed')}</th></tr></thead><tbody>{selected.map((database) => { const state = progress[database]; return <tr key={database}><td>{database}</td><td>{includeData ? '✓' : '—'}</td><td>{dropIfExists ? '✓' : '—'}</td><td>{target?.name} / {database}</td><td>{state?.status ? t(`copy.status.${state.status}`) : '—'}{state?.message ? ` · ${state.message}` : ''}</td><td>{state?.elapsedMs === undefined ? '—' : `${(state.elapsedMs / 1000).toFixed(1)} s`}</td></tr> })}</tbody></table>
    <style>{`.copy-databases-panel{height:100%;display:flex;flex-direction:column;gap:12px;overflow:auto;color:var(--text)}.copy-databases-panel h2{margin:0}.copy-databases-panel header p{color:var(--text-secondary);margin:4px 0}.copy-server-selectors{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end}.copy-server-selectors label,.copy-selection header label{display:flex;flex-direction:column;gap:4px}.copy-server-selectors select{width:100%}.copy-selection{border:1px solid var(--border);border-radius:5px;padding:8px}.copy-selection>header{display:flex;align-items:end;gap:8px;flex-wrap:wrap}.copy-selection header label{margin-left:auto}.copy-database-list{display:flex;gap:10px;flex-wrap:wrap;max-height:130px;overflow:auto;padding-top:8px}.copy-database-list label,.copy-databases-panel fieldset label{display:inline-flex;align-items:center;gap:5px}.copy-databases-panel fieldset{display:flex;gap:16px;flex-wrap:wrap;border:1px solid var(--border);border-radius:5px}.copy-drop{display:flex;flex-wrap:wrap}.copy-drop small{flex-basis:100%;margin-left:22px;color:var(--text-secondary)}.copy-toolbar{display:flex;gap:10px;align-items:center}.copy-toolbar span{color:var(--text-secondary)}.copy-progress{border-collapse:collapse;width:100%}.copy-progress th,.copy-progress td{border-bottom:1px solid var(--border);padding:7px;text-align:left}.copy-progress th{background:var(--bg-surface-alt)}`}</style>
  </section>
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Database copy failed.' }
