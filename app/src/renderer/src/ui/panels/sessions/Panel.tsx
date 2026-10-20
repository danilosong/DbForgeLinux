import { useCallback, useEffect, useMemo, useState } from 'react'
import './Panel.css'
import type { ConnectionRecord, ConnectionSummary } from '../../../../../shared/contracts.js'
import type { KillMode, SessionDetails, SessionInfo, VariableChange, VariableInfo } from '../../../../../modules/sessions/index.js'
import { usePanelConnection } from '../registry'

type Tab = 'Sessions' | 'Server Variables' | 'Status'
const refreshOptions = [0, 2, 5, 10, 30]

export default function Panel(): React.JSX.Element {
  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [recordId, setRecordId] = useState('')
  const [connection, setConnection] = useState<ConnectionSummary | undefined>(activeConnection)
  const [tab, setTab] = useState<Tab>('Sessions')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [details, setDetails] = useState<SessionDetails>()
  const [detailTab, setDetailTab] = useState<'Query' | 'Locks' | 'Info'>('Query')
  const [filters, setFilters] = useState({ hideSleep: false, onlyMine: false, search: '' })
  const [refreshSeconds, setRefreshSeconds] = useState(0)
  const [updated, setUpdated] = useState('')
  const [stale, setStale] = useState(false)
  const [variables, setVariables] = useState<VariableInfo[]>([])
  const [status, setStatus] = useState<Record<string, string>>({})
  const [scope, setScope] = useState<'SESSION' | 'GLOBAL'>('GLOBAL')
  const [pending, setPending] = useState<Record<string, string>>({})
  const [variableFilter, setVariableFilter] = useState('')
  const [persist, setPersist] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); if (!activeConnection?.recordId && items[0]) setRecordId(items[0].id) }).catch(showError) }, [activeConnection?.recordId])
  useEffect(() => { setConnection(activeConnection) }, [activeConnection])
  useEffect(() => { if (activeConnection?.recordId) setRecordId(activeConnection.recordId) }, [activeConnection?.recordId])
  useEffect(() => {
    const connectionId = connection?.id
    const shouldDisconnect = Boolean(connectionId && connectionId !== activeConnection?.id)
    return () => { if (connectionId && shouldDisconnect) void window.dbforge.disconnect(connectionId) }
  }, [connection?.id, activeConnection?.id])
  const refreshSessions = useCallback(async (showBusy = true): Promise<void> => {
    if (!connection) return
    if (showBusy) setLoading(true)
    try {
      const rows = await window.dbforge.listSessions(connection.id, { ...filters })
      setSessions(rows); setStale(false); setUpdated(new Date().toLocaleTimeString()); setError('')
      if (details && !rows.some((item) => item.id === details.session.id)) setDetails(undefined)
    } catch (reason) { setStale(true); showError(reason, false) }
    finally { if (showBusy) setLoading(false) }
  }, [connection, filters, details])
  const refreshVariables = useCallback(async (): Promise<void> => {
    if (!connection) return
    setLoading(true); setError('')
    try { const snapshot = await window.dbforge.getServerVariables(connection.id, scope); setVariables(snapshot.variables); setPending({}) }
    catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }, [connection, scope])
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!connection) return
    setLoading(true); setError('')
    try { setStatus(await window.dbforge.getServerStatus(connection.id, scope)) }
    catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }, [connection, scope])
  useEffect(() => { if (connection && tab === 'Sessions') void refreshSessions() }, [connection, tab, refreshSessions])
  useEffect(() => {
    if (!connection || !refreshSeconds || tab !== 'Sessions') return
    const timer = window.setInterval(() => { void refreshSessions(false) }, refreshSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [connection, refreshSeconds, tab, refreshSessions])
  useEffect(() => { if (connection && tab === 'Server Variables') void refreshVariables() }, [connection, tab, refreshVariables])
  useEffect(() => { if (connection && tab === 'Status') void refreshStatus() }, [connection, tab, refreshStatus])

  const visibleVariables = useMemo(() => variables.filter((item) => item.name.toLowerCase().includes(variableFilter.toLowerCase())), [variables, variableFilter])
  const activeSessions = sessions.filter((item) => item.command?.toLowerCase() !== 'sleep').length
  const slowSessions = sessions.filter((item) => item.timeSeconds > 60).length
  const readOnly = Boolean(connection && records.find((item) => item.id === connection.recordId)?.advanced.readOnly)

  async function connect(): Promise<void> {
    const record = records.find((item) => item.id === recordId)
    if (!record) return
    setLoading(true); setError('')
    try { setConnection(await window.dbforge.connect(record)) }
    catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  function showError(reason: unknown, clear = true): void {
    const text = reason instanceof Error ? reason.message : String(reason)
    setError(clear ? text : 'Refresh failed — retrying. Existing rows are marked stale.')
  }
  async function selectSession(session: SessionInfo): Promise<void> {
    if (!connection) return
    setDetails(undefined)
    try { setDetails(await window.dbforge.getSessionDetails(connection.id, session.id)); setDetailTab('Query') }
    catch (reason) { showError(reason) }
  }
  async function kill(mode: KillMode): Promise<void> {
    if (!connection || readOnly || !selectedIds.length) return
    if (!window.confirm(`Do you really want to kill selected session${selectedIds.length === 1 ? '' : 's'}? Transactions in progress will be rolled back.`)) return
    setLoading(true)
    try {
      const results = await window.dbforge.killSessions(connection.id, selectedIds, mode, true)
      const failures = results.filter((result) => !result.success)
      setMessage(failures.length ? failures.map((result) => `${result.id}: ${result.error}`).join(' · ') : `Kill ${mode === 'query' ? 'Query' : 'Session'} succeeded.`)
      setSelectedIds([]); await refreshSessions(false)
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  async function applyVariable(variable: VariableInfo): Promise<void> {
    if (!connection || readOnly) return
    const newValue = pending[variable.name]
    if (newValue === undefined || newValue === variable.value) return
    if (!variable.dynamic) { setError(`${variable.name}: Requires server restart / my.cnf.`); return }
    if (scope === 'GLOBAL' && !window.confirm(`Apply ${variable.name} globally? SET GLOBAL affects all new connections and does not persist after restart.${persist ? ' This will use SET PERSIST.' : ''}`)) return
    setLoading(true); setError('')
    const change: VariableChange = { name: variable.name, oldValue: variable.value, newValue, scope, dynamic: variable.dynamic }
    try { await window.dbforge.setServerVariable(connection.id, change, { confirm: true, persist }); setMessage(`${variable.name} applied.`); await refreshVariables() }
    catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  function variableInput(variable: VariableInfo): React.JSX.Element {
    const value = pending[variable.name] ?? variable.value
    const onChange = (next: string): void => setPending((items) => ({ ...items, [variable.name]: next }))
    if (variable.type === 'boolean') return <select aria-label={variable.name} disabled={!variable.dynamic || readOnly} value={value.toUpperCase()} onChange={(event) => onChange(event.target.value)}><option>ON</option><option>OFF</option></select>
    if (variable.type === 'enum' && variable.enumValues) return <select aria-label={variable.name} disabled={!variable.dynamic || readOnly} value={value} onChange={(event) => onChange(event.target.value)}>{variable.enumValues.map((item) => <option key={item}>{item}</option>)}</select>
    return <input aria-label={variable.name} type={variable.type === 'number' ? 'number' : 'text'} disabled={!variable.dynamic || readOnly} value={value} onChange={(event) => onChange(event.target.value)} />
  }

  return <section className="tool-panel sessions-panel">
    <h2>◷ Session Manager / Server Variables</h2>
    {!connection ? <div className="module-toolbar"><label>Connection <select value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">Select connection</option>{records.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.host})</option>)}</select></label><button disabled={!recordId || loading} onClick={() => void connect()}>{loading ? 'Connecting…' : 'Connect'}</button></div> : <div className="module-toolbar"><strong>{connection.name}</strong><span>{connection.environment.toUpperCase()}</span><button onClick={() => tab === 'Sessions' ? void refreshSessions() : tab === 'Server Variables' ? void refreshVariables() : void refreshStatus()} disabled={loading}>Refresh F5</button>{tab === 'Sessions' && <label>Auto-refresh <select value={refreshSeconds} onChange={(event) => setRefreshSeconds(Number(event.target.value))}>{refreshOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds ? `${seconds}s` : 'Off'}</option>)}</select></label>}</div>}
    {connection && <nav className="module-tabs">{(['Sessions', 'Server Variables', 'Status'] as Tab[]).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>}
    {error && <div role="alert" className={stale ? 'module-warning' : 'module-error'}>{error}</div>}{message && <div role="status" className="module-message">{message}</div>}
    {connection && tab === 'Sessions' && <><div className="module-toolbar"><button disabled={readOnly || !selectedIds.length || loading || selectedIds.some((id) => sessions.find((item) => item.id === id)?.current || sessions.find((item) => item.id === id)?.system)} onClick={() => void kill('query')}>Kill Query</button><button disabled={readOnly || !selectedIds.length || loading || selectedIds.some((id) => sessions.find((item) => item.id === id)?.current || sessions.find((item) => item.id === id)?.system)} onClick={() => void kill('session')}>Kill Session</button><label><input type="checkbox" checked={filters.hideSleep} onChange={(event) => setFilters({ ...filters, hideSleep: event.target.checked })} /> Hide Sleep</label><label><input type="checkbox" checked={filters.onlyMine} onChange={(event) => setFilters({ ...filters, onlyMine: event.target.checked })} /> Mine</label><input placeholder="Search..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><span>{updated ? `Updated ${updated}` : ''}</span>{loading && <span aria-label="Loading">⟳</span>}</div><div className={stale ? 'module-table-wrap stale' : 'module-table-wrap'}><table><thead><tr><th></th><th>ID</th><th>User</th><th>Host</th><th>DB</th><th>Command</th><th>Time (s)</th><th>State</th><th>Info</th><th>Rows examined</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id} className={session.timeSeconds > 300 ? 'session-slow-critical' : session.timeSeconds > 60 ? 'session-slow' : ''} onClick={() => void selectSession(session)}><td><input type="checkbox" aria-label={`Select session ${session.id}`} checked={selectedIds.includes(session.id)} disabled={session.current || session.system} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, session.id] : ids.filter((id) => id !== session.id))} /></td><td>{session.id}</td><td>{session.user}{session.current ? ' (you)' : ''}</td><td>{session.host}</td><td>{session.database}</td><td>{session.command}</td><td>{session.timeSeconds}</td><td>{session.state}</td><td title={session.query}>{session.query?.slice(0, 100)}</td><td>{session.rowsExamined ?? '—'}</td></tr>)}</tbody></table>{!sessions.length && !loading && <p>No sessions</p>}</div><div className="module-toolbar"><span>{sessions.length} sessions · {activeSessions} active · {slowSessions} slow</span></div>{details && <div className="session-detail"><h3>Session {details.session.id}</h3><nav className="module-tabs">{(['Query', 'Locks', 'Info'] as const).map((item) => <button key={item} aria-pressed={detailTab === item} onClick={() => setDetailTab(item)}>{item}{item === 'Locks' && !details.locksAvailable ? '*' : ''}</button>)}</nav>{detailTab === 'Query' && <><p><strong>Query</strong></p><pre className="module-sql-preview">{details.session.query || 'No statement is running.'}</pre><button disabled={!details.session.query} onClick={() => void navigator.clipboard.writeText(details.session.query ?? '')}>Copy Query</button></>}{detailTab === 'Locks' && (details.locksAvailable ? <pre>{JSON.stringify(details.locks, null, 2) || 'No locks'}</pre> : <p>Unavailable</p>)}{detailTab === 'Info' && <pre>{JSON.stringify(details.session, null, 2)}</pre>}</div>}</>}
    {connection && (tab === 'Server Variables' || tab === 'Status') && <><div className="module-toolbar"><label>Scope <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="SESSION">Session</option><option value="GLOBAL">Global</option></select></label>{tab === 'Server Variables' && <><input placeholder="Search variables..." value={variableFilter} onChange={(event) => setVariableFilter(event.target.value)} /><label><input type="checkbox" checked={persist} disabled={scope !== 'GLOBAL' || readOnly} onChange={(event) => setPersist(event.target.checked)} /> Persist (SET PERSIST)</label></>}</div>{tab === 'Server Variables' ? <div className="module-table-wrap"><table><thead><tr><th>Name</th><th>Value</th><th>Dynamic</th><th>Scope</th><th>Category</th><th>Apply</th></tr></thead><tbody>{visibleVariables.map((variable) => <tr key={variable.name}><td>{variable.name}{!variable.dynamic && ' 🔒'}</td><td>{variableInput(variable)}</td><td>{variable.dynamic ? '✓' : '✗'}</td><td>{variable.scope}</td><td>{variable.category}</td><td><button disabled={readOnly || !variable.dynamic || pending[variable.name] === undefined || pending[variable.name] === variable.value || loading} onClick={() => void applyVariable(variable)}>Apply</button><button disabled={readOnly || pending[variable.name] === undefined} onClick={() => setPending((items) => { const next = { ...items }; delete next[variable.name]; return next })}>Reset</button></td></tr>)}</tbody></table>{!visibleVariables.length && <p>No variables match the search.</p>}</div> : <div className="module-table-wrap"><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>{Object.entries(status).map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></table></div>}</>}
  </section>
}
