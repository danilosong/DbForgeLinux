import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useState } from 'react'
import { compareProfileRuns, type ExplainNode, type ProfileResult } from '../../../../../modules/profiler/index.js'
import { usePanelConnection } from '../registry'

type ProfilerTab = 'Profile' | 'Plan' | 'Plan Diagram' | 'Session Statistics'
const seconds = (picoseconds?: number): number => (picoseconds ?? 0) / 1_000_000_000_000
const runKey = (item: ProfileResult): string => `${item.startedAt}:${item.mode}:${item.normalizedQuery}`
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
  const [selectedRunKey, setSelectedRunKey] = useState('')
  const [comparisonKeys, setComparisonKeys] = useState<string[]>([])
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
      setHistory((items) => [value, ...items.filter((item) => runKey(item) !== runKey(value))].slice(0, 100))
      setSelectedRunKey(runKey(value))
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
      const items = await window.dbforge.history(connectionId)
      setHistory(items.some((item) => runKey(item) === runKey(value)) ? items : [value, ...items].slice(0, 100))
      setSelectedRunKey(runKey(value))
      setTab('Profile')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('panel.profiler.failed')) }
    finally { setBusy(false) }
  }
  const displayed = history.find((item) => runKey(item) === selectedRunKey) ?? result
  const comparedRuns = comparisonKeys.map((key) => history.find((item) => runKey(item) === key)).filter((item): item is ProfileResult => Boolean(item))
  const comparison = comparedRuns.length === 2 ? compareProfileRuns(comparedRuns[0]!, comparedRuns[1]!) : undefined
  const totalSeconds = displayed?.events.reduce((sum, event) => sum + seconds(event.timerWaitPs), 0) ?? 0
  function toggleComparison(key: string, checked: boolean): void {
    setComparisonKeys((current) => checked ? current.length < 2 ? [...current, key] : current : current.filter((item) => item !== key))
  }
  return <section className="tool-panel profiler-panel">
    <header><h2>{t('panel.profiler.title')}</h2>{activeConnection ? <p>{t('panel.profiler.connection')} <strong>{activeConnection.name}</strong></p> : <label>{t('panel.profiler.connection')} <input value={connectionId} onChange={(event) => setConnectionId(event.target.value)} /></label>}</header>
    <label>SQL <textarea rows={4} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="profiler-toolbar"><button disabled={busy} onClick={() => void run()}>{busy ? t('panel.profiler.running') : t('panel.profiler.getResults')}</button><button disabled={busy} onClick={() => void run()}>{t('panel.profiler.refresh')}</button></div>
    {error && <p role="alert">{error}</p>}
    <h3>{t('panel.profiler.history')}</h3>{history.length ? <div className="profiler-history-layout" data-testid="profiler-history-layout"><aside className="profiler-history-list" aria-label={t('prof.history.list')}><strong>{t('prof.history.list')}</strong>{history.map((item, index) => { const key = runKey(item); return <div className="profiler-history-item" key={key}><button type="button" aria-pressed={key === selectedRunKey} onClick={() => { setSelectedRunKey(key); setTab('Profile') }}><strong>{t('prof.history.run', [String(index + 1)])} · {(item.durationMs / 1000).toFixed(3)} s</strong><small>{item.startedAt} · {item.mode}</small><span>{item.query.slice(0, 96)}</span></button><label><input type="checkbox" aria-label={t('prof.history.select', [String(index + 1)])} checked={comparisonKeys.includes(key)} disabled={comparisonKeys.length >= 2 && !comparisonKeys.includes(key)} onChange={(event) => toggleComparison(key, event.target.checked)} /></label></div> })}</aside><section className="profiler-history-details" data-testid="profiler-history-details"><header><strong>{comparison ? t('prof.history.compare') : t('prof.history.details')}</strong>{comparison && <button type="button" onClick={() => setComparisonKeys([])}>{t('prof.history.removeCompare')}</button>}</header>{comparison && comparedRuns.length === 2 ? <><div className="profiler-comparison-summary"><p>{t('prof.history.durationDelta')}: <strong>{comparison.durationDeltaMs >= 0 ? '+' : ''}{comparison.durationDeltaMs.toFixed(3)} ms</strong></p><p>{t('prof.history.eventDelta')}: <strong>{comparison.eventCountDelta >= 0 ? '+' : ''}{comparison.eventCountDelta}</strong></p><p>{comparison.planChanged ? t('prof.history.planChanged') : t('prof.history.planSame')}</p></div><div className="profiler-plan-comparison">{comparedRuns.map((item, index) => <article key={runKey(item)}><h4>{t(index === 0 ? 'prof.history.first' : 'prof.history.second')}</h4><p>{item.query}</p><pre>{JSON.stringify(item.plan, null, 2)}</pre></article>)}</div><div className="module-table-wrap"><table><thead><tr><th>{t('prof.history.statusCounter')}</th><th>{t('prof.history.first')}</th><th>{t('prof.history.second')}</th><th>Δ</th></tr></thead><tbody>{comparison.statusCounters.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.first}</td><td>{row.second}</td><td>{row.delta >= 0 ? '+' : ''}{row.delta}</td></tr>)}</tbody></table></div></> : displayed ? <><h3>{t('prof.col.duration')} {(displayed.durationMs / 1000).toFixed(3)} s</h3><nav className="module-tabs">{(['Profile', 'Plan', 'Plan Diagram', 'Session Statistics'] as const).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item === 'Session Statistics' ? t('panel.profiler.sessionStats') : item === 'Plan Diagram' ? t('panel.profiler.planDiagram') : item}</button>)}</nav>{tab === 'Profile' && <div className="module-table-wrap"><table><thead><tr><th>{t('panel.profiler.state')}</th><th>{t('panel.profiler.summedDuration')}</th><th>{t('panel.profiler.percentage')}</th></tr></thead><tbody>{displayed.events.map((event) => { const duration = seconds(event.timerWaitPs); return <tr key={event.eventId}><td>{event.sqlText?.trim() || `Statement ${event.eventId}`}</td><td>{duration.toFixed(6)}</td><td>{totalSeconds ? `${(duration / totalSeconds * 100).toFixed(2)}%` : '0.00%'}</td></tr> })}<tr className="profiler-total"><th>{t('panel.profiler.sum')}</th><th>{totalSeconds.toFixed(6)}</th><th>{totalSeconds ? '100.00%' : '0.00%'}</th></tr></tbody></table>{!displayed.events.length && <p>{t('panel.profiler.noEvents')}</p>}</div>}{tab === 'Plan' && <pre>{JSON.stringify(displayed.plan, null, 2)}</pre>}{tab === 'Plan Diagram' && <div className="profiler-plan-diagram"><p>{t('panel.profiler.totalCost')}: {displayed.plan.roots.reduce((sum, node) => sum + (node.cost ?? 0), 0).toFixed(3)}</p>{displayed.plan.roots.map((node, index) => <PlanTree key={`${node.operation}-${index}`} node={node} />)}{!displayed.plan.roots.length && <p>{t('panel.profiler.noPlan')}</p>}</div>}{tab === 'Session Statistics' && <div className="module-table-wrap"><table><thead><tr><th>Name</th><th>Value</th><th>{t('panel.profiler.description')}</th></tr></thead><tbody>{Object.entries(displayed.statusDelta).map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td><td>{t('panel.profiler.statusDescription')}</td></tr>)}</tbody></table></div>}</> : <p className="tool-empty-state">{t('prof.history.choose')}</p>}</section></div> : <div className="tool-empty-state" role="status">{t('prof.history.empty')}</div>}
    <style>{`.profiler-panel{height:100%;min-height:380px;display:flex;flex-direction:column;gap:8px;overflow:auto}.profiler-panel header h2{margin:0}.profiler-panel header p{margin:4px 0;color:var(--muted)}.profiler-panel textarea{width:100%;box-sizing:border-box;background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:7px}.profiler-toolbar{display:flex;gap:8px}.profiler-history-layout{display:grid;grid-template-columns:minmax(240px,.75fr) minmax(0,1.6fr);gap:10px;min-height:300px;flex:1}.profiler-history-list,.profiler-history-details{min-width:0;overflow:auto;border:1px solid var(--border);border-radius:5px;padding:8px;background:var(--bg-surface)}.profiler-history-list{display:flex;flex-direction:column;gap:5px}.profiler-history-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:4px;border-bottom:1px solid var(--border);padding:5px}.profiler-history-item>button{display:grid;gap:3px;text-align:left;border:0;background:transparent;color:var(--text);padding:5px;min-width:0}.profiler-history-item>button[aria-pressed=true]{background:var(--accent-soft)}.profiler-history-item small,.profiler-history-item span{overflow-wrap:anywhere;color:var(--muted)}.profiler-history-details>header{display:flex;justify-content:space-between;align-items:center}.profiler-history-details .module-table-wrap{max-height:32vh}.profiler-history-details .module-table-wrap table{width:100%;border-collapse:collapse}.profiler-comparison-summary{display:flex;gap:14px;flex-wrap:wrap}.profiler-plan-comparison{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profiler-plan-comparison article{min-width:0;overflow:auto;border:1px solid var(--border);padding:7px}.profiler-plan-comparison pre{max-height:220px;overflow:auto}.profiler-total{font-weight:700;background:var(--bg-surface-alt)}.profiler-plan-diagram{display:grid;gap:8px;padding:10px;border:1px solid var(--border);border-radius:5px;background:var(--bg-surface)}.profiler-plan-node{display:grid;grid-template-columns:minmax(180px,1fr) minmax(150px,1fr);gap:8px;align-items:center;padding:8px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:4px;background:var(--bg-surface-alt)}.profiler-plan-node span{color:var(--muted);font-size:12px}@media(max-width:700px){.profiler-history-layout,.profiler-plan-comparison{grid-template-columns:1fr}.profiler-plan-node{grid-template-columns:1fr}}`}</style>
  </section>
}
