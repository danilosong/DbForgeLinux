import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import type { DatabaseModel, TableModel } from '../../../../../modules/schema/model.js'
import { inferKind } from '../../../../../modules/data-generation/generators.js'
import { relatedGenerationTables } from '../../../../../modules/data-generation/index.js'
import { dataDomainProfileGroups, dataDomainProfileLabel, dataDomainProfiles, generatorSpecForDomainProfile, type DataDomainProfile } from '../../../../../modules/data-generation/profiles.js'
import type { GeneratorSpec } from '../../../../../modules/data-generation/types.js'
import { usePanelConnection, usePanelNavigation } from '../registry'
import AssistantFinish from '../../components/AssistantFinish.js'

type Distribution = 'specified' | 'volume' | 'time' | 'lookup'
const quote = (name: string): string => `\`${name.replaceAll('`', '``')}\``
const countResult = (results: Awaited<ReturnType<typeof window.tuxsql.executeSql>>): number => Number(results[0]?.rows?.[0]?.count ?? 0)

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()
  const activeConnection = usePanelConnection()
  const { selectedObject } = usePanelNavigation()
  const [connectionId, setConnectionId] = useState(activeConnection?.id ?? '')
  const [database, setDatabase] = useState('')
  const [schema, setSchema] = useState<DatabaseModel | null>(null)
  const [table, setTable] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({})
  const [existingCounts, setExistingCounts] = useState<Record<string, number>>({})
  const [distribution, setDistribution] = useState<Distribution>('specified')
  const [percent, setPercent] = useState(100)
  const [seconds, setSeconds] = useState(10)
  const [rowsPerSecond, setRowsPerSecond] = useState(100)
  const [lookupTable, setLookupTable] = useState('')
  const [seed, setSeed] = useState('1')
  const [generators, setGenerators] = useState<Record<string, GeneratorSpec>>({})
  const [columnProfiles, setColumnProfiles] = useState<Record<string, DataDomainProfile>>({})
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [report, setReport] = useState('')
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [truncateBeforeGeneration, setTruncateBeforeGeneration] = useState(false)
  const [disableForeignKeyChecks, setDisableForeignKeyChecks] = useState(false)
  const [batchSize, setBatchSize] = useState(250)
  const [allowProduction, setAllowProduction] = useState(false)
  const isProduction = activeConnection?.environment === 'prod' && activeConnection.id === connectionId

  useEffect(() => setConnectionId(activeConnection?.id ?? ''), [activeConnection?.id])
  const selectedExplorerDatabase = selectedObject?.database
  const selectedExplorerTable = selectedObject?.object.name
  useEffect(() => {
    if (selectedExplorerDatabase && selectedExplorerTable) { setDatabase(selectedExplorerDatabase); setTable(selectedExplorerTable) }
  }, [selectedExplorerDatabase, selectedExplorerTable])
  const activeTable = useMemo(() => schema?.tables.find((item) => item.name === table), [schema, table])
  const relatedTables = useMemo(() => schema && activeTable ? relatedGenerationTables(schema, activeTable.name) : { parents: [], children: [] }, [activeTable, schema])

  async function load(): Promise<void> {
    setError('')
    try {
      const value = await window.tuxsql.inspectGenerationSchema(connectionId, database)
      setSchema(value)
      const preferred = value.tables.some((item) => item.name === selectedExplorerTable) ? selectedExplorerTable! : value.tables[0]?.name ?? ''
      setTable(preferred)
      setSelected(preferred ? [preferred] : [])
      setLookupTable(value.tables[0]?.name ?? '')
      setRowCounts(Object.fromEntries(value.tables.map((item) => [item.name, 1000])))
      setPreview([])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to load the schema.') }
  }

  function generatorFor(tableName: string, columnName: string, column?: TableModel['columns'][number]): GeneratorSpec {
    return generators[`${tableName}.${columnName}`] ?? { kind: column ? inferKind(column) : 'auto' }
  }
  function setColumnGenerator(tableName: string, columnName: string, kind: GeneratorSpec['kind']): void {
    setGenerators((current) => ({ ...current, [`${tableName}.${columnName}`]: { kind } }))
  }
  function applyColumnProfile(tableName: string, column: TableModel['columns'][number], value: string): void {
    const key = `${tableName}.${column.name}`
    if (value === 'custom') { setColumnProfiles((current) => { const next = { ...current }; delete next[key]; return next }); return }
    const profile = value as DataDomainProfile
    if (!dataDomainProfiles.includes(profile)) return
    setColumnProfiles((current) => ({ ...current, [key]: profile }))
    setGenerators((current) => ({ ...current, [key]: generatorSpecForDomainProfile(profile, column) }))
  }

  async function getPreview(): Promise<void> {
    if (!table) return
    setError('')
    try {
      const value = await window.tuxsql.previewGeneration(connectionId, database, table, generators, seed)
      setPreview(value)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to preview generated data.') }
  }

  async function rowCountsForGeneration(): Promise<Record<string, number>> {
    if (!schema) return {}
    if (distribution === 'specified') return Object.fromEntries(selected.map((name) => [name, rowCounts[name] ?? 0]))
    if (distribution === 'time') return Object.fromEntries(selected.map((name) => [name, Math.max(0, Math.floor(seconds * rowsPerSecond))]))
    const tables = distribution === 'lookup' ? [lookupTable] : selected
    const measured: Record<string, number> = { ...existingCounts }
    for (const name of tables) {
      if (measured[name] !== undefined) continue
      const result = await window.tuxsql.executeSql(connectionId, `SELECT COUNT(*) AS count FROM ${quote(database)}.${quote(name)}`)
      measured[name] = countResult(result)
    }
    setExistingCounts(measured)
    if (distribution === 'volume') return Object.fromEntries(selected.map((name) => [name, Math.round((measured[name] ?? 0) * Math.max(0, percent) / 100)]))
    const lookupCount = measured[lookupTable] ?? 0
    return Object.fromEntries(selected.map((name) => [name, Math.round(lookupCount * Math.max(0, percent) / 100)]))
  }

  async function generate(): Promise<void> {
    if (!schema || !selected.length) return
    setBusy(true)
    setError('')
    try {
      if (isProduction && !allowProduction) { setError(t('Data generation is blocked on Production connections. Allow it explicitly for this run to continue.')); return }
      const counts = await rowCountsForGeneration()
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
      const truncateTables = truncateBeforeGeneration ? [...selected].sort() : []
      const truncateConfirmation = truncateTables.length ? `DELETE ${database}.${JSON.stringify(truncateTables)}` : undefined
      const foreignKeyChecksConfirmation = disableForeignKeyChecks ? `DISABLE FOREIGN_KEY_CHECKS ${database}.${JSON.stringify([...selected].sort())}` : undefined
      if (!window.confirm(`${t('panel.data.generator.confirm')} ${total} rows across ${selected.join(', ')}. ${truncateTables.length ? `Existing rows in ${truncateTables.join(', ')} will be cleared in the same transaction before generation.` : 'Data is appended in a transaction.'}${disableForeignKeyChecks ? ` ${t('FOREIGN_KEY_CHECKS will be disabled only for this generation session and restored afterward.')}` : ''}`)) return
      const productionConfirmation = isProduction ? window.prompt(`${t('This is a Production connection. Type the database name to generate data in it:')}\n${database}`) ?? '' : undefined
      if (isProduction && productionConfirmation !== database) return
      if (truncateConfirmation && window.prompt(`To clear selected tables before generation, type exactly:\n${truncateConfirmation}`) !== truncateConfirmation) return
      if (foreignKeyChecksConfirmation && window.prompt(`To temporarily disable foreign-key checks, type exactly:\n${foreignKeyChecksConfirmation}`) !== foreignKeyChecksConfirmation) return
      const value = await window.tuxsql.generateTestData({ connectionId, database, tables: selected, rowsPerTable: counts, generators, seed, batchSize, confirmed: true, ...(truncateConfirmation ? { truncateTables, truncateConfirmation } : {}), ...(foreignKeyChecksConfirmation ? { disableForeignKeyChecks: true, foreignKeyChecksConfirmation } : {}), ...(isProduction ? { allowProduction, productionConfirmation } : {}) })
      setReport(`${value.inserted} rows inserted across ${Object.keys(value.tables).length} tables.`)
      setFinished(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Data generation failed.') }
    finally { setBusy(false) }
  }

  const generatorKinds: NonNullable<GeneratorSpec['kind']>[] = ['auto', 'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'company', 'url', 'ip', 'uuid', 'date', 'time', 'money', 'json', 'enum', 'status', 'number', 'lorem', 'sequence', 'unique', 'list', 'regex']
  return <section className="tool-panel data-generator-panel">
    <header><div><h2>{t('dg.title')}</h2><p>{t('dg.step.source')}</p></div>{activeConnection && <p>{t('panel.data.generator.m071ea34afb')} <strong>{activeConnection.name}</strong></p>}</header>
    {finished ? <AssistantFinish summary={<p role="status">{report}</p>} moreLabel={t('panel.data.generator.generate')} onMore={() => { setFinished(false); setReport('') }} /> : <>
    {!activeConnection && <label>{t('panel.data.generator.mfbc13e1573')} <input value={connectionId} onChange={(event) => setConnectionId(event.target.value)} /></label>}
    <div className="dg-source"><label>{t('panel.data.generator.m760a31bd16')} <input value={database} onChange={(event) => setDatabase(event.target.value)} /></label><button onClick={() => void load()}>{t('panel.data.generator.m766a448211')}</button></div>
    {schema ? <>
      <div className="dg-layout">
        <section className="dg-table-tree"><h3>{t('panel.data.generator.ma76e493e46')}</h3><div className="dg-related-tables"><strong>Related tables · {activeTable?.name}</strong>{(['parents', 'children'] as const).map((group) => <div key={group}><span>{group === 'parents' ? 'Parent tables' : 'Child tables'}</span>{relatedTables[group].length ? relatedTables[group].map((name) => <label key={`${group}-${name}`}><input type="checkbox" checked={selected.includes(name)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, name])] : current.filter((item) => item !== name))} />{name}</label>) : <small>None</small>}</div>)}</div>{schema.tables.map((item) => <details key={item.name} open={item.name === table}><summary><label><input type="checkbox" checked={selected.includes(item.name)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, item.name])] : current.filter((name) => name !== item.name))} />{item.name}</label><input aria-label={`${item.name} row count`} type="number" min="0" value={rowCounts[item.name] ?? 1000} onChange={(event) => setRowCounts((current) => ({ ...current, [item.name]: Math.max(0, Number(event.target.value)) }))} /></summary><div className="dg-columns">{item.columns.map((column) => { const generator = generatorFor(item.name, column.name, column); const profileKey = `${item.name}.${column.name}`; return <label key={column.name}><span>{column.name} <small>{column.type}{column.nullable ? '' : ', NOT NULL'}</small></span><select aria-label={`${profileKey} profile`} value={columnProfiles[profileKey] ?? 'custom'} onChange={(event) => applyColumnProfile(item.name, column, event.target.value)}><option value="custom">{t('dg.profile.custom')}</option>{dataDomainProfileGroups.map((group) => <optgroup key={group.family} label={t(`dg.profile.${group.family}`)}>{group.profiles.map((profile) => <option key={profile} value={profile}>{['people', 'addresses', 'companies', 'ecommerce', 'finance', 'datetime', 'text'].includes(profile) ? t(`dg.profile.${profile}`) : dataDomainProfileLabel(profile)}</option>)}</optgroup>)}</select><select aria-label={`${profileKey} generator`} value={generator.kind ?? 'auto'} onChange={(event) => setColumnGenerator(item.name, column.name, event.target.value as GeneratorSpec['kind'])}>{generatorKinds.map((kind) => <option key={kind} value={kind}>{t(`panel.data.generator.kind${kind[0]?.toUpperCase()}${kind.slice(1)}`)}</option>)}</select></label> })}</div></details>)}</section>
        <section className="dg-settings">
          <h3>{t('panel.data.generator.tableSettings')} {activeTable?.name}</h3>
          <label>{t('panel.data.generator.distribution')}<select value={distribution} onChange={(event) => setDistribution(event.target.value as Distribution)}><option value="specified">{t('panel.data.generator.byNumber')}</option><option value="volume">{t('panel.data.generator.byVolume')}</option><option value="time">{t('panel.data.generator.byTime')}</option><option value="lookup">{t('panel.data.generator.byLookup')}</option></select></label>
          {distribution === 'volume' && <label>{t('panel.data.generator.percent')}<input type="number" min="0" value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label>}
          {distribution === 'time' && <><label>{t('panel.data.generator.seconds')}<input type="number" min="0" value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} /></label><label>{t('panel.data.generator.rowsPerSecond')}<input type="number" min="0" value={rowsPerSecond} onChange={(event) => setRowsPerSecond(Number(event.target.value))} /></label></>}
          {distribution === 'lookup' && <><label>{t('panel.data.generator.lookupTable')}<select value={lookupTable} onChange={(event) => setLookupTable(event.target.value)}>{schema.tables.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>{t('panel.data.generator.percent')}<input type="number" min="0" value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label></>}
          <label>{t('panel.data.generator.seed')}<input value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
          <label>{t('Batch size')}<input aria-label={t('Batch size')} type="number" min="1" max="10000" value={batchSize} onChange={(event) => setBatchSize(Math.max(1, Math.min(10000, Number(event.target.value))))} /></label>
          <button onClick={() => void getPreview()}>{t('panel.data.generator.refreshPreview')}</button>
          {isProduction && <label className="dg-destructive-option"><input aria-label={t('Allow generation on this Production connection')} type="checkbox" checked={allowProduction} onChange={(event) => setAllowProduction(event.target.checked)} /> {t('Allow generation on this Production connection')} <small>{t('Production connections are blocked by default. You will also type the database name.')}</small></label>}
          <label className="dg-destructive-option"><input type="checkbox" checked={truncateBeforeGeneration} onChange={(event) => setTruncateBeforeGeneration(event.target.checked)} /> Truncate before generation <small>Clears selected tables transactionally; auto-increment counters are not reset.</small></label>
          <label className="dg-destructive-option"><input aria-label={t('Disable FOREIGN_KEY_CHECKS during generation')} type="checkbox" checked={disableForeignKeyChecks} onChange={(event) => setDisableForeignKeyChecks(event.target.checked)} /> {t('Disable FOREIGN_KEY_CHECKS during generation')} <small>{t('This temporarily disables referential checks for the selected tables. The original session setting is restored after generation.')}</small></label>
        </section>
      </div>
      <div className="dg-preview"><h3>{t('panel.data.generator.preview50')} {activeTable?.name}</h3><div className="module-table-wrap"><table><thead><tr>{activeTable?.columns.map((column) => <th key={column.name}>{column.name}<small>{t(`panel.data.generator.kind${(generatorFor(activeTable.name, column.name, column).kind ?? 'auto')[0]?.toUpperCase()}${(generatorFor(activeTable.name, column.name, column).kind ?? 'auto').slice(1)}`)}</small></th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index}>{activeTable?.columns.map((column) => <td key={column.name}>{String(row[column.name] ?? '(null)')}</td>)}</tr>)}</tbody></table></div><div className="dg-actions"><button onClick={() => void getPreview()}>{t('panel.data.generator.preview')}</button><button disabled={busy || !selected.length} onClick={() => void generate()}>{busy ? t('panel.data.generator.generating') : t('panel.data.generator.generate')}</button></div>{report && <p role="status">{report}</p>}</div>
    </> : <div className="tool-empty-state" role="status">{t('dg.empty')}</div>}
    </>}
    {error && <p role="alert">{error}</p>}
    <style>{`.data-generator-panel{display:flex;flex-direction:column;gap:10px;max-height:80vh;overflow:auto}.data-generator-panel header{display:flex;justify-content:space-between;align-items:start;gap:10px}.data-generator-panel h2,.data-generator-panel h3{margin:0 0 6px}.data-generator-panel header p{margin:4px 0;color:var(--muted)}.dg-source,.dg-actions{display:flex;align-items:end;gap:8px}.dg-source label,.dg-settings label{display:flex;flex-direction:column;gap:4px;flex:1}.dg-source input,.dg-settings input,.dg-settings select,.dg-table-tree input[type=number],.dg-columns select{max-width:100%;box-sizing:border-box;padding:6px;background:var(--bg-surface);color:var(--text);border:1px solid var(--border)}.dg-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(230px,1fr);gap:10px;min-height:230px}.dg-table-tree,.dg-settings,.dg-preview{min-width:0;overflow:auto;border:1px solid var(--border);border-radius:5px;padding:8px;background:var(--bg-surface)}.dg-table-tree details{border-bottom:1px solid var(--border)}.dg-table-tree summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px;cursor:pointer}.dg-table-tree summary label{display:flex;align-items:center;gap:6px}.dg-table-tree input[type=number]{width:90px}.dg-related-tables{display:grid;gap:5px;padding:7px;margin-bottom:6px;border:1px solid var(--border);border-radius:4px}.dg-related-tables>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}.dg-related-tables>div>span{min-width:105px;color:var(--muted)}.dg-related-tables label{display:flex;align-items:center;gap:4px}.dg-columns{padding-left:20px}.dg-columns label{display:grid;grid-template-columns:minmax(0,1fr) minmax(115px,150px) minmax(115px,140px);gap:8px;align-items:center;padding:4px}.dg-columns small,.dg-preview th small{display:block;color:var(--muted);font-weight:400;font-size:10px}.dg-settings{display:flex;flex-direction:column;gap:8px}.dg-settings .dg-destructive-option{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:4px 8px;border-top:1px solid var(--border);padding-top:8px}.dg-destructive-option input{grid-row:span 2}.dg-destructive-option small{color:var(--muted);font-size:11px}.dg-preview .module-table-wrap{max-height:240px}.dg-preview table{border-collapse:collapse;width:100%}.dg-preview th,.dg-preview td{padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap}.dg-actions{margin-top:8px}@media(max-width:800px){.dg-layout{grid-template-columns:1fr}.data-generator-panel header{flex-direction:column}.dg-columns label{grid-template-columns:1fr 1fr}.dg-columns label>span{grid-column:1/-1}}`}</style>
  </section>
}
