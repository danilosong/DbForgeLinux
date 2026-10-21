import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useState } from 'react'
import type { ExplainNode, ProfileResult } from '../../../../../modules/profiler/index.js'
import { usePanelConnection } from '../registry'

type ProfilerTab = 'Profile' | 'Plan' | 'Plan Diagram' | 'Session Statistics'
const seconds = (picoseconds?: number): number => (picoseconds ?? 0) / 1_000_000_000_000
function PlanTree({ node, depth = 0 }: { node: ExplainNode; depth?: number }): React.JSX.Element {
  return <div className="profiler-plan-node" style={{ marginLeft: depth * 18 }}><strong>{node.operation}</strong><span>{node.table ?? ''}{node.rows === undefined ? '' : ` · ${node.rows} rows`}{node.cost === undefined ? '' : ` · cost ${node.cost}`}</span>{node.children.map((child, index) => <PlanTree key={`${child.operation}-${index}`} node={child} depth={depth + 1} />)}</div>
}

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()
  const activeConnection = usePanelConnection()
  const [connectionId, setConnectionId] = useState(activeConnection?.id ?? '')
  const [query, setQuery] = useState('SELECT 1')
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [history, setHistory] = useState<ProfileResult[]>([])
  const [tab, setTab] = useState<ProfilerTab>('Profile')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setConnectionId(activeConnection?.id ?? ''), [activeConnection?.id])
  useEffect(() => {
    const receiveProfile = (event: Event): void => {
      const value = (event as CustomEvent<ProfileResult>).detail
      if (!value || typeof value.query !== 'string') return
      setResult(value)
      setQuery(value.query)
      setHistory((items) => [value, ...items.filter((item) => item.startedAt !== value.startedAt)].slice(0, 100))
      setTab('Profile')
    }
    window.addEventListener('dbforge:profiler-profile', receiveProfile)
    return () => window.removeEventListener('dbforge:profiler-profile', receiveProfile)
  }, [])

  async function run(): Promise<void> {
    setError('')
    if (!connectionId.trim()) { setError(t('panel.profiler.connectionRequired')); return }
    if (!window.confirm(t('panel.profiler.confirmProfile'))) return
    setBusy(true)
    try {
      const value = await window.dbforge.profile(connectionId, query)
      setResult(value)
      setHistory(await window.dbforge.history(connectionId))
      setTab('Profile')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('panel.profiler.failed')) }
    finally { setBusy(false) }
  }
  const totalSeconds = result?.events.reduce((sum, event) => sum + seconds(event.timerWaitPs), 0) ?? 0
  return <section className="tool-panel profiler-panel">
    <header><h2>{t('panel.profiler.title')}</h2>{activeConnection ? <p>{t('panel.profiler.connection')} <strong>{activeConnection.name}</strong></p> : <label>{t('panel.profiler.connection')} <input value={connectionId} onChange={(event) => setConnectionId(event.target.value)} /></label>}</header>
    <label>SQL <textarea rows={4} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="profiler-toolbar"><button disabled={busy} onClick={() => void run()}>{busy ? t('panel.profiler.running') : t('panel.profiler.getResults')}</button><button disabled={busy} onClick={() => void run()}>{t('panel.profiler.refresh')}</button></div>
    {error && <p role="alert">{error}</p>}
    {!result ? <div className="tool-empty-state" role="status"><strong>{t('panel.profiler.title')}</strong><p>{t('prof.empty')}</p><small>{t('prof.empty.detail')}</small></div> : <><h3>{t('prof.col.duration')} {(result.durationMs / 1000).toFixed(3)} s</h3><nav className="module-tabs">{(['Profile', 'Plan', 'Plan Diagram', 'Session Statistics'] as const).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item === 'Session Statistics' ? t('panel.profiler.sessionStats') : item === 'Plan Diagram' ? t('panel.profiler.planDiagram') : item}</button>)}</nav>
      {tab === 'Profile' && <div className="module-table-wrap"><table><thead><tr><th>{t('panel.profiler.state')}</th><th>{t('panel.profiler.summedDuration')}</th><th>{t('panel.profiler.percentage')}</th></tr></thead><tbody>{result.events.map((event) => { const duration = seconds(event.timerWaitPs); return <tr key={event.eventId}><td>{event.sqlText?.trim() || `Statement ${event.eventId}`}</td><td>{duration.toFixed(6)}</td><td>{totalSeconds ? `${(duration / totalSeconds * 100).toFixed(2)}%` : '0.00%'}</td></tr> })}<tr className="profiler-total"><th>{t('panel.profiler.sum')}</th><th>{totalSeconds.toFixed(6)}</th><th>{totalSeconds ? '100.00%' : '0.00%'}</th></tr></tbody></table>{!result.events.length && <p>{t('panel.profiler.noEvents')}</p>}</div>}
      {tab === 'Plan' && <pre>{JSON.stringify(result.plan, null, 2)}</pre>}
      {tab === 'Plan Diagram' && <div className="profiler-plan-diagram"><p>{t('panel.profiler.totalCost')}: {result.plan.roots.reduce((sum, node) => sum + (node.cost ?? 0), 0).toFixed(3)}</p>{result.plan.roots.map((node, index) => <PlanTree key={`${node.operation}-${index}`} node={node} />)}{!result.plan.roots.length && <p>{t('panel.profiler.noPlan')}</p>}</div>}
      {tab === 'Session Statistics' && <div className="module-table-wrap"><table><thead><tr><th>Name</th><th>Value</th><th>{t('panel.profiler.description')}</th></tr></thead><tbody>{Object.entries(result.statusDelta).map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td><td>{t('panel.profiler.statusDescription')}</td></tr>)}</tbody></table></div>}
    </>}
    <h3>{t('panel.profiler.history')}</h3>{history.length ? <ul>{history.map((item, index) => <li key={`${item.startedAt}-${index}`}>{item.startedAt} · {(item.durationMs / 1000).toFixed(3)} s · {item.mode}</li>)}</ul> : <p className="tool-empty-state">{t('prof.history.empty')}</p>}
    <style>{`.profiler-panel{height:100%;min-height:380px;display:flex;flex-direction:column;gap:8px;overflow:auto}.profiler-panel header h2{margin:0}.profiler-panel header p{margin:4px 0;color:var(--muted)}.profiler-panel textarea{width:100%;box-sizing:border-box;background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:7px}.profiler-toolbar{display:flex;gap:8px}.profiler-panel .module-table-wrap{max-height:40vh}.profiler-panel .module-table-wrap table{width:100%;border-collapse:collapse}.profiler-total{font-weight:700;background:var(--bg-surface-alt)}.profiler-plan-diagram{display:grid;gap:8px;padding:10px;border:1px solid var(--border);border-radius:5px;background:var(--bg-surface)}.profiler-plan-node{display:grid;grid-template-columns:minmax(180px,1fr) minmax(150px,1fr);gap:8px;align-items:center;padding:8px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:4px;background:var(--bg-surface-alt)}.profiler-plan-node span{color:var(--muted);font-size:12px}@media(max-width:700px){.profiler-plan-node{grid-template-columns:1fr}}`}</style>
  </section>
}
