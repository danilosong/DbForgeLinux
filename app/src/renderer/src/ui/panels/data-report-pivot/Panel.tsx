import { useI18n } from '../../i18n/useI18n.js'
import { useMemo, useState } from 'react'
import type { PivotAggregation, PivotChartType, PivotConfig, PivotResult, ReportExportFormat } from '../../../../../modules/data-report-pivot/types.js'
import { buildPivotChart } from '../../../../../modules/data-report-pivot/index.js'
import { usePanelConnection } from '../registry.js'

type Role = 'none' | 'rows' | 'columns' | 'values' | 'filter'
type ReportKind = 'standard' | 'label' | 'blank'
const aggregations: PivotAggregation[] = ['sum', 'count', 'average', 'min', 'max', 'stddev', 'distinct-count']
const charts: PivotChartType[] = ['bar', 'line', 'pie', 'area', 'stacked']
const emptyConfig = (): PivotConfig => ({ rows: [], columns: [], values: [], rowTotals: true, columnTotals: true, grandTotal: true })

export default function DataReportPivotPanel(): React.JSX.Element {
  const { t } = useI18n()

  const active = usePanelConnection()
  const [query, setQuery] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [fields, setFields] = useState<string[]>([])
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [aggregationByField, setAggregationByField] = useState<Record<string, PivotAggregation>>({})
  const [config, setConfig] = useState<PivotConfig>(emptyConfig)
  const [pivot, setPivot] = useState<PivotResult | null>(null)
  const [sampleCount, setSampleCount] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [chartType, setChartType] = useState<PivotChartType>('bar')
  const [chartVisible, setChartVisible] = useState(false)
  const [message, setMessage] = useState('Load a SELECT query to choose pivot fields.')
  const [reportKind, setReportKind] = useState<ReportKind>('standard')
  const [editingSql, setEditingSql] = useState(false)
  const chart = useMemo(() => pivot ? buildPivotChart(pivot, { type: chartType }) : null, [pivot, chartType])

  async function loadQuery(): Promise<void> {
    if (!active) { setMessage('Select an active database connection first.'); return }
    if (!query.trim()) { setMessage('Enter a SELECT query.'); return }
    setBusy(true); setMessage('Loading query fields…'); setPivot(null)
    try {
      const loaded = await window.dbforge.loadReportQuery(active.id, query)
      setDatasetId(loaded.datasetId); setFields(loaded.columns); setSampleCount(loaded.rowCount); setTruncated(loaded.truncated)
      setRoles(Object.fromEntries(loaded.columns.map((field) => [field, 'none' as Role])))
      setAggregationByField(Object.fromEntries(loaded.columns.map((field) => [field, 'sum' as PivotAggregation])))
      setConfig(emptyConfig()); setMessage(`${loaded.rowCount.toLocaleString()} rows loaded${loaded.truncated ? ' · partial result' : ''}. Drag fields into Rows, Columns, or Data below.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the report query.') }
    finally { setBusy(false) }
  }

  async function build(): Promise<void> {
    if (!datasetId) { setMessage('Load a query before building the pivot.'); return }
    const next: PivotConfig = {
      filters: config.filters,
      rowTotals: config.rowTotals,
      columnTotals: config.columnTotals,
      grandTotal: config.grandTotal,
      subtotals: config.subtotals,
      rows: fields.filter((field) => roles[field] === 'rows').map((field) => ({ field })),
      columns: fields.filter((field) => roles[field] === 'columns').map((field) => ({ field })),
      values: fields.filter((field) => roles[field] === 'values').map((field) => ({ field, aggregation: aggregationByField[field] ?? 'sum' }))
    }
    setBusy(true); setMessage('Building pivot…')
    try { const result = await window.dbforge.buildPivot(datasetId, next); setPivot(result); setConfig(next); setMessage(`${result.rowCount.toLocaleString()} rows${result.truncated ? ' · partial result' : ''}`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to build pivot.') }
    finally { setBusy(false) }
  }

  async function exportResult(format: ReportExportFormat): Promise<void> {
    if (!pivot) return
    try { const path = await window.dbforge.exportPivot(pivot, format); if (path) setMessage(`Report exported to ${path}`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not export the report.') }
  }

  return <section className="report-pivot-panel">
    <header className="rp-header"><div><h2>{t('panel.data.report.pivot.m6c311c3ad0')}</h2><p>{t('panel.data.report.pivot.m8634dcf425')}</p></div><div className="rp-actions"><label>{t('report.type')} <select value={reportKind} onChange={(event) => setReportKind(event.target.value as ReportKind)}><option value="standard">{t('report.standard')}</option><option value="label">{t('report.label')}</option><option value="blank">{t('report.blank')}</option></select></label><button disabled={!datasetId || busy} onClick={() => void build()}>{t('pivot.build')}</button><select aria-label={t('panel.data.report.pivot.m427e4e2845')} disabled={!pivot} onChange={(event) => { if (event.target.value) void exportResult(event.target.value as ReportExportFormat); event.target.value = '' }}><option value="">{t('panel.data.report.pivot.m813a85cd77')}</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf">PDF</option></select></div></header>
    <label className="rp-query-label">{t('panel.data.report.pivot.mf20c81b6a5')} <button type="button" onClick={() => setEditingSql((current) => !current)}>{t('pivot.editSql')}</button><textarea readOnly={!editingSql} aria-label={t('panel.data.report.pivot.m85117e45b0')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('panel.data.report.pivot.m7a87b22ae2')} rows={4} /></label>
    <div className="rp-toolbar"><button disabled={!active || busy} onClick={() => void loadQuery()}>{busy ? 'Loading…' : 'Load query fields'}</button>{datasetId && <span>{sampleCount.toLocaleString()} {t('panel.data.report.pivot.m8bc6a2f85f')}{truncated ? ' · partial result' : ''}</span>}</div>
    {!fields.length ? <div className="rp-empty">{t('panel.data.report.pivot.mf8469e9cf8')}</div> : <div className="rp-workspace">
      <section className="rp-fields"><h3>{t('panel.data.report.pivot.maeaee92137')}</h3><p>{t('pivot.dragHint')}</p>{fields.map((field) => <div className="rp-field" key={field} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', field)}><span>{field}</span><select aria-label={`Zone for ${field}`} value={roles[field] ?? 'none'} onChange={(event) => setRoles((current) => ({ ...current, [field]: event.target.value as Role }))}><option value="none">{t('panel.data.report.pivot.m98317e8c74')}</option><option value="filter">{t('panel.data.report.pivot.m01fa02ee78')}</option><option value="rows">{t('panel.data.report.pivot.md637a47181')}</option><option value="columns">{t('tbl.page.columns')}</option><option value="values">{t('panel.data.report.pivot.m09b2046963')}</option></select>{roles[field] === 'values' && <select aria-label={`Aggregation for ${field}`} value={aggregationByField[field] ?? 'sum'} onChange={(event) => setAggregationByField((current) => ({ ...current, [field]: event.target.value as PivotAggregation }))}>{aggregations.map((item) => <option key={item} value={item}>{item}</option>)}</select>}</div>)}</section>
      <section className="rp-zones"><h3>{t('panel.data.report.pivot.m0a94cf8bac')}</h3><div className="rp-zone-grid"><Zone title={t('panel.data.report.pivot.m01fa02ee78')} role="filter" fields={fields.filter((field) => roles[field] === 'filter')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('panel.data.report.pivot.m09b2046963')} role="values" fields={fields.filter((field) => roles[field] === 'values').map((field) => `${aggregationByField[field] ?? 'sum'}(${field})`)} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('panel.data.report.pivot.md637a47181')} role="rows" fields={fields.filter((field) => roles[field] === 'rows')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('tbl.page.columns')} role="columns" fields={fields.filter((field) => roles[field] === 'columns')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /></div>
        <div className="rp-totals"><label><input type="checkbox" checked={config.rowTotals !== false} onChange={(event) => setConfig((current) => ({ ...current, rowTotals: event.target.checked }))} /> {t('panel.data.report.pivot.m9e1373bb27')}</label><label><input type="checkbox" checked={config.columnTotals !== false} onChange={(event) => setConfig((current) => ({ ...current, columnTotals: event.target.checked }))} /> {t('panel.data.report.pivot.mbf8c95930a')}</label><label><input type="checkbox" checked={config.grandTotal !== false} onChange={(event) => setConfig((current) => ({ ...current, grandTotal: event.target.checked }))} /> {t('panel.data.report.pivot.me7f3b69779')}</label><label><input type="checkbox" checked={Boolean(config.subtotals)} onChange={(event) => setConfig((current) => ({ ...current, subtotals: event.target.checked }))} /> {t('panel.data.report.pivot.m7be3c453a6')}</label></div>
      </section>
    </div>}
    {pivot && <><div className="rp-result-toolbar"><strong>{t('pivot.title')}</strong><span>{pivot.rowCount.toLocaleString()} {t('panel.data.report.pivot.mcba6d57e07')}{pivot.truncated ? ' · partial result' : ''}</span><button onClick={() => setChartVisible((visible) => !visible)}>{chartVisible ? 'Hide Chart' : 'Show Chart'}</button>{chartVisible && <select aria-label={t('panel.data.report.pivot.m9cf9677359')} value={chartType} onChange={(event) => setChartType(event.target.value as PivotChartType)}>{charts.map((item) => <option key={item}>{item}</option>)}</select>}</div>
      {chartVisible && chart && <Chart data={chart} />}
      <div className="rp-grid-scroll"><table className="rp-grid"><thead><tr>{pivot.rowFields.map((field) => <th key={field}>{field}</th>)}{pivot.columns.map((column) => <th key={column.key}>{column.label}</th>)}{pivot.rowFields.length > 0 && <th>{t('panel.data.report.pivot.mf139f7b64e')}</th>}</tr></thead><tbody>{pivot.rows.map((row) => <tr key={row.key} className={row.subtotal ? 'rp-subtotal' : ''}>{pivot.rowFields.map((_, index) => <td key={index}>{row.values[index] == null ? '' : String(row.values[index])}</td>)}{pivot.columns.map((column) => <td key={column.key}>{formatValue(row.cells[column.key])}</td>)}{pivot.rowFields.length > 0 && <td>{row.total ? Object.values(row.total).map(formatValue).join(' · ') : ''}</td>}</tr>)}{Object.keys(pivot.grandTotal).length > 0 && <tr className="rp-grand-total">{pivot.rowFields.map((_, index) => <th key={index}>{index === 0 ? 'Grand Total' : ''}</th>)}{pivot.columns.map((column) => <td key={column.key}>{formatValue(pivot.columnTotals[column.key])}</td>)}{pivot.rowFields.length > 0 && <td>{Object.values(pivot.grandTotal).map(formatValue).join(' · ')}</td>}</tr>}</tbody></table></div>
    </>}
    <p className="rp-status" role="status">{message}</p>
    <style>{`.report-pivot-panel{height:100%;display:flex;flex-direction:column;gap:10px;overflow:auto;color:var(--text)}.rp-header,.rp-actions,.rp-toolbar,.rp-result-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rp-header{justify-content:space-between}.rp-header h2{margin:0}.rp-header p{margin:4px 0;color:var(--text-secondary)}.rp-query-label{display:flex;flex-direction:column;gap:4px}.rp-query-label textarea{font:13px monospace;resize:vertical;background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:8px}.rp-toolbar,.rp-result-toolbar{padding:6px 0;border-block:1px solid var(--border)}.rp-toolbar span,.rp-result-toolbar span{color:var(--text-secondary)}.rp-workspace{display:grid;grid-template-columns:minmax(250px,1fr) minmax(350px,2fr);gap:12px;min-height:180px}.rp-fields,.rp-zones{border:1px solid var(--border);border-radius:5px;padding:8px;overflow:auto}.rp-fields h3,.rp-zones h3{margin:0 0 8px}.rp-field{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:4px;border-bottom:1px solid var(--border)}.rp-zone-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rp-zone{min-height:48px;padding:7px;border:1px dashed var(--border);background:var(--bg-surface-alt);border-radius:4px}.rp-zone strong{display:block;margin-bottom:5px}.rp-chip{display:inline-block;padding:3px 7px;margin:2px;border-radius:10px;background:var(--accent-soft)}.rp-totals{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.rp-empty{padding:25px;border:1px dashed var(--border);text-align:center;color:var(--text-secondary)}.rp-grid-scroll{overflow:auto;max-height:42vh;border:1px solid var(--border)}.rp-grid{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}.rp-grid th,.rp-grid td{padding:5px 8px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap}.rp-grid th{position:sticky;top:0;background:var(--bg-surface-alt)}.rp-grid td:not(:first-child){text-align:right}.rp-subtotal{font-weight:600;background:var(--bg-surface-alt)}.rp-grand-total{font-weight:700;background:var(--accent-soft)}.rp-chart{width:100%;height:210px;border:1px solid var(--border);background:var(--bg-surface)}.rp-chart text{fill:var(--text-secondary);font:11px sans-serif}.rp-status{min-height:1.3em;margin:0;color:var(--text-secondary)}`}</style>
  </section>
}

function Zone({ title, fields, role, onDrop }: { title: string; fields: string[]; role: Role; onDrop(field: string, role: Role): void }): React.JSX.Element { return <div className="rp-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const field = event.dataTransfer.getData('text/plain'); if (field) onDrop(field, role) }}><strong>{title}</strong>{fields.map((field) => <span className="rp-chip" key={field}>{field}</span>)}</div> }
function formatValue(value: unknown): string { return value === null || value === undefined ? '' : typeof value === 'number' ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value) : String(value) }
function Chart({ data }: { data: ReturnType<typeof buildPivotChart> }): React.JSX.Element {
  const palette = ['var(--accent)', '#39a38f', '#e38b3f', '#8b78d1', '#d05d76']
  const values = data.series.flatMap((series) => series.values); const max = Math.max(1, ...values); const width = 800; const height = 210; const groupWidth = width / Math.max(1, data.labels.length); const barWidth = Math.max(5, groupWidth / Math.max(2, data.series.length + 1))
  const pointsFor = (seriesIndex: number): string => data.series[seriesIndex]!.values.map((value, index) => `${index * groupWidth + groupWidth / 2},${170 - Math.max(0, value) / max * 140}`).join(' ')
  const total = data.series[0]?.values.reduce((sum, value) => sum + Math.max(0, value), 0) ?? 0
  let angle = -Math.PI / 2
  return <svg className="rp-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${data.type} chart: ${data.title}`}><text x="10" y="16">{data.title}</text>{data.type === 'pie' ? <g>{(data.series[0]?.values ?? []).map((value, index) => { const start = angle; angle += total ? Math.max(0, value) / total * Math.PI * 2 : 0; const radius = 65; const x1 = 220 + radius * Math.cos(start); const y1 = 105 + radius * Math.sin(start); const x2 = 220 + radius * Math.cos(angle); const y2 = 105 + radius * Math.sin(angle); const large = angle - start > Math.PI ? 1 : 0; const d = value <= 0 || total === 0 ? '' : `M 220 105 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`; return <path key={data.labels[index]} d={d} fill={palette[index % palette.length]}><title>{data.labels[index]}: {value}</title></path> })}</g> : data.type === 'line' || data.type === 'area' ? <g>{data.series.map((series, index) => <g key={series.name}>{data.type === 'area' && <polygon points={`0,170 ${pointsFor(index)} ${Math.max(0, data.labels.length - 1) * groupWidth + groupWidth / 2},170`} fill={palette[index % palette.length]} opacity=".2" />}<polyline points={pointsFor(index)} fill="none" stroke={palette[index % palette.length]} strokeWidth="3" />{series.values.map((value, point) => <circle key={point} cx={point * groupWidth + groupWidth / 2} cy={170 - Math.max(0, value) / max * 140} r="3" fill={palette[index % palette.length]} />)}</g>)}</g> : <g>{data.labels.map((label, index) => { let stackOffset = 0; return <g key={label}>{data.series.map((series, seriesIndex) => { const value = Math.max(0, series.values[index] ?? 0); const barHeight = value / max * 140; const x = data.type === 'stacked' ? index * groupWidth + groupWidth * .25 : index * groupWidth + 12 + seriesIndex * barWidth; const y = 170 - (data.type === 'stacked' ? stackOffset + barHeight : barHeight); stackOffset += barHeight; return <rect key={series.name} x={x} y={y} width={data.type === 'stacked' ? groupWidth * .5 : barWidth - 3} height={barHeight} rx="2" fill={palette[seriesIndex % palette.length]}><title>{label} · {series.name}: {value}</title></rect> })}</g> })}</g>}{data.labels.map((label, index) => <text key={label} x={index * groupWidth + 4} y="190">{label.slice(0, 15)}</text>)}</svg>
}
