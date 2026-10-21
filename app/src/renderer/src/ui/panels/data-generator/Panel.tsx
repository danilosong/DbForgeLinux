import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import type { DatabaseModel, TableModel } from '../../../../../modules/schema/model.js'
import { inferKind } from '../../../../../modules/data-generation/generators.js'
import type { GeneratorSpec } from '../../../../../modules/data-generation/types.js'
import { usePanelConnection, usePanelNavigation } from '../registry'

type Distribution = 'specified' | 'volume' | 'time' | 'lookup'
const quote = (name: string): string => `\`${name.replaceAll('`', '``')}\``
const countResult = (results: Awaited<ReturnType<typeof window.dbforge.executeSql>>): number => Number(results[0]?.rows?.[0]?.count ?? 0)

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
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setConnectionId(activeConnection?.id ?? ''), [activeConnection?.id])
  const selectedExplorerDatabase = selectedObject?.database
  const selectedExplorerTable = selectedObject?.object.name
  useEffect(() => {
    if (selectedExplorerDatabase && selectedExplorerTable) { setDatabase(selectedExplorerDatabase); setTable(selectedExplorerTable) }
  }, [selectedExplorerDatabase, selectedExplorerTable])
  const activeTable = useMemo(() => schema?.tables.find((item) => item.name === table), [schema, table])

  async function load(): Promise<void> {
    setError('')
    try {
      const value = await window.dbforge.inspectGenerationSchema(connectionId, database)
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

  async function getPreview(): Promise<void> {
    if (!table) return
    setError('')
    try {
      const value = await window.dbforge.previewGeneration(connectionId, database, table, generators, seed)
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
      const result = await window.dbforge.executeSql(connectionId, `SELECT COUNT(*) AS count FROM ${quote(database)}.${quote(name)}`)
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
      const counts = await rowCountsForGeneration()
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
      if (!window.confirm(`${t('panel.data.generator.confirm')} ${total} rows across ${selected.join(', ')}. Data is appended in a transaction.`)) return
      const value = await window.dbforge.generateTestData({ connectionId, database, tables: selected, rowsPerTable: counts, generators, seed, confirmed: true })
      setReport(`${value.inserted} rows inserted across ${Object.keys(value.tables).length} tables.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Data generation failed.') }
    finally { setBusy(false) }
  }

  const generatorKinds: NonNullable<GeneratorSpec['kind']>[] = ['auto', 'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'company', 'url', 'ip', 'uuid', 'date', 'time', 'money', 'json', 'enum', 'status', 'number', 'lorem', 'sequence', 'unique', 'list', 'regex']
  return <section className="tool-panel data-generator-panel">
    <header><div><h2>{t('dg.title')}</h2><p>{t('dg.step.source')}</p></div>{activeConnection && <p>{t('panel.data.generator.m071ea34afb')} <strong>{activeConnection.name}</strong></p>}</header>
    {!activeConnection && <label>{t('panel.data.generator.mfbc13e1573')} <input value={connectionId} onChange={(event) => setConnectionId(event.target.value)} /></label>}
    <div className="dg-source"><label>{t('panel.data.generator.m760a31bd16')} <input value={database} onChange={(event) => setDatabase(event.target.value)} /></label><button onClick={() => void load()}>{t('panel.data.generator.m766a448211')}</button></div>
    {schema ? <>
      <div className="dg-layout">
        <section className="dg-table-tree"><h3>{t('panel.data.generator.ma76e493e46')}</h3>{schema.tables.map((item) => <details key={item.name} open={item.name === table}><summary><label><input type="checkbox" checked={selected.includes(item.name)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.name] : current.filter((name) => name !== item.name))} />{item.name}</label><input aria-label={`${item.name} row count`} type="number" min="0" value={rowCounts[item.name] ?? 1000} onChange={(event) => setRowCounts((current) => ({ ...current, [item.name]: Math.max(0, Number(event.target.value)) }))} /></summary><div className="dg-columns">{item.columns.map((column) => { const generator = generatorFor(item.name, column.name, column); return <label key={column.name}><span>{column.name} <small>{column.type}{column.nullable ? '' : ', NOT NULL'}</small></span><select aria-label={`${item.name}.${column.name} generator`} value={generator.kind ?? 'auto'} onChange={(event) => setColumnGenerator(item.name, column.name, event.target.value as GeneratorSpec['kind'])}>{generatorKinds.map((kind) => <option key={kind} value={kind}>{t(`panel.data.generator.kind${kind[0]?.toUpperCase()}${kind.slice(1)}`)}</option>)}</select></label> })}</div></details>)}</section>
        <section className="dg-settings"><h3>{t('panel.data.generator.tableSettings')} {activeTable?.name}</h3><label>{t('panel.data.generator.distribution')}<select value={distribution} onChange={(event) => setDistribution(event.target.value as Distribution)}><option value="specified">{t('panel.data.generator.byNumber')}</option><option value="volume">{t('panel.data.generator.byVolume')}</option><option value="time">{t('panel.data.generator.byTime')}</option><option value="lookup">{t('panel.data.generator.byLookup')}</option></select></label>{distribution === 'volume' && <label>{t('panel.data.generator.percent')}<input type="number" min="0" value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label>}{distribution === 'time' && <><label>{t('panel.data.generator.seconds')}<input type="number" min="0" value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} /></label><label>{t('panel.data.generator.rowsPerSecond')}<input type="number" min="0" value={rowsPerSecond} onChange={(event) => setRowsPerSecond(Number(event.target.value))} /></label></>}{distribution === 'lookup' && <><label>{t('panel.data.generator.lookupTable')}<select value={lookupTable} onChange={(event) => setLookupTable(event.target.value)}>{schema.tables.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>{t('panel.data.generator.percent')}<input type="number" min="0" value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label></>}<label>{t('panel.data.generator.seed')}<input value={seed} onChange={(event) => setSeed(event.target.value)} /></label><button onClick={() => void getPreview()}>{t('panel.data.generator.refreshPreview')}</button></section>
      </div>
      <div className="dg-preview"><h3>{t('panel.data.generator.preview50')} {activeTable?.name}</h3><div className="module-table-wrap"><table><thead><tr>{activeTable?.columns.map((column) => <th key={column.name}>{column.name}<small>{t(`panel.data.generator.kind${(generatorFor(activeTable.name, column.name, column).kind ?? 'auto')[0]?.toUpperCase()}${(generatorFor(activeTable.name, column.name, column).kind ?? 'auto').slice(1)}`)}</small></th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index}>{activeTable?.columns.map((column) => <td key={column.name}>{String(row[column.name] ?? '(null)')}</td>)}</tr>)}</tbody></table></div><div className="dg-actions"><button onClick={() => void getPreview()}>{t('panel.data.generator.preview')}</button><button disabled={busy || !selected.length} onClick={() => void generate()}>{busy ? t('panel.data.generator.generating') : t('panel.data.generator.generate')}</button></div>{report && <p role="status">{report}</p>}</div>
    </> : <div className="tool-empty-state" role="status">{t('dg.empty')}</div>}
    {error && <p role="alert">{error}</p>}
    <style>{`.data-generator-panel{display:flex;flex-direction:column;gap:10px;max-height:80vh;overflow:auto}.data-generator-panel header{display:flex;justify-content:space-between;align-items:start;gap:10px}.data-generator-panel h2,.data-generator-panel h3{margin:0 0 6px}.data-generator-panel header p{margin:4px 0;color:var(--muted)}.dg-source,.dg-actions{display:flex;align-items:end;gap:8px}.dg-source label,.dg-settings label{display:flex;flex-direction:column;gap:4px;flex:1}.dg-source input,.dg-settings input,.dg-settings select,.dg-table-tree input[type=number],.dg-columns select{max-width:100%;box-sizing:border-box;padding:6px;background:var(--bg-surface);color:var(--text);border:1px solid var(--border)}.dg-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(230px,1fr);gap:10px;min-height:230px}.dg-table-tree,.dg-settings,.dg-preview{min-width:0;overflow:auto;border:1px solid var(--border);border-radius:5px;padding:8px;background:var(--bg-surface)}.dg-table-tree details{border-bottom:1px solid var(--border)}.dg-table-tree summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px;cursor:pointer}.dg-table-tree summary label{display:flex;align-items:center;gap:6px}.dg-table-tree input[type=number]{width:90px}.dg-columns{padding-left:20px}.dg-columns label{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:8px;align-items:center;padding:4px}.dg-columns small,.dg-preview th small{display:block;color:var(--muted);font-weight:400;font-size:10px}.dg-settings{display:flex;flex-direction:column;gap:8px}.dg-preview .module-table-wrap{max-height:240px}.dg-preview table{border-collapse:collapse;width:100%}.dg-preview th,.dg-preview td{padding:5px 7px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap}.dg-actions{margin-top:8px}@media(max-width:800px){.dg-layout{grid-template-columns:1fr}.data-generator-panel header{flex-direction:column}}`}</style>
  </section>
}
