import { useI18n } from '../../i18n/useI18n.js'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Editor from '../../components/MonacoEditor.js'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import type { SchemaCompareResult } from '../../../../../shared/contracts/schema-compare.js'
import type { SchemaDifference } from '../../../../../modules/schema/model.js'
import { useKeyboardDialog } from '../../components/useKeyboardDialog.js'
import { createTable } from '../../../../../modules/schema/ddl.js'
import './Panel.css'
import { usePanelConnection } from '../registry'

type Filter = 'all' | 'different' | 'added' | 'removed'
type SetupStep = 'source' | 'options' | 'results'
type SyncStep = 'output' | 'options' | 'scripts' | 'summary'
type OutputMode = 'editor' | 'file' | 'execute'
const keyOf = (item: SchemaDifference): string => `${item.kind}:${item.object}:${item.change}`
const splitSql = (script: string): string[] => script.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean).map((part) => `${part};`)

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [source, setSource] = useState(''); const [target, setTarget] = useState('')
  const [sourceDb, setSourceDb] = useState(''); const [targetDb, setTargetDb] = useState('')
  const [offlineSource, setOfflineSource] = useState<import('../../../../../modules/schema/model.js').DatabaseModel | null>(null); const [offlineTarget, setOfflineTarget] = useState<import('../../../../../modules/schema/model.js').DatabaseModel | null>(null)
  const [includeDrops, setIncludeDrops] = useState(true); const [result, setResult] = useState<SchemaCompareResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [active, setActive] = useState<SchemaDifference | null>(null)
  const [filter, setFilter] = useState<Filter>('all'); const [search, setSearch] = useState(''); const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Selecione origem e destino e clique Compare.'); const [confirmOpen, setConfirmOpen] = useState(false); const [riskAccepted, setRiskAccepted] = useState(false)
  const syncDialogRef = useKeyboardDialog(confirmOpen, () => setConfirmOpen(false))
  const [scriptPreview, setScriptPreview] = useState(false)
  const [setupStep, setSetupStep] = useState<SetupStep>('source')
  const [sourceType, setSourceType] = useState('Database'); const [targetType, setTargetType] = useState('Database')
  const [sourceVersion, setSourceVersion] = useState('—'); const [targetVersion, setTargetVersion] = useState('—')
  const [optionSearch, setOptionSearch] = useState(''); const [syncStep, setSyncStep] = useState<SyncStep>('output')
  const [outputMode, setOutputMode] = useState<OutputMode>('editor'); const [directAccepted, setDirectAccepted] = useState(false)
  const [syncOptions, setSyncOptions] = useState({ checkExists: false, includeUse: true, dropCreateTables: false, dropCreateObjects: false, excludeComments: false, transaction: true })
  const [beforeScript, setBeforeScript] = useState(''); const [afterScript, setAfterScript] = useState('')
  const compareOptions = [['disableDependencies','Disable dependency analysis'],['ignoreAutoIncrementClause','Ignore AUTO_INCREMENT clause'],['ignoreAutoIncrementTable','Ignore AUTO_INCREMENT table option'],['ignoreAverageRowLength','Ignore average row length'],['ignoreCollations','Ignore collations'],['ignoreColumnTypes','Ignore column data types'],['ignoreDefaults','Ignore column default values'],['ignoreDefiner','Ignore DEFINER clause'],['ignoreEnds','Ignore ENDS clause'],['ignorePermissions','Ignore permissions'],['ignoreSqlSecurity','Ignore SQL SECURITY clause'],['ignoreStarts','Ignore STARTS clause'],['ignoreEngine','Ignore table engine'],['autoMapping','Auto Mapping']] as const
  const [enabledOptions, setEnabledOptions] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('schemaCompare.options') ?? '["Ignore AUTO_INCREMENT table option","Ignore average row length","Ignore DEFINER clause","Ignore SQL SECURITY clause"]') as string[] } catch { return [] } })
  const filteredOptions = compareOptions.filter(([key]) => t(`panel.schema.compare.xOpt${key}`).toLowerCase().includes(optionSearch.toLowerCase()))
  const types = ['Database', 'Project', 'Scripts Folder', 'Snapshot', 'Source Control']
  const sourceReady = sourceType === 'Database' ? Boolean(source && sourceDb.trim()) : Boolean(offlineSource)
  const targetReady = targetType === 'Database' ? Boolean(target && targetDb.trim()) : Boolean(offlineTarget)
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
  const fullSyncScript = useMemo(() => {
    let script = [beforeScript.trim(), selectedScript, afterScript.trim()].filter(Boolean).join('\n\n')
    if (syncOptions.dropCreateTables && result) {
      script = splitSql(script).flatMap((statement) => {
        const match = /^ALTER TABLE\s+(?:`[^`]+`\.)?`([^`]+)`/i.exec(statement)
        if (!match) return [statement]
        const table = result.target.tables.find((item) => item.name === match[1])
        return table ? ['DROP TABLE IF EXISTS `' + targetDb.replaceAll('`','``') + '`.`' + table.name.replaceAll('`','``') + '`;', createTable(table,targetDb)] : [statement]
      }).join('\n\n')
    }
    if (syncOptions.checkExists) script = script.replace(/\bCREATE TABLE (?!IF NOT EXISTS)/gi,'CREATE TABLE IF NOT EXISTS ').replace(/\bDROP TABLE (?!IF EXISTS)/gi,'DROP TABLE IF EXISTS ')
    if (syncOptions.excludeComments) script = script.replace(/^\s*--.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'').trim()
    if (syncOptions.includeUse) script = 'USE `' + targetDb.replaceAll('`','``') + '`;\n\n' + script
    return `${syncOptions.transaction ? 'START TRANSACTION;\n\n' : ''}${script}${syncOptions.transaction ? '\n\nCOMMIT;' : ''}`
  }, [beforeScript, selectedScript, afterScript, syncOptions, result, targetDb])
  const destructive = useMemo(() => /\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(selectedScript), [selectedScript])
  const visible = useMemo(() => result?.differences.filter((item) => {
    const stateMatch = filter === 'all' || (filter === 'different' ? item.change === 'changed' : filter === 'added' ? item.change === 'added' : item.change === 'removed')
    return stateMatch && item.object.toLowerCase().includes(search.toLowerCase())
  }) ?? [], [result, filter, search])

  useEffect(() => { void window.dbforge.getConnections().then((items) => { const selected = items.find((item) => item.id === activeConnection?.recordId || item.name === activeConnection?.name)?.id ?? items[0]?.id ?? ''; setRecords(items); setSource(selected); setTarget(selected) }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar conexões.')) }, [activeConnection?.name, activeConnection?.recordId])
  useEffect(() => { const handler = (event: Event) => { const action = (event as CustomEvent<string>).detail; if (action === 'edit') setSetupStep('source'); else if (action === 'filter') { setSearch(''); setSetupStep('results') } else if (action === 'refresh') void runCompare(); else if (action === 'script') setScriptPreview(true); else if (action === 'report') exportReport(); else if (action === 'sync') { setSyncStep('output'); setConfirmOpen(true) } }; window.addEventListener('schema-compare:action', handler); return () => window.removeEventListener('schema-compare:action', handler) })
  function invalidate(): void { if (result) { setResult(null); setMessage('Resultados desatualizados — Compare novamente.') } }
  async function loadOffline(side: 'source' | 'target', kind: string): Promise<void> {
    invalidate()
    if (kind === 'Database') { if (side === 'source') setOfflineSource(null); else setOfflineTarget(null); return }
    if (kind === 'Project' || kind === 'Source Control') { setMessage(t('panel.schema.compare.xOfflineDisabled')); return }
    if (kind !== 'Scripts Folder' && kind !== 'Snapshot') return
    try { const schema = await window.dbforge.loadOfflineSchema(kind); if (schema) { if (side === 'source') setOfflineSource(schema); else setOfflineTarget(schema); setMessage(`${kind}: ${schema.name} (${schema.tables.length} tables)`) } }
    catch (error) { setMessage(error instanceof Error ? error.message : t('panel.schema.compare.xOfflineLoadError')) }
  }
  async function saveSnapshot(side: 'source' | 'target'): Promise<void> {
    const connectionId = side === 'source' ? source : target; const database = side === 'source' ? sourceDb : targetDb
    if (!connectionId || !database) return
    const record = records.find((item) => item.id === connectionId)
    if (!record) { setMessage(t('panel.schema.compare.xOfflineLoadError')); return }
    let activeId = ''
    try { const connected = await window.dbforge.connect(record); activeId = connected.id; await window.dbforge.saveSchemaSnapshot(connected.id, database); setMessage(t('panel.schema.compare.xSnapshotSaved')) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('panel.schema.compare.xOfflineLoadError')) }
    finally { if (activeId) void window.dbforge.disconnect(activeId) }
  }
  const label = (id: string): string => records.find((record) => record.id === id)?.name ?? id
  function markDefaults(next: SchemaCompareResult): void { setSelected(new Set(next.differences.filter((item) => includeDrops || item.change !== 'removed').map(keyOf))) }
  async function runCompare(): Promise<void> {
    setBusy(true); setMessage('Lendo origem…'); setResult(null); setActive(null)
    let sourceConnection = ''; let targetConnection = ''
    try {
      const inspectSide = async (kind: string, id: string, database: string, offline: typeof offlineSource): Promise<import('../../../../../modules/schema/model.js').DatabaseModel> => {
        if (kind !== 'Database') { if (!offline) throw new Error('Load the selected Scripts Folder or Snapshot first.'); return offline }
        const record = records.find((item) => item.id === id)
        if (!record || !database.trim()) throw new Error('Select a database for each Database source.')
        const connection = await window.dbforge.connect(record); if (id === source && kind === sourceType) sourceConnection = connection.id; if (id === target && kind === targetType) targetConnection = connection.id
        const version = await window.dbforge.testConnection(record).catch(() => null)
        if (id === source && version) setSourceVersion(version.serverVersion); if (id === target && version) setTargetVersion(version.serverVersion)
        return window.dbforge.inspectSchema(connection.id, database)
      }
      setMessage('Reading schema sources…')
      const [sourceModel, targetModel] = await Promise.all([inspectSide(sourceType, source, sourceDb, offlineSource), inspectSide(targetType, target, targetDb, offlineTarget)])
      const next = await window.dbforge.compareSchemaModels(sourceModel, targetModel, includeDrops)
      setResult(next); markDefaults(next); setMessage(next.differences.length ? `${next.differences.length} diferenças: ${next.differences.filter((d) => d.change === 'added').length} novos, ${next.differences.filter((d) => d.change === 'changed').length} alterados, ${next.differences.filter((d) => d.change === 'removed').length} removidos` : 'Os esquemas são idênticos.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comparison failed.') }
    finally { if (sourceConnection) void window.dbforge.disconnect(sourceConnection); if (targetConnection && targetConnection !== sourceConnection) void window.dbforge.disconnect(targetConnection); setBusy(false) }
  }
  async function synchronize(): Promise<void> {
    if (!selectedScript.trim()) { setMessage(t('cmp.err.noneSelected')); return }
    if (targetType !== 'Database') { setMessage(t('panel.schema.compare.xSyncRequiresDatabaseTarget')); return }
    if (outputMode !== 'execute') { setMessage(t('panel.schema.compare.mbf378c8dfb')); if (outputMode === 'file') { const blob = new Blob([fullSyncScript], { type: 'text/sql;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'schema-sync.sql'; anchor.click(); URL.revokeObjectURL(url) } else await queueScript(); setConfirmOpen(false); return }
    if (destructive && !riskAccepted) return
    if (!directAccepted) return
    setBusy(true); setMessage('Sincronizando…')
    try {
      const record = records.find((item) => item.id === target); if (!record) throw new Error('Escolha uma conexão de destino.')
      const connected = await window.dbforge.connect(record)
      let summary: Awaited<ReturnType<typeof window.dbforge.synchronizeSchema>>
      try { summary = await window.dbforge.synchronizeSchema(connected.id, targetDb, fullSyncScript, destructive && riskAccepted) }
      finally { await window.dbforge.disconnect(connected.id) }
      await runCompare()
      setMessage(`Synchronization complete: ${summary.succeeded} succeeded, ${summary.failed} failed${summary.errors.length ? ` — ${summary.errors.join('; ')}` : ''}. Comparison refreshed.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na sincronização.') }
    finally { setBusy(false); setConfirmOpen(false); setRiskAccepted(false) }
  }
  function exportScript(): void { const blob = new Blob([selectedScript], { type: 'text/sql;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'schema-sync.sql'; anchor.click(); URL.revokeObjectURL(url) }
  function exportReport(): void { const rows = (result?.differences ?? []).map((item) => [item.kind,item.object,item.change,item.detail].map((value)=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n'); const blob = new Blob([`Type,Object,Status,Details\n${rows}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'schema-comparison-report.csv'; anchor.click(); URL.revokeObjectURL(url); setMessage(t('panel.schema.compare.xReportGenerated')) }
  async function queueScript(): Promise<void> { try { await window.dbforge.queueSchemaUpdate({ connectionId: target, database: targetDb, source: `Schema Compare · ${sourceDb} → ${targetDb}`, script: selectedScript }); setMessage(t('extras.schema.added')); setScriptPreview(false) } catch (error) { setMessage(error instanceof Error ? error.message : t('extras.schema.queueFailed')) } }
  const selectedDdl = (side: 'source' | 'target'): string => {
    if (!result || !active) return ''
    const model = side === 'source' ? result.source : result.target
    const table = model.tables.find((item) => item.name === active.object.split('.')[0])
    if (table) return createTable(table, model.name)
    const object = [...model.views, ...model.procedures, ...model.functions, ...model.triggers, ...model.events].find((item) => item.name === active.object)
    return object?.createSql ?? ('definition' in (object ?? {}) ? String(object?.definition ?? '') : '')
  }

  return <section className="tool-panel compare-panel">
    <h2>{t('panel.schema.compare.ma1f3ed9896')}</h2><p>{t('panel.schema.compare.m993c3eb284')}</p>
    <nav className="schema-wizard-steps" aria-label={t('panel.schema.compare.xWizard')}><button className={setupStep==='source'?'active':''} onClick={()=>setSetupStep('source')}>1 · {t('panel.schema.compare.xSourceTarget')}</button><button className={setupStep==='options'?'active':''} disabled={!sourceReady||!targetReady} onClick={()=>setSetupStep('options')}>2 · {t('panel.schema.compare.xOptions')}</button>{result&&<button className={setupStep==='results'?'active':''} onClick={()=>setSetupStep('results')}>3 · {t('panel.schema.compare.xResults')}</button>}</nav>
    {setupStep !== 'results' && <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {(['source', 'target'] as const).map((side) => { const kind = side === 'source' ? sourceType : targetType; const chosenId = side === 'source' ? source : target; const chosenDb = side === 'source' ? sourceDb : targetDb; const dbLabel = t(side === 'source' ? 'panel.schema.compare.maea04e3dbe' : 'panel.schema.compare.m458449fd1e'); const connectionLabel = t(side === 'source' ? 'panel.schema.compare.mfec02ec40d' : 'panel.schema.compare.me19ccb775a'); const name = side === 'source' ? t('panel.schema.compare.xSource') : t('panel.schema.compare.xTarget'); const options: Record<string,string> = { Database: 'panel.schema.compare.xTypeDatabase', Project: 'panel.schema.compare.xTypeProject', 'Scripts Folder': 'panel.schema.compare.xTypeScriptsFolder', Snapshot: 'panel.schema.compare.xTypeSnapshot', 'Source Control': 'panel.schema.compare.xTypeSourceControl' }; return <fieldset key={side} style={side === 'target' ? { borderColor: 'var(--error)' } : undefined}><legend>{name}</legend><div className="compare-form"><label>{t('panel.schema.compare.xType')}<select value={kind} onChange={(event) => { const next = event.target.value; invalidate(); if (side === 'source') { setSourceType(next); setOfflineSource(null) } else { setTargetType(next); setOfflineTarget(null) } if (next === 'Project' || next === 'Source Control') setMessage(t('panel.schema.compare.xOfflineDisabled')) }}>{types.map((type) => <option key={type} value={type} disabled={type === 'Project' || type === 'Source Control'} title={type === 'Project' || type === 'Source Control' ? t('panel.schema.compare.xOfflineDisabled') : undefined}>{t(options[type]!)}</option>)}</select></label>{kind === 'Database' ? <><label>{connectionLabel}<select value={chosenId} onChange={(event) => { invalidate(); if (side === 'source') setSource(event.target.value); else setTarget(event.target.value) }}>{records.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{dbLabel}<input value={chosenDb} onChange={(event) => { invalidate(); if (side === 'source') setSourceDb(event.target.value); else setTargetDb(event.target.value) }} /></label><small>{t('panel.schema.compare.xServerVersion')}: {side === 'source' ? sourceVersion : targetVersion}</small><button type="button" onClick={() => void saveSnapshot(side)}>{t('panel.schema.compare.xCreateSnapshot')}</button></> : <><button type="button" onClick={() => void loadOffline(side, kind)}>{kind === 'Snapshot' ? t('panel.schema.compare.xOpenSnapshot') : t('panel.schema.compare.xSelectScriptsFolder')}</button><small>{(side === 'source' ? offlineSource : offlineTarget)?.name ?? t('panel.schema.compare.xOfflineNotLoaded')}</small></>}</div></fieldset> })}
    </div>
    <div className="schema-wizard-actions"><button onClick={()=>{setSource(target);setTarget(source);setSourceDb(targetDb);setTargetDb(sourceDb);setResult(null)}}>{t('panel.schema.compare.xSwap')}</button><button onClick={()=>{setTarget(source);setTargetDb(sourceDb)}}>{t('panel.schema.compare.xCopyRight')}</button><button onClick={()=>{setSource(target);setSourceDb(targetDb)}}>{t('panel.schema.compare.xCopyLeft')}</button></div>
    <small>{t('panel.schema.compare.xOfflineDisabled')}</small>
    {setupStep==='source'&&<div className="schema-wizard-actions"><button disabled={!sourceReady||!targetReady} onClick={()=>setSetupStep('options')}>{t('panel.schema.compare.xNext')}</button><button onClick={()=>setSetupStep('results')}>{t('common.cancel')}</button></div>}
    {setupStep==='options'&&<fieldset><legend>{t('panel.schema.compare.xComparisonOptions')}</legend><input aria-label={t('panel.schema.compare.xSearchOptions')} placeholder={t('panel.schema.compare.xSearchOptions')} value={optionSearch} onChange={(e)=>setOptionSearch(e.target.value)} /><small>{t('panel.schema.compare.xSaveCli')}</small><div className="schema-option-list">{filteredOptions.map(([key, englishLabel])=><label key={key}><input type="checkbox" checked={enabledOptions.includes(englishLabel)} onChange={()=>setEnabledOptions((old)=>old.includes(englishLabel)?old.filter((x)=>x!==englishLabel):[...old,englishLabel])}/>{t(`panel.schema.compare.xOpt${key}`)}</label>)}</div><div className="schema-wizard-actions"><button onClick={()=>{localStorage.setItem('schemaCompare.options',JSON.stringify(enabledOptions));setMessage(t('panel.schema.compare.xDefaultsSaved'))}}>{t('panel.schema.compare.xSaveDefaults')}</button><button onClick={()=>{const defaults=['Ignore AUTO_INCREMENT table option','Ignore average row length','Ignore DEFINER clause','Ignore SQL SECURITY clause'];setEnabledOptions(defaults);localStorage.setItem('schemaCompare.options',JSON.stringify(defaults))}}>{t('panel.schema.compare.xVendorDefaults')}</button><button onClick={()=>{try{setEnabledOptions(JSON.parse(localStorage.getItem('schemaCompare.options')??'[]') as string[])}catch{setEnabledOptions([])}}}>{t('panel.schema.compare.xMyDefaults')}</button></div></fieldset>}
    <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={includeDrops} onChange={(event) => { setIncludeDrops(event.target.checked); setMessage('Resultados desatualizados — Compare novamente.'); setResult(null) }} /> {t('panel.schema.compare.mbdef239a4f')}</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{setupStep==='options'&&<button onClick={()=>setSetupStep('source')}>{t('panel.schema.compare.xBack')}</button>}<button onClick={() => { void runCompare(); setSetupStep('results') }} disabled={busy || !sourceReady || !targetReady}>{t('panel.schema.compare.m2e9c05f6f3')}</button></div>
    </>}
    {setupStep==='results'&&<div className="schema-wizard-actions"><button onClick={()=>setSetupStep('source')}>{t('panel.schema.compare.xEditComparison')}</button><button onClick={()=>void runCompare()} disabled={busy}>{t('common.refresh')}</button><button onClick={()=>{setScriptPreview(true);setConfirmOpen(false)}} disabled={!selectedScript}>{t('panel.schema.compare.xViewScript')}</button><button onClick={exportReport} disabled={!result}>{t('panel.schema.compare.xReport')}</button><button onClick={()=>{setSyncStep('output');setOutputMode('editor');setDirectAccepted(false);setConfirmOpen(true)}} disabled={busy||!selectedScript||targetType!=='Database'} title={targetType!=='Database'?t('panel.schema.compare.xSyncRequiresDatabaseTarget'):undefined}>{t('panel.schema.compare.m1f50d08f65')}</button></div>}
    {result && setupStep==='results' && <><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}><label>{t('panel.schema.compare.xGroupBy')} <select defaultValue="status"><option value="status">{t('panel.schema.compare.xStatus')}</option><option value="type">{t('panel.schema.compare.xObjectType')}</option></select></label><select aria-label={t('panel.schema.compare.m624486af8b')} value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">{t('panel.schema.compare.m3bbe284a2f')}{result.differences.length})</option><option value="different">{t('panel.schema.compare.m0191a660e1')}{result.differences.filter((x) => x.change === 'changed').length})</option><option value="added">{t('panel.schema.compare.m7a87e48ea5')}{result.differences.filter((x) => x.change === 'added').length})</option><option value="removed">{t('panel.schema.compare.m2bd1567938')}{result.differences.filter((x) => x.change === 'removed').length})</option></select><input aria-label={t('panel.schema.compare.m5a09f8aab4')} placeholder={t('panel.schema.compare.mf8945ed521')} value={search} onChange={(event) => setSearch(event.target.value)} /><button onClick={() => setSelected(new Set(visible.filter((x) => includeDrops || x.change !== 'removed').map(keyOf)))}>{t('panel.schema.compare.m202855b325')}</button><button onClick={() => setSelected(new Set())}>{t('panel.schema.compare.m6a9c6cd68e')}</button></div>
      <div style={{ maxHeight: 230, overflow: 'auto', border: '1px solid var(--border)' }} role="tree" aria-label={t('panel.schema.compare.m011cb3fbea')}><table className="schema-diff-table"><thead><tr><th>{t('panel.schema.compare.xType')}</th><th>{t('panel.schema.compare.xSourceObject')}</th><th>{t('cmp.include')}</th><th>{t('panel.schema.compare.xOperation')}</th><th>{t('panel.schema.compare.xTargetObject')}</th></tr></thead><tbody>{(['added','changed','removed'] as const).map((group)=>{const rows=visible.filter((item)=>item.change===group);if(!rows.length)return null;const count=rows.filter((item)=>selected.has(keyOf(item))).length;const title=group==='added'?t('cmp.state.onlySource'):group==='removed'?t('cmp.state.onlyTarget'):t('cmp.state.different');return <Fragment key={group}><tr className="schema-diff-group"><th colSpan={5}>{title} ({count} of {rows.length} {t('panel.schema.compare.xSelected')})</th></tr>{rows.map((item)=><tr key={keyOf(item)}><td>{item.kind}</td><td><button className="schema-object-link" onClick={()=>setActive(item)}>{group==='removed'?t('panel.schema.compare.xObjectMissing'):item.object}</button></td><td><input type="checkbox" aria-label={`${t('cmp.include')}: ${item.object}`} checked={selected.has(keyOf(item))} onChange={()=>setSelected((old)=>{const next=new Set(old);if(next.has(keyOf(item)))next.delete(keyOf(item));else next.add(keyOf(item));return next})}/></td><td>{group==='added'?t('panel.schema.compare.xCreate'):group==='removed'?t('panel.schema.compare.xDrop'):t('panel.schema.compare.xUpdate')}</td><td>{group==='removed'?item.object:group==='added'?t('panel.schema.compare.xObjectMissing'):item.object}</td></tr>)}</Fragment>})}</tbody></table></div><small>{t('cmp.summary.included').replace('{0}',String(selected.size)).replace('{1}',String(result.differences.length))}</small>
      <h3>{t('panel.schema.compare.mede7a4f214')} {active ? `· ${active.object}` : ''}</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><div><b>{t('cmp.dest.connection')}</b><Editor height="220px" language="sql" theme="vs-dark" value={selectedDdl('source')} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }} /></div><div><b>{t('panel.schema.compare.m31e4abecbd')}</b><Editor height="220px" language="sql" theme="vs-dark" value={selectedDdl('target')} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }} /></div></div>
    </>}
    <p role="status">{busy ? 'Calculando diferenças… ' : ''}{message}</p>
    {scriptPreview && <aside className="schema-script-dock" aria-label={t('panel.schema.compare.mbfa0cceb38')}><h3>{t('panel.schema.compare.mbfa0cceb38')}{active ? ` · ${active.object}` : ''}</h3><textarea aria-label={t('panel.schema.compare.m09cb19896d')} readOnly value={selectedScript} /><div className="schema-wizard-actions"><button onClick={() => { void navigator.clipboard.writeText(selectedScript); setMessage(t('panel.schema.compare.xScriptCopied')) }}>{t('panel.schema.compare.md1aaebd0c4')}</button><button onClick={exportScript}>{t('panel.schema.compare.mbf378c8dfb')}</button><button onClick={() => void queueScript()} disabled={!selectedScript.trim()}>{t('extras.schema.queue')}</button><button onClick={() => setScriptPreview(false)}>{t('panel.schema.compare.m0c2ba589bb')}</button></div></aside>}
    {confirmOpen && <div ref={syncDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('panel.schema.compare.m09644ae38f')} className="schema-sync-wizard"><h3>{t('panel.schema.compare.madcff3dedf')}</h3><nav className="schema-wizard-steps">{(['output','options','scripts','summary'] as SyncStep[]).map((step,index)=><button key={step} className={syncStep===step?'active':''} onClick={()=>setSyncStep(step)}>{index+1} · {t(`panel.schema.compare.xSync${step[0]?.toUpperCase()}${step.slice(1)}`)}</button>)}</nav><p>{t('panel.schema.compare.mbf2e3e94b1')} {label(target)} / {targetDb}</p>
      {syncStep==='output'&&<fieldset><legend>{t('panel.schema.compare.xOutput')}</legend><label><input type="radio" checked={outputMode==='editor'} onChange={()=>setOutputMode('editor')}/>{t('panel.schema.compare.xOpenEditor')}</label><label><input type="radio" checked={outputMode==='file'} onChange={()=>setOutputMode('file')}/>{t('panel.schema.compare.xSaveFile')}</label><label><input type="radio" checked={outputMode==='execute'} onChange={()=>setOutputMode('execute')}/>{t('panel.schema.compare.xExecuteDirect')}</label>{outputMode==='execute'&&<label className="schema-danger-confirm"><input type="checkbox" checked={directAccepted} onChange={(e)=>setDirectAccepted(e.target.checked)}/>{t('panel.schema.compare.xConfirmDirect')}</label>}</fieldset>}
      {syncStep==='options'&&<fieldset><legend>{t('panel.schema.compare.xCommon')}</legend>{([['checkExists','xCheckExists'],['includeUse','xIncludeUse'],['dropCreateTables','xDropCreateTables'],['dropCreateObjects','xDropCreateObjects'],['excludeComments','xExcludeComments'],['transaction','xWrapTransaction']] as const).map(([key,labelKey])=><label key={key}><input type="checkbox" checked={syncOptions[key]} onChange={(e)=>setSyncOptions((old)=>({...old,[key]:e.target.checked}))}/>{t(`panel.schema.compare.${labelKey}`)}</label>)}</fieldset>}
      {syncStep==='scripts'&&<><label>{t('panel.schema.compare.xBefore')}<textarea value={beforeScript} onChange={(e)=>setBeforeScript(e.target.value)} /></label><label>{t('panel.schema.compare.xAfter')}<textarea value={afterScript} onChange={(e)=>setAfterScript(e.target.value)} /></label></>}
      {syncStep==='summary'&&<><h4>{t('panel.schema.compare.xActionPlan')} ({selected.size})</h4><ol>{selectedScript.split(/;\\s*(?:\\r?\\n|$)/).filter(Boolean).map((statement,index)=><li key={index}>{statement.trim().split('\\n')[0]}</li>)}</ol><h4>{t('panel.schema.compare.xWarnings')} ({destructive?1:0})</h4>{destructive&&<fieldset className="schema-danger-confirm"><p>{t('cmp.risk.dropColumns')}</p><label><input type="checkbox" checked={riskAccepted} onChange={(event)=>setRiskAccepted(event.target.checked)}/>{t('panel.schema.compare.m8dd6009ee2')}</label></fieldset>}<textarea aria-label={t('panel.schema.compare.mf18b1a6d11')} readOnly value={fullSyncScript}/></>}
      <footer className="schema-wizard-actions"><button onClick={()=>setSyncStep((['output','options','scripts','summary'][Math.max(0,['output','options','scripts','summary'].indexOf(syncStep)-1)] as SyncStep))} disabled={syncStep==='output'}>{t('panel.schema.compare.xBack')}</button><button onClick={()=>setSyncStep((['output','options','scripts','summary'][Math.min(3,['output','options','scripts','summary'].indexOf(syncStep)+1)] as SyncStep))} disabled={syncStep==='summary'}>{t('panel.schema.compare.xNext')}</button><button disabled={syncStep!=='summary'||(outputMode==='execute'&&!directAccepted)||(destructive&&!riskAccepted)} onClick={()=>void synchronize()}>{outputMode==='execute'?t('panel.schema.compare.xExecute'):outputMode==='file'?t('panel.schema.compare.xSaveFile'):t('panel.schema.compare.xOpenEditor')}</button><button onClick={()=>{setConfirmOpen(false);setRiskAccepted(false);setDirectAccepted(false)}}>{t('common.cancel')}</button></footer></div>}
  </section>
}
