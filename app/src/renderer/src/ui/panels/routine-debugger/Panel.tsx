import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { loader, type OnMount } from '@monaco-editor/react'
import { Range, type editor as MonacoEditor } from 'monaco-editor'
import type { ConnectionRecord, ConnectionSummary, DebugBreakpoint, DebugSnapshot, DebugStepKind, DebugWatch, DatabaseObject } from '../../../../../shared/contracts.js'
import { usePanelConnection } from '../registry'
import { useI18n } from '../../i18n/useI18n.js'

loader.config({ paths: { vs: window.location.protocol === 'file:' ? new URL('../node_modules/monaco-editor/min/vs', window.location.href).toString() : '/node_modules/monaco-editor/min/vs' } })

export default function RoutineDebuggerPanel(): React.JSX.Element {
  const { t } = useI18n()
  const contextualConnection = usePanelConnection()
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [connectionId, setConnectionId] = useState(contextualConnection?.recordId ?? '')
  const [connectedId, setConnectedId] = useState(contextualConnection?.id ?? '')
  const [databases, setDatabases] = useState<string[]>([])
  const [database, setDatabase] = useState(contextualConnection?.database ?? '')
  const [routines, setRoutines] = useState<DatabaseObject[]>([])
  const [routineName, setRoutineName] = useState('')
  const [source, setSource] = useState('')
  const [breakpoints, setBreakpoints] = useState<DebugBreakpoint[]>([])
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null)
  const [watches, setWatches] = useState<string[]>([])
  const [watchDraft, setWatchDraft] = useState('')
  const [args, setArgs] = useState('')
  const [autocommit, setAutocommit] = useState(true)
  const [engine, setEngine] = useState<{ installed: boolean; activeSessions: number; version?: string }>({ installed: false, activeSessions: 0 })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedLine, setSelectedLine] = useState(1)
  const [bottomTab, setBottomTab] = useState<'Watches' | 'Call Stack' | 'Breakpoints' | 'Output'>('Watches')
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const decorationIds = useRef<string[]>([])
  const snapshotRef = useRef<DebugSnapshot | null>(null)
  const target = useMemo(() => ({ connectionId: connectedId, database, name: routineName }), [connectedId, database, routineName])
  const activeSessionCount = Math.max(engine.activeSessions, snapshot && ['running', 'paused'].includes(snapshot.status) ? 1 : 0)

  const loadRoutines = useCallback(async (id: string, db: string): Promise<void> => {
    if (!id || !db) { setRoutines([]); return }
    try {
      const objects = await window.dbforge.listDatabaseObjects(id, db)
      const items = objects.filter((item) => item.kind === 'procedure')
      setSource(''); setBreakpoints([])
      setRoutines(items)
      setRoutineName((current) => items.some((item) => item.name === current) ? current : items[0]?.name ?? '')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to read stored procedures.') }
  }, [])

  useEffect(() => {
    let disposed = false
    void window.dbforge.getConnections().then((items) => {
      if (disposed) return
      setConnections(items)
      setConnectionId((current) => items.some((item) => item.id === current) ? current : contextualConnection?.recordId && items.some((item) => item.id === contextualConnection.recordId) ? contextualConnection.recordId : items[0]?.id ?? '')
    }).catch((error: unknown) => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Unable to load saved connections.') })
    return () => { disposed = true }
  }, [contextualConnection?.recordId])

  useEffect(() => {
    let disposed = false
    let id = ''
    const record = connections.find((item) => item.id === connectionId)
    setConnectedId(''); setDatabases([]); setRoutines([]); setDatabase('')
    if (!record) return
    void window.dbforge.connect(record).then(async (connected: ConnectionSummary) => {
      id = connected.id
      if (disposed) { await window.dbforge.disconnect(id); return }
      setConnectedId(id)
      const items = await window.dbforge.listDatabases(id)
      if (disposed) return
      setDatabases(items)
      const selected = contextualConnection?.database && items.includes(contextualConnection.database) ? contextualConnection.database : record.database && items.includes(record.database) ? record.database : items[0] ?? ''
      setDatabase(selected)
    }).catch((error: unknown) => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Unable to connect to MySQL.') })
    return () => { disposed = true; if (id) void window.dbforge.disconnect(id) }
  }, [connectionId, connections, contextualConnection?.database])

  useEffect(() => { if (connectedId && database) void loadRoutines(connectedId, database) }, [connectedId, database, loadRoutines])
  useEffect(() => {
    if (!connectedId) return
    void window.dbforge.inspectDebugEngine(connectedId).then(setEngine).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to inspect debug engine.'))
  }, [connectedId])
  useEffect(() => {
    const unsubscribe = window.dbforge.onRoutineDebugEvent((event) => {
      snapshotRef.current = event
      setSnapshot((current) => current?.sessionId === event.sessionId ? event : current)
      if (event.status === 'finished' || event.status === 'stopped' || event.status === 'error') setBusy(false)
      if (connectedId) void window.dbforge.inspectDebugEngine(connectedId).then(setEngine).catch(() => undefined)
    })
    return unsubscribe
  }, [connectedId])
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const line = snapshot?.line
    const next = [...breakpoints.filter((item) => !item.error).map((item) => ({ range: new Range(item.line, 1, item.line, 1), options: { isWholeLine: false, glyphMarginClassName: item.enabled ? 'routine-breakpoint' : 'routine-breakpoint-disabled', glyphMarginHoverMessage: { value: item.error ?? 'Toggle breakpoint' } } })), ...(line ? [{ range: new Range(line, 1, line, 1), options: { isWholeLine: true, className: 'routine-current-line', glyphMarginClassName: 'routine-current-line-glyph' } }] : [])]
    decorationIds.current = editor.deltaDecorations(decorationIds.current, next)
  }, [breakpoints, snapshot?.line])

  useEffect(() => {
    let cancelled = false
    setSource(''); setBreakpoints([]); setMessage('')
    if (!routineName || !connectedId || !database) return
    setBusy(true)
    void window.dbforge.compileRoutineForDebug({ connectionId: connectedId, database, name: routineName }).then((preview) => {
      if (!cancelled) { setSource(preview.originalSql); setBreakpoints(preview.statementLines.map((line) => ({ line, enabled: false }))) }
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'This routine cannot be prepared for debugging.') }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [routineName, connectedId, database])

  async function refreshEngine(): Promise<void> {
    if (connectedId) setEngine(await window.dbforge.inspectDebugEngine(connectedId))
  }
  async function deployEngine(): Promise<void> {
    if (!connectedId || !window.confirm(`Create the dbforge_linux_debug schema on this MySQL server? It stores debugger sessions, source backups, breakpoints, and watches. CREATE DATABASE permission is required.`)) return
    setBusy(true); setMessage('Preparing debugger support schema…')
    try { await window.dbforge.deployDebugEngine(connectedId, true); await refreshEngine(); setMessage('Debugger support is ready.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not deploy debugger support.') }
    finally { setBusy(false) }
  }
  async function removeEngine(): Promise<void> {
    if (!connectedId || !window.confirm('Remove dbforge_linux_debug and its saved routine backups from this MySQL server?')) return
    setBusy(true)
    try { await window.dbforge.removeDebugEngine(connectedId, true); await refreshEngine(); setMessage('Debugger support was removed.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not remove debugger support.') }
    finally { setBusy(false) }
  }
  function toggleBreakpoint(line: number): void {
    setBreakpoints((current) => {
      const next = current.map((item) => item.line === line ? { ...item, enabled: !item.enabled } : item)
      const activeSnapshot = snapshotRef.current
      if (activeSnapshot) void window.dbforge.setRoutineDebugBreakpoints(activeSnapshot.sessionId, next).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not update breakpoints.'))
      return next
    })
  }
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.onDidChangeCursorPosition((event) => setSelectedLine(event.position.lineNumber))
    editor.onMouseDown((event) => {
      if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN && event.target.position) toggleBreakpoint(event.target.position.lineNumber)
    })
  }
  async function start(confirm = true): Promise<void> {
    if (!target.connectionId || !target.database || !target.name) { setMessage('Select a connection, database, and stored procedure.'); return }
    if (!engine.installed) { setMessage('Deploy debugger support before starting a routine session.'); return }
    if (confirm && !window.confirm(`Starting the debugger will temporarily replace ${target.name} with an instrumented copy and restore its original definition when the session ends. Continue with autocommit ${autocommit ? 'on' : 'off'}?`)) return
    setBusy(true); setMessage('Starting routine session…')
    try {
      const result = await window.dbforge.startRoutineDebug(target, args.trim() ? args.split(',').map((item) => item.trim()) : [], breakpoints, autocommit, true)
      if (watches.length) await window.dbforge.setRoutineDebugWatches(result.sessionId, watches)
    const started = await window.dbforge.getRoutineDebugSnapshot(result.sessionId)
    snapshotRef.current = started; setSnapshot(started); setMessage('Routine session started; paused on its first executable statement.')
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : 'Unable to start the routine debugger.') }
  }
  async function command(action: DebugStepKind | 'stop'): Promise<void> {
    if (!snapshot) return
    if (action === 'stop' && !window.confirm('Stop the active routine debug session? Its original definition will be restored.')) return
    try { await window.dbforge.commandRoutineDebug(snapshot.sessionId, action, selectedLine); if (action === 'stop') setMessage('Stopping the routine session…') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Debugger command failed.') }
  }
  async function restart(): Promise<void> {
    if (!snapshot || !window.confirm('Restart this routine from its first statement? The current session will stop and its server definition will be restored first.')) return
    setBusy(true)
    try {
      await window.dbforge.commandRoutineDebug(snapshot.sessionId, 'stop')
      for (let index = 0; index < 100; index++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const current = await window.dbforge.getRoutineDebugSnapshot(snapshot.sessionId).catch(() => null)
        if (!current || ['finished', 'stopped', 'error'].includes(current.status)) break
      }
      snapshotRef.current = null; setSnapshot(null); setBusy(false)
      await start(false)
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : 'Could not restart the routine session.') }
  }
  useEffect(() => {
    const onShortcut = (event: Event): void => {
      const name = (event as CustomEvent<{ command?: string }>).detail?.command
      if (name?.startsWith('Run Debugging')) void start()
      else if (name?.startsWith('Run To Cursor')) void command('run-to-cursor')
      else if (name === 'Restart Debugging') void restart()
    }
    window.addEventListener('dbforge:shortcut-command', onShortcut)
    return () => window.removeEventListener('dbforge:shortcut-command', onShortcut)
  })
  async function addWatch(): Promise<void> {
    const name = watchDraft.trim()
    if (!/^[A-Za-z_$][\w$]{0,126}$/.test(name)) { setMessage('Watch a local variable by its simple name (up to 127 characters).'); return }
    const next = [...new Set([...watches, name])]; setWatches(next); setWatchDraft('')
    if (snapshot) await window.dbforge.setRoutineDebugWatches(snapshot.sessionId, next)
  }

  return <section className="routine-debugger">
    <header className="rd-header"><div><h2>{t('debugger.title')}</h2><p>{t('debugger.description')}</p></div><div className="rd-engine">{engine.installed ? <span>{engine.version ? `Engine v${engine.version}` : 'Engine installed'} · {activeSessionCount} {t('panel.routine.debugger.mde704a58d4')}</span> : <span>{t('panel.routine.debugger.maa0545b173')}</span>}{engine.installed ? <button onClick={() => void removeEngine()} disabled={busy || activeSessionCount > 0}>{t('debug.engine.remove')}</button> : <button onClick={() => void deployEngine()} disabled={busy}>{t('debug.engine.deploy')}</button>}</div></header>
    <div className="rd-target"><label>{t('panel.routine.debugger.m81f9da6350')}<select disabled={busy} value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">{t('panel.routine.debugger.mc39b1ef90b')}</option>{connections.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>{t('panel.routine.debugger.m289b0286f2')}<select disabled={busy} value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">{t('panel.routine.debugger.m3af1a4e785')}</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label><label>{t('panel.routine.debugger.m9211138130')}<select disabled={busy} value={routineName} onChange={(event) => { snapshotRef.current = null; setSnapshot(null); setRoutineName(event.target.value) }}><option value="">{t('panel.routine.debugger.m3175e250f3')}</option>{routines.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label><label>{t('panel.routine.debugger.mfaeb17a629')}<input disabled={busy} value={args} onChange={(event) => setArgs(event.target.value)} placeholder={t('panel.routine.debugger.m355797a8da')} /></label><label className="rd-check"><input disabled={busy} type="checkbox" checked={autocommit} onChange={(event) => setAutocommit(event.target.checked)} />{t('panel.routine.debugger.m39fa0a0475')}</label><button onClick={() => void start()} disabled={busy || Boolean(snapshot && ['running', 'paused'].includes(snapshot.status))}>{t('debug.start')}</button></div>
    <nav className="rd-toolbar" aria-label={t('panel.routine.debugger.md4e2b2ead5')}><button onClick={() => void command('continue')} disabled={snapshot?.status !== 'paused'}>{t('debug.start')} {t('panel.routine.debugger.m05e69aef47')}</button><button onClick={() => void command('into')} disabled={snapshot?.status !== 'paused'}>{t('debug.stepInto')} {t('panel.routine.debugger.mf6fdabfc77')}</button><button onClick={() => void command('over')} disabled={snapshot?.status !== 'paused'}>{t('debug.stepOver')} {t('panel.routine.debugger.m2d2c66604f')}</button><button onClick={() => void command('out')} disabled={snapshot?.status !== 'paused'}>{t('debug.stepOut')} {t('panel.routine.debugger.mae1126029d')}</button><button onClick={() => void command('run-to-cursor')} disabled={snapshot?.status !== 'paused'}>{t('debug.runToCursor')}</button><button onClick={() => void command('stop')} disabled={!snapshot || !['running', 'paused'].includes(snapshot.status)}>{t('debug.stop')}</button><button onClick={() => void restart()} disabled={!snapshot || !['running', 'paused'].includes(snapshot.status)}>{t('debug.restart')}</button><span>{snapshot ? `${snapshot.status}${snapshot.line ? ` · line ${snapshot.line}` : ''}` : 'Ready'}</span></nav>
    <div className="rd-workspace"><div className="rd-editor"><Editor height="100%" language="sql" theme={document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'} value={source} onMount={onMount} loading={<EditorStartup source={source} breakpoints={breakpoints} currentLine={snapshot?.line} onToggle={toggleBreakpoint} />} options={{ readOnly: true, minimap: { enabled: false }, glyphMargin: true, lineNumbers: 'on', automaticLayout: true, fontSize: 13 }} /></div><aside className="rd-side"><header>{t('panel.routine.debugger.m9e0df56dc0')} <span>{t('panel.routine.debugger.m1040483def')} {snapshot?.line ?? '—'}</span></header><table><thead><tr><th>{t('panel.routine.debugger.m1387baad07')}</th><th>{t('panel.routine.debugger.m5f920ff35a')}</th></tr></thead><tbody>{Object.entries(snapshot?.variables ?? {}).map(([name, value]) => <tr key={name}><td>{name}</td><td>{formatValue(value)}</td></tr>)}</tbody></table>{!Object.keys(snapshot?.variables ?? {}).length && <p>{t('panel.routine.debugger.md5ec223731')}</p>}</aside></div>
    <nav className="rd-tabs" aria-label={t('panel.routine.debugger.m56430d3ca5')}>{(['Watches', 'Call Stack', 'Breakpoints', 'Output'] as const).map((tab) => <button className={bottomTab === tab ? 'active' : ''} key={tab} onClick={() => setBottomTab(tab)}>{tab === 'Watches' ? t('debug.panel.watches') : tab === 'Call Stack' ? t('debug.panel.callStack') : tab === 'Breakpoints' ? t('debug.panel.breakpoints') : tab}</button>)}</nav>
    <div className="rd-bottom">{bottomTab === 'Watches' && <><div className="rd-watch-add"><input value={watchDraft} onChange={(event) => setWatchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addWatch() }} placeholder={t('panel.routine.debugger.ma00f318c7c')} aria-label={t('panel.routine.debugger.m3509bf0ebc')} /><button onClick={() => void addWatch()}>{t('panel.routine.debugger.m4f23d61e37')}</button></div><table><thead><tr><th>{t('panel.routine.debugger.m1387baad07')}</th><th>{t('panel.routine.debugger.m5f920ff35a')}</th><th>{t('panel.routine.debugger.mc62d3aa8ae')}</th><th /></tr></thead><tbody>{(snapshot?.watches ?? watches.map((name): DebugWatch => ({ name }))).map((watch) => <tr key={watch.name}><td>{watch.name}</td><td>{formatValue(watch.value)}</td><td>{watch.error ?? watch.type ?? 'waiting'}</td><td><button onClick={() => { const next = watches.filter((item) => item !== watch.name); setWatches(next); if (snapshot) void window.dbforge.setRoutineDebugWatches(snapshot.sessionId, next) }}>{t('panel.routine.debugger.ma8bd946e5e')}</button></td></tr>)}</tbody></table></>}{bottomTab === 'Call Stack' && <table><thead><tr><th>{t('panel.routine.debugger.m454317c7b1')}</th><th>{t('panel.routine.debugger.m274ea15999')}</th><th>{t('panel.routine.debugger.m95b84959a0')}</th></tr></thead><tbody>{(snapshot?.callStack ?? []).map((frame, index) => <tr key={`${frame.routine}-${index}`} onClick={() => { setSelectedLine(frame.line); editorRef.current?.revealLineInCenter(frame.line) }}><td>{frame.routine}</td><td>{frame.line}</td><td>{frame.depth}</td></tr>)}</tbody></table>}{bottomTab === 'Breakpoints' && <table><thead><tr><th>{t('panel.routine.debugger.m00a2a20c62')}</th><th>{t('panel.routine.debugger.m1078895354')}</th><th>{t('panel.routine.debugger.m099dc93d3d')}</th></tr></thead><tbody>{breakpoints.map((point) => <tr key={point.line}><td>{point.enabled ? '● Enabled' : '○ Disabled'}</td><td>{routineName}:{point.line}</td><td>{point.error ?? ''}</td></tr>)}</tbody></table>}{bottomTab === 'Output' && <div className="rd-output">{snapshot?.output.map((item, index) => <p key={index}>{item}</p>)}{message && <p>{message}</p>}</div>}</div>
    {message && <p className="rd-message" role="status">{message}</p>}
    <p className="rd-limit">{t('panel.routine.debugger.m74f964eda9')}</p>
    <style>{`.routine-debugger{height:100%;min-height:520px;display:flex;flex-direction:column;gap:8px;color:var(--text)}.rd-header,.rd-header>div,.rd-engine,.rd-target,.rd-toolbar,.rd-tabs,.rd-watch-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rd-header{justify-content:space-between}.rd-header h2{margin:0}.rd-header p{margin:3px 0;color:var(--text-secondary)}.rd-engine{font-size:12px;color:var(--text-secondary)}.rd-target{padding:8px;border:1px solid var(--border);border-radius:5px;background:var(--bg-surface-alt)}.rd-target label{display:flex;flex-direction:column;gap:4px;min-width:150px}.rd-target select,.rd-target input,.rd-watch-add input{background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:6px}.rd-target .rd-check{display:flex;flex-direction:row;align-items:center;min-width:auto}.rd-toolbar{padding:5px;border-bottom:1px solid var(--border)}.rd-toolbar span{margin-left:auto;color:var(--accent)}.rd-workspace{display:grid;grid-template-columns:minmax(320px,2fr) minmax(220px,1fr);gap:8px;min-height:260px;flex:1}.rd-editor,.rd-side,.rd-bottom{border:1px solid var(--border);border-radius:5px;overflow:auto;background:var(--bg-surface)}.rd-source-fallback{height:100%;min-height:260px;margin:0;padding:8px 0;background:var(--bg-surface);color:var(--text);font:13px/20px monospace;overflow:auto}.rd-source-line{display:grid;grid-template-columns:26px 42px 1fr;min-height:20px}.rd-source-line.current{background:color-mix(in srgb,var(--accent) 18%,transparent)}.rd-source-gutter{border:0;background:transparent;color:#d83232;padding:0;cursor:pointer}.rd-source-number{text-align:right;padding-right:10px;color:var(--text-secondary);user-select:none}.rd-source-code{white-space:pre}.rd-side header{position:sticky;top:0;padding:8px;font-weight:600;background:var(--bg-surface-alt);display:flex;justify-content:space-between}.rd-side header span{font-size:12px;color:var(--text-secondary)}.rd-side p{padding:8px;color:var(--text-secondary)}.rd-side table,.rd-bottom table{width:100%;border-collapse:collapse}.rd-side td,.rd-bottom td,.rd-side th,.rd-bottom th{padding:6px;border-bottom:1px solid var(--border);text-align:left}.rd-side td,.rd-bottom td{font-family:monospace}.rd-tabs{border-bottom:1px solid var(--border)}.rd-tabs button.active{color:var(--accent);border-bottom:2px solid var(--accent)}.rd-bottom{height:150px;min-height:100px;padding:6px;overflow:auto}.rd-watch-add{margin:0 0 6px}.rd-watch-add input{min-width:220px}.rd-output p{margin:4px;font-family:monospace}.rd-message{margin:0;color:var(--accent)}.rd-limit{font-size:11px;color:var(--text-secondary);margin:0}.routine-breakpoint{background:#d83232;border-radius:50%;width:9px!important;height:9px!important;margin-left:5px}.routine-breakpoint-disabled{border:2px solid #d83232;border-radius:50%;width:8px!important;height:8px!important;margin-left:5px}.routine-current-line{background:color-mix(in srgb,var(--accent) 18%,transparent)}.routine-current-line-glyph{background:var(--accent);clip-path:polygon(0 0,100% 50%,0 100%);width:9px!important;margin-left:3px}@media(max-width:900px){.rd-workspace{grid-template-columns:1fr}.rd-side{min-height:120px}}`}</style>
  </section>
}

function formatValue(value: unknown): string { if (value === undefined) return '—'; if (typeof value === 'string') return value; try { return JSON.stringify(value) } catch { return String(value) } }

function EditorStartup({ source, breakpoints, currentLine, onToggle }: { source: string; breakpoints: DebugBreakpoint[]; currentLine?: number; onToggle: (line: number) => void }): React.JSX.Element {
  const { t } = useI18n()
  return <div className="rd-source-fallback" aria-label={t('panel.routine.debugger.mcecd16516d')}>{source.split('\n').map((text, index) => { const line = index + 1; const point = breakpoints.find((item) => item.line === line); return <div className={`rd-source-line${currentLine === line ? ' current' : ''}`} key={line}><button className="rd-source-gutter" title={t('panel.routine.debugger.md8ce2c69fb')} aria-label={`Toggle breakpoint on line ${line}`} onClick={() => onToggle(line)}>{point?.enabled ? '●' : point ? '○' : ''}</button><span className="rd-source-number">{line}</span><code className="rd-source-code">{text || ' '}</code></div> })}</div>
}
