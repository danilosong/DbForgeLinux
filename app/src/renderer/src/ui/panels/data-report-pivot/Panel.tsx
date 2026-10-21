import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PivotAggregation, PivotChartType, PivotConfig, PivotGrouping, PivotResult, ReportExportFormat } from '../../../../../modules/data-report-pivot/types.js'
import { buildPivotChart, buildPivotConfigFromRoles } from '../../../../../modules/data-report-pivot/index.js'
import { usePanelConnection } from '../registry.js'
import { createReportDesign, exportDesignedReport, parseReportDesign, placeReportField, reportPages, REPORT_BANDS, type ReportDesign } from '../../../../../modules/data-report-pivot/report-design.js'

type Role = 'none' | 'rows' | 'columns' | 'values' | 'filter'
type ReportKind = 'standard' | 'label' | 'blank'
const aggregations: PivotAggregation[] = ['sum', 'count', 'average', 'min', 'max', 'stddev', 'distinct-count']
const charts: PivotChartType[] = ['bar', 'line', 'pie', 'area', 'stacked']
const bandKey = (band: string): string => band.split(' ').map((part, index) => index ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}` : part.toLowerCase()).join('')
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
  const [reportRows, setReportRows] = useState<Array<Record<string, unknown>>>([])
  const [dateGrouping, setDateGrouping] = useState<Record<string, PivotGrouping[]>>({})
  const [dateFields, setDateFields] = useState<string[]>([])
  const [truncated, setTruncated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [chartType, setChartType] = useState<PivotChartType>('bar')
  const [chartVisible, setChartVisible] = useState(false)
  const [message, setMessage] = useState(t('audit.report.loadHint'))
  const [reportKind, setReportKind] = useState<ReportKind>('standard')
  const [editingSql, setEditingSql] = useState(false)
  const [designMode, setDesignMode] = useState(() => window.sessionStorage.getItem('dbforge:data-report-pivot:open-mode') === 'report')
  const [reportDesign, setReportDesign] = useState<ReportDesign>(() => createReportDesign('Data Report', []))
  const [page, setPage] = useState(0)
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const lastPivotConfigRef = useRef('')
  const pivotRequestRef = useRef(0)
  const chart = useMemo(() => pivot ? buildPivotChart(pivot, { type: chartType }) : null, [pivot, chartType])

  useEffect(() => {
    const open = (event: Event): void => {
      const mode = (event as CustomEvent<'report' | 'pivot'>).detail
      if (mode === 'report') {
        setReportDesign((current) => ({ ...current, dataSourceQuery: query, bands: current.bands.Detail.length || !fields.length ? current.bands : createReportDesign('Data Report', fields).bands }))
        setDesignMode(true)
      }
      else if (mode === 'pivot') setDesignMode(false)
    }
    const pendingMode = window.sessionStorage.getItem('dbforge:data-report-pivot:open-mode')
    if (pendingMode === 'report' || pendingMode === 'pivot') {
      window.sessionStorage.removeItem('dbforge:data-report-pivot:open-mode')
      if (pendingMode === 'report') {
        setReportDesign((current) => ({ ...current, dataSourceQuery: query, bands: current.bands.Detail.length || !fields.length ? current.bands : createReportDesign('Data Report', fields).bands }))
        setDesignMode(true)
      } else setDesignMode(false)
    }
    window.addEventListener('dbforge:data-report-pivot:open', open)
    return () => window.removeEventListener('dbforge:data-report-pivot:open', open)
  }, [fields, query])

  async function loadQuery(): Promise<void> {
    if (!active) { setMessage(t('audit.report.connectionRequired')); return }
    if (!query.trim()) { setMessage(t('audit.report.queryRequired')); return }
    setBusy(true); setMessage(t('audit.report.loadingFields')); setDatasetId(''); setFields([]); setReportRows([]); setPivot(null); setChartVisible(false)
    try {
      const loaded = await window.dbforge.loadReportQuery(active.id, query)
      setDatasetId(loaded.datasetId); setFields(loaded.columns); setSampleCount(loaded.rowCount); setTruncated(loaded.truncated); setReportRows(loaded.sample)
      const detectedDates = loaded.columns.filter((field) => loaded.sample.some((row) => row[field] instanceof Date || typeof row[field] === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]|$)/.test(row[field] as string)))
      setDateFields(detectedDates)
      setDateGrouping(Object.fromEntries(loaded.columns.map((field) => [field, detectedDates.includes(field) ? ['year'] : []])))
      setReportDesign((current) => ({ ...current, dataSourceQuery: query, bands: current.bands.Detail.length ? current.bands : createReportDesign(current.title, loaded.columns).bands }))
      setRoles(Object.fromEntries(loaded.columns.map((field) => [field, 'none' as Role])))
      setAggregationByField(Object.fromEntries(loaded.columns.map((field) => [field, 'sum' as PivotAggregation])))
      setConfig(emptyConfig()); setMessage(t('audit.report.loaded', [loaded.rowCount.toLocaleString(), loaded.truncated ? t('audit.report.partial') : '', t('audit.report.dragHint')]))
    } catch (error) { setMessage(error instanceof Error ? error.message : t('audit.report.loadFailed')) }
    finally { setBusy(false) }
  }

  async function build(): Promise<void> {
    if (!datasetId) { setMessage(t('audit.report.queryRequired')); return }
    const next = buildPivotConfigFromRoles(fields, roles, dateGrouping, aggregationByField, config)
    const request = ++pivotRequestRef.current
    setBusy(true); setMessage(t('audit.report.building')); setDesignMode(false)
    try { const result = await window.dbforge.buildPivot(datasetId, next); if (request !== pivotRequestRef.current) return; lastPivotConfigRef.current = JSON.stringify(next); setPivot(result); setConfig(next); setMessage(t('audit.report.rowCount', [result.rowCount.toLocaleString(), result.truncated ? t('audit.report.partial') : ''])) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('audit.report.buildFailed')) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (!datasetId || !pivot) return
    const next = buildPivotConfigFromRoles(fields, roles, dateGrouping, aggregationByField, config)
    const signature = JSON.stringify(next)
    if (signature === lastPivotConfigRef.current) return
    const request = ++pivotRequestRef.current
    const timer = window.setTimeout(() => {
      void window.dbforge.buildPivot(datasetId, next).then((result) => {
        if (request !== pivotRequestRef.current) return
        lastPivotConfigRef.current = signature
        setPivot(result)
        setConfig(next)
        setMessage(t('audit.report.rowCount', [result.rowCount.toLocaleString(), result.truncated ? t('audit.report.partial') : '']))
      }).catch((error: unknown) => {
        if (request === pivotRequestRef.current) setMessage(error instanceof Error ? error.message : t('audit.report.refreshFailed'))
      })
    }, 140)
    return () => window.clearTimeout(timer)
  }, [aggregationByField, config, datasetId, dateGrouping, fields, pivot, roles, t])

  async function exportResult(format: ReportExportFormat): Promise<void> {
    if (!pivot) return
    try { const path = await window.dbforge.exportPivot(pivot, format); if (path) setMessage(t('audit.report.exported', [path])) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('audit.report.exportFailed')) }
  }
  function startDesign(): void { setReportDesign((current) => ({ ...current, dataSourceQuery: query, bands: current.bands.Detail.length || !fields.length ? current.bands : createReportDesign('Data Report', fields).bands })); setDesignMode(true); setPage(0) }
  function saveDesign(): void { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(reportDesign, null, 2)], { type: 'application/json' })); link.download = `${reportDesign.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'report'}.json`; link.click(); URL.revokeObjectURL(link.href) }
  async function loadDesign(file?: File): Promise<void> { if (!file || file.size > 1_000_000) return; try { const design = parseReportDesign(await file.text()); setReportDesign(design); setQuery(design.dataSourceQuery ?? ''); setDesignMode(true); setPage(0); setMessage('Report design loaded.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid report design.') } }
  function exportChart(): void { const svg = chartWrapRef.current?.querySelector('svg'); if (!svg) return; const data = new XMLSerializer().serializeToString(svg); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' })); link.download = 'pivot-chart.svg'; link.click(); URL.revokeObjectURL(link.href) }
  function exportDesigned(format: ReportExportFormat): void {
    if (format === 'pdf') { void exportResult('pdf'); return }
    if (!pivot && !fields.length) return
    const headers = pivot ? [...pivot.rowFields, ...pivot.columns.map((column) => column.label)] : fields
    const rows = pivot ? pivot.rows.map((row) => [...row.values, ...pivot.columns.map((column) => row.cells[column.key])]) : reportRows.map((row) => fields.map((field) => row[field] ?? null))
    const content = exportDesignedReport(reportDesign, headers, rows, format)
    const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8'
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: mime })); link.download = `${reportDesign.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'report'}.${format}`; link.click(); URL.revokeObjectURL(link.href)
  }

  if (designMode) {
    const orderedRows = [...reportRows].sort((left, right) => {
      const field = reportDesign.sortField ?? reportDesign.groupField
      if (!field) return 0
      const order = String(left[field] ?? '').localeCompare(String(right[field] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      return reportDesign.sortField && reportDesign.sortDirection === 'DESC' ? -order : order
    })
    const pages = reportPages(orderedRows, 20)
    const pageRows = pages[page] ?? []
    const detailFields = reportDesign.bands.Detail.length ? reportDesign.bands.Detail : fields
    const previewRows = pageRows.flatMap((row, index) => {
      const groupValue = reportDesign.groupField ? String(row[reportDesign.groupField] ?? '') : ''
      const startsGroup = Boolean(reportDesign.groupField) && (index === 0 || String(pageRows[index - 1]?.[reportDesign.groupField!] ?? '') !== groupValue)
      const endsGroup = Boolean(reportDesign.groupField) && (index === pageRows.length - 1 || String(pageRows[index + 1]?.[reportDesign.groupField!] ?? '') !== groupValue)
      const rendered: React.JSX.Element[] = []
      if (startsGroup) rendered.push(<tr key={`group-head-${index}`} className="rp-group-preview"><th colSpan={Math.max(1, detailFields.length)}>{reportDesign.bands['Group Header'].join(' · ')} {reportDesign.groupField}: {groupValue}</th></tr>)
      rendered.push(<tr key={`detail-${index}`}>{detailFields.map((field) => <td key={field}>{formatValue(row[field])}</td>)}</tr>)
      if (endsGroup) rendered.push(<tr key={`group-foot-${index}`} className="rp-group-preview"><td colSpan={Math.max(1, detailFields.length)}>{reportDesign.bands['Group Footer'].join(' · ')}</td></tr>)
      return rendered
    })
    return <section className="report-pivot-panel rp-designer-shell" data-testid="report-designer" data-state={busy ? 'loading' : fields.length ? 'ready' : 'empty'} aria-busy={busy}>
      <header className="rp-designer-topbar"><div><h2>{reportDesign.title || t('report.designer')}</h2><p>{t('report.wysiwygHint')}</p></div><div><button onClick={saveDesign}>{t('report.saveJson')}</button><label className="rp-file-button">{t('report.loadJson')}<input type="file" accept="application/json,.json" onChange={(event) => void loadDesign(event.target.files?.[0])} /></label><select aria-label={t('report.exportData')} onChange={(event) => { if (event.target.value) exportDesigned(event.target.value as ReportExportFormat); event.target.value = '' }}><option value="">{t('report.exportData')}</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf" disabled={!pivot}>PDF</option></select><button onClick={() => setDesignMode(false)}>{t('report.closeDesigner')}</button></div></header>
      <div className="rp-designer-layout">
        <aside className="rp-designer-side">
          <details open><summary>{t('report.dataSource')}</summary><label>{t('panel.data.report.pivot.mf20c81b6a5')}<textarea aria-label={t('report.dataSourceQuery')} value={query} onChange={(event) => { setQuery(event.target.value); setReportDesign((current) => ({ ...current, dataSourceQuery: event.target.value.slice(0, 100_000) })) }} rows={5} /></label><button disabled={!active || busy || !query.trim()} onClick={() => void loadQuery()}>{busy ? 'Loading…' : t('report.loadData')}</button><p>{sampleCount.toLocaleString()} {t('report.rowsAvailable')}{truncated ? ' · partial' : ''}</p></details>
          <details open><summary>{t('report.groupSort')}</summary><label>{t('report.groupField')}<select value={reportDesign.groupField ?? ''} onChange={(event) => setReportDesign((current) => ({ ...current, groupField: event.target.value || undefined }))}><option value="">{t('report.noGrouping')}</option>{fields.map((field) => <option key={field}>{field}</option>)}</select></label><label>{t('report.sortField')}<select value={reportDesign.sortField ?? ''} onChange={(event) => setReportDesign((current) => ({ ...current, sortField: event.target.value || undefined }))}><option value="">{t('report.noSorting')}</option>{fields.map((field) => <option key={field}>{field}</option>)}</select></label><select aria-label={t('report.sortDirection')} value={reportDesign.sortDirection ?? 'ASC'} onChange={(event) => setReportDesign((current) => ({ ...current, sortDirection: event.target.value as 'ASC' | 'DESC' }))}><option value="ASC">ASC</option><option value="DESC">DESC</option></select></details>
          <details open><summary>{t('report.fields')}</summary><p>{t('report.dragFieldsHint')}</p>{fields.map((field) => <div className="rp-field rp-draggable-field" key={field} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', field)}><span>{field}</span></div>)}</details>
        </aside>
        <main className="rp-designer-canvas">
          <div className="rp-properties-bar"><label>{t('report.title')}<input value={reportDesign.title} maxLength={120} onChange={(event) => setReportDesign((current) => ({ ...current, title: event.target.value }))} /></label><label>{t('report.pageSize')}<select value={reportDesign.pageSize} onChange={(event) => setReportDesign((current) => ({ ...current, pageSize: event.target.value as ReportDesign['pageSize'] }))}><option>A4</option><option>Letter</option></select></label></div>
          <section aria-label={t('report.bands')} className="rp-band-list rp-wysiwyg-bands">{REPORT_BANDS.map((band) => <div className="rp-band" key={band} data-testid={`report-band-${bandKey(band)}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const field = event.dataTransfer.getData('text/plain'); if (fields.includes(field)) setReportDesign((current) => placeReportField(current, field, band)) }}><strong>{t(`report.band.${bandKey(band)}`)}</strong><div>{reportDesign.bands[band].map((field) => <span key={field} className="rp-chip">{field}</span>)}</div></div>)}</section>
          <div className="rp-preview-toolbar"><strong>{t('report.preview')} · {t('report.page', [String(page + 1), String(pages.length)])}</strong><span>{reportRows.length.toLocaleString()} {t('report.rowsPreviewed')}</span><button disabled={page <= 0} onClick={() => setPage((current) => current - 1)}>{t('report.previousPage')}</button><button disabled={page + 1 >= pages.length} onClick={() => setPage((current) => Math.min(pages.length - 1, current + 1))}>{t('report.nextPage')}</button></div>
          <article className="rp-page-preview rp-wysiwyg-preview" data-testid="report-page-preview"><header data-preview-band="reportHeader"><h2>{reportDesign.title}</h2>{reportDesign.bands['Report Header'].map((field) => <span className="rp-chip" key={field}>{field}</span>)}</header><section data-preview-band="pageHeader">{reportDesign.bands['Page Header'].map((field) => <span className="rp-chip" key={field}>{field}</span>)}</section><table><thead><tr>{detailFields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{previewRows}</tbody></table><footer><span data-preview-band="pageFooter">{reportDesign.bands['Page Footer'].join(' · ')}</span><span data-preview-band="reportFooter">{reportDesign.bands['Report Footer'].join(' · ')}</span></footer></article>
          <p className="rp-status" role="status">{message || t('report.emptyDataSource')}</p>
        </main>
        <aside className="rp-designer-side rp-properties"><h3>{t('report.properties')}</h3><label>{t('report.title')}<input value={reportDesign.title} maxLength={120} onChange={(event) => setReportDesign((current) => ({ ...current, title: event.target.value }))} /></label><label>{t('report.pageSize')}<select value={reportDesign.pageSize} onChange={(event) => setReportDesign((current) => ({ ...current, pageSize: event.target.value as ReportDesign['pageSize'] }))}><option>A4</option><option>Letter</option></select></label><p>{t('report.bandCount', [String(REPORT_BANDS.length)])}</p></aside>
      </div>
      <style>{`.rp-designer-shell{height:100%;overflow:hidden}.rp-designer-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--border);padding-bottom:8px}.rp-designer-topbar>div:last-child{display:flex;gap:6px;align-items:center}.rp-designer-topbar h2,.rp-designer-topbar p{margin:0}.rp-designer-topbar p{color:var(--text-secondary)}.rp-designer-layout{display:grid;grid-template-columns:minmax(210px,260px) minmax(400px,1fr) minmax(170px,210px);gap:10px;min-height:0;flex:1;overflow:auto}.rp-designer-side{display:flex;flex-direction:column;gap:8px;min-width:0;overflow:auto;border:1px solid var(--border);background:var(--bg-surface-alt);padding:8px}.rp-designer-side details{border-bottom:1px solid var(--border);padding-bottom:8px}.rp-designer-side summary{font-weight:600;cursor:pointer;padding:4px}.rp-designer-side label,.rp-properties label,.rp-properties-bar label{display:flex;flex-direction:column;gap:4px;margin:6px 0}.rp-designer-side textarea,.rp-designer-side select,.rp-properties input,.rp-properties select,.rp-properties-bar input,.rp-properties-bar select{background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:5px}.rp-properties-bar{display:flex;gap:12px;align-items:center}.rp-wysiwyg-bands{grid-template-columns:1fr 1fr}.rp-wysiwyg-preview{max-width:none;margin:0;min-height:320px}.rp-wysiwyg-preview table{border-collapse:collapse;width:100%}.rp-wysiwyg-preview footer{margin-top:20px;border-top:1px solid var(--border);padding-top:8px;color:var(--text-secondary);display:flex;justify-content:space-between}.rp-group-preview{background:var(--bg-surface-alt);font-weight:600}.rp-draggable-field{cursor:grab}.rp-properties{align-self:stretch}`}</style>
    </section>
  }

  return <section className="report-pivot-panel" data-testid="report-pivot-panel" aria-busy={busy}>
    <header className="rp-header"><div><h2>{t('panel.data.report.pivot.m6c311c3ad0')}</h2><p>{t('panel.data.report.pivot.m8634dcf425')}</p></div><div className="rp-actions"><label>{t('report.type')} <select value={reportKind} onChange={(event) => setReportKind(event.target.value as ReportKind)}><option value="standard">{t('report.standard')}</option><option value="label">{t('report.label')}</option><option value="blank">{t('report.blank')}</option></select></label><button disabled={!datasetId || busy} onClick={() => void build()}>{t('pivot.build')}</button><button disabled={!fields.length} onClick={startDesign}>{t('report.designer')}</button><select aria-label={t('panel.data.report.pivot.m427e4e2845')} disabled={!pivot} onChange={(event) => { if (event.target.value) void exportResult(event.target.value as ReportExportFormat); event.target.value = '' }}><option value="">{t('panel.data.report.pivot.m813a85cd77')}</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf">PDF</option></select></div></header>
    <label className="rp-query-label">{t('panel.data.report.pivot.mf20c81b6a5')} <button type="button" onClick={() => setEditingSql((current) => !current)}>{t('pivot.editSql')}</button><textarea readOnly={!editingSql} aria-label={t('panel.data.report.pivot.m85117e45b0')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('panel.data.report.pivot.m7a87b22ae2')} rows={4} /></label>
    <div className="rp-toolbar" data-testid="report-query-state" data-state={busy ? 'loading' : datasetId && fields.length ? 'ready' : 'idle'}><button disabled={!active || busy} onClick={() => void loadQuery()}>{busy ? 'Loading…' : 'Load query fields'}</button>{datasetId && <span>{sampleCount.toLocaleString()} {t('panel.data.report.pivot.m8bc6a2f85f')}{truncated ? ' · partial result' : ''}</span>}</div>
    {!fields.length ? <div className="rp-empty">{t('panel.data.report.pivot.mf8469e9cf8')}</div> : <div className="rp-workspace">
      <section className="rp-fields"><h3>{t('panel.data.report.pivot.maeaee92137')}</h3><p>{t('pivot.dragHint')}</p>{fields.map((field) => <div className="rp-field" key={field} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', field)}><span>{field}</span>{dateFields.includes(field) && <details className="rp-date-hierarchy"><summary>{t('pivot.date.hierarchy')}</summary>{(['year', 'quarter', 'month', 'day'] as PivotGrouping[]).map((level) => <label key={level}><input type="checkbox" checked={(dateGrouping[field] ?? []).includes(level)} onChange={(event) => setDateGrouping((current) => ({ ...current, [field]: event.target.checked ? [...new Set([...(current[field] ?? []), level])] : (current[field] ?? []).filter((item) => item !== level) }))} />{t(`pivot.date.${level}`)}</label>)}</details>}<select aria-label={`Zone for ${field}`} value={roles[field] ?? 'none'} onChange={(event) => setRoles((current) => ({ ...current, [field]: event.target.value as Role }))}><option value="none">{t('panel.data.report.pivot.m98317e8c74')}</option><option value="filter">{t('panel.data.report.pivot.m01fa02ee78')}</option><option value="rows">{t('panel.data.report.pivot.md637a47181')}</option><option value="columns">{t('tbl.page.columns')}</option><option value="values">{t('panel.data.report.pivot.m09b2046963')}</option></select>{roles[field] === 'values' && <select aria-label={`Aggregation for ${field}`} value={aggregationByField[field] ?? 'sum'} onChange={(event) => setAggregationByField((current) => ({ ...current, [field]: event.target.value as PivotAggregation }))}>{aggregations.map((item) => <option key={item} value={item}>{item}</option>)}</select>}</div>)}</section>
      <section className="rp-zones"><h3>{t('panel.data.report.pivot.m0a94cf8bac')}</h3><div className="rp-zone-grid"><Zone title={t('panel.data.report.pivot.m01fa02ee78')} role="filter" fields={fields.filter((field) => roles[field] === 'filter')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('panel.data.report.pivot.m09b2046963')} role="values" fields={fields.filter((field) => roles[field] === 'values').map((field) => `${aggregationByField[field] ?? 'sum'}(${field})`)} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('panel.data.report.pivot.md637a47181')} role="rows" fields={fields.filter((field) => roles[field] === 'rows')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /><Zone title={t('tbl.page.columns')} role="columns" fields={fields.filter((field) => roles[field] === 'columns')} onDrop={(field, role) => setRoles((current) => ({ ...current, [field]: role }))} /></div>
        <div className="rp-totals"><label><input type="checkbox" checked={config.rowTotals !== false} onChange={(event) => setConfig((current) => ({ ...current, rowTotals: event.target.checked }))} /> {t('panel.data.report.pivot.m9e1373bb27')}</label><label><input type="checkbox" checked={config.columnTotals !== false} onChange={(event) => setConfig((current) => ({ ...current, columnTotals: event.target.checked }))} /> {t('panel.data.report.pivot.mbf8c95930a')}</label><label><input type="checkbox" checked={config.grandTotal !== false} onChange={(event) => setConfig((current) => ({ ...current, grandTotal: event.target.checked }))} /> {t('panel.data.report.pivot.me7f3b69779')}</label><label><input type="checkbox" checked={Boolean(config.subtotals)} onChange={(event) => setConfig((current) => ({ ...current, subtotals: event.target.checked }))} /> {t('panel.data.report.pivot.m7be3c453a6')}</label></div>
      </section>
    </div>}
    {pivot && <><div className="rp-result-toolbar"><strong>{t('pivot.title')}</strong><span>{pivot.rowCount.toLocaleString()} {t('panel.data.report.pivot.mcba6d57e07')}{pivot.truncated ? ' · partial result' : ''}</span><button onClick={() => setChartVisible((visible) => !visible)}>{chartVisible ? 'Hide Chart' : 'Show Chart'}</button>{chartVisible && <select aria-label={t('panel.data.report.pivot.m9cf9677359')} value={chartType} onChange={(event) => setChartType(event.target.value as PivotChartType)}>{charts.map((item) => <option key={item}>{item}</option>)}</select>}</div>
      {chartVisible && chart && <div ref={chartWrapRef} className="rp-chart-wrap" data-testid="pivot-chart" data-state={chart.labels.length && chart.series.length ? 'ready' : 'empty'}><Chart data={chart} /><button onClick={exportChart}>{t('report.exportSvg')}</button></div>}
      <div className="rp-grid-scroll"><table className="rp-grid" data-testid="pivot-grid" aria-busy="false"><thead><tr>{pivot.rowFields.map((field) => <th key={field}>{field}</th>)}{pivot.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>{t('pivot.grandTotalLabel')}</th></tr></thead><tbody>{pivot.rows.map((row) => <tr key={row.key} className={row.subtotal ? 'rp-subtotal' : ''}>{pivot.rowFields.map((_, index) => <td key={index}>{row.values[index] == null ? '' : String(row.values[index])}</td>)}{pivot.columns.map((column) => <td key={column.key}>{formatValue(row.cells[column.key])}</td>)}<td>{row.total ? Object.values(row.total).map(formatValue).join(' · ') : ''}</td></tr>)}{Object.keys(pivot.grandTotal).length > 0 && <tr className="rp-grand-total">{pivot.rowFields.map((_, index) => <th key={index}>{index === 0 ? t('pivot.grandTotalLabel') : ''}</th>)}{pivot.columns.map((column) => <td key={column.key}>{formatValue(pivot.columnTotals[column.key])}</td>)}<td>{Object.values(pivot.grandTotal).map(formatValue).join(' · ')}</td></tr>}</tbody></table></div>
    </>}
    {designMode && <section className="rp-designer" aria-label={t('report.designer')} data-testid="report-designer" data-state={pivot ? 'ready' : 'empty'}><header><strong>{t('report.designer')}</strong><input aria-label={t('report.title')} value={reportDesign.title} onChange={(event) => setReportDesign((current) => ({ ...current, title: event.target.value.slice(0, 120) }))} /><select aria-label={t('report.pageSize')} value={reportDesign.pageSize} onChange={(event) => setReportDesign((current) => ({ ...current, pageSize: event.target.value as ReportDesign['pageSize'] }))}><option>A4</option><option>Letter</option></select><button onClick={saveDesign}>{t('report.saveJson')}</button><label className="rp-file-button">{t('report.loadJson')}<input type="file" accept="application/json,.json" onChange={(event) => void loadDesign(event.target.files?.[0])} /></label><button onClick={() => setDesignMode(false)}>{t('report.closeDesigner')}</button></header><div className="rp-band-list">{REPORT_BANDS.map((band) => <div className="rp-band" key={band} data-testid={`report-band-${bandKey(band)}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const field = event.dataTransfer.getData('text/plain'); if (fields.includes(field)) setReportDesign((current) => placeReportField(current, field, band)) }}><strong>{t(`report.band.${bandKey(band)}`)}</strong><div>{reportDesign.bands[band].map((field) => <span key={field} className="rp-chip">{field}</span>)}</div></div>)}</div><div className="rp-preview-toolbar"><strong>{t('report.page', [String(page + 1), String(reportPages(pivot?.rows ?? [], 20).length)])}</strong><button disabled={page <= 0} onClick={() => setPage((current) => current - 1)}>{t('report.previousPage')}</button><button disabled={page + 1 >= reportPages(pivot?.rows ?? [], 20).length} onClick={() => setPage((current) => current + 1)}>{t('report.nextPage')}</button><button onClick={() => exportDesigned('pdf')}>{t('report.printPdf')}</button><select aria-label={t('report.exportData')} onChange={(event) => { if (event.target.value) exportDesigned(event.target.value as ReportExportFormat); event.target.value = '' }}><option value="">{t('report.exportData')}</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf">PDF</option></select></div><article className="rp-page-preview" data-testid="report-page-preview"><h2>{reportDesign.title}</h2>{REPORT_BANDS.filter((band) => band !== 'Detail').map((band) => reportDesign.bands[band].length > 0 && <p key={band}><small>{t(`report.band.${bandKey(band)}`)}</small> {reportDesign.bands[band].join(' · ')}</p>)}{pivot && <table><thead><tr>{[...pivot.rowFields, ...pivot.columns.map((column) => column.label)].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{reportPages(pivot.rows, 20)[page]?.map((row) => <tr key={row.key}>{row.values.map((value, index) => <td key={`r${index}`}>{String(value ?? '')}</td>)}{pivot.columns.map((column) => <td key={column.key}>{formatValue(row.cells[column.key])}</td>)}</tr>)}</tbody></table>}</article></section>}
    <p className="rp-status" role="status">{message}</p>
    <style>{`.report-pivot-panel{height:100%;display:flex;flex-direction:column;gap:10px;overflow:auto;color:var(--text)}.rp-header,.rp-actions,.rp-toolbar,.rp-result-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rp-header{justify-content:space-between}.rp-header h2{margin:0}.rp-header p{margin:4px 0;color:var(--text-secondary)}.rp-query-label{display:flex;flex-direction:column;gap:4px}.rp-query-label textarea{font:13px monospace;resize:vertical;background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:8px}.rp-toolbar,.rp-result-toolbar{padding:6px 0;border-block:1px solid var(--border)}.rp-toolbar span,.rp-result-toolbar span{color:var(--text-secondary)}.rp-workspace{display:grid;grid-template-columns:minmax(250px,1fr) minmax(350px,2fr);gap:12px;min-height:180px}.rp-fields,.rp-zones{border:1px solid var(--border);border-radius:5px;padding:8px;overflow:auto}.rp-fields h3,.rp-zones h3{margin:0 0 8px}.rp-field{display:grid;grid-template-columns:minmax(80px,1fr) auto auto;gap:6px;align-items:center;padding:4px;border-bottom:1px solid var(--border)}.rp-date-hierarchy{grid-column:1/-1}.rp-date-hierarchy label{display:inline-flex;align-items:center;gap:3px;margin:2px 5px}.rp-zone-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rp-zone{min-height:48px;padding:7px;border:1px dashed var(--border);background:var(--bg-surface-alt);border-radius:4px}.rp-zone strong{display:block;margin-bottom:5px}.rp-chip{display:inline-block;padding:3px 7px;margin:2px;border-radius:10px;background:var(--accent-soft)}.rp-totals{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.rp-empty{padding:25px;border:1px dashed var(--border);text-align:center;color:var(--text-secondary)}.rp-grid-scroll{overflow:auto;max-height:42vh;border:1px solid var(--border)}.rp-grid{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}.rp-grid th,.rp-grid td{padding:5px 8px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap}.rp-grid th{position:sticky;top:0;background:var(--bg-surface-alt)}.rp-grid td:not(:first-child){text-align:right}.rp-subtotal{font-weight:600;background:var(--bg-surface-alt)}.rp-grand-total{font-weight:700;background:var(--accent-soft)}.rp-chart{width:100%;height:210px;border:1px solid var(--border);background:var(--bg-surface)}.rp-chart text{fill:var(--text-secondary);font:11px sans-serif}.rp-chart-wrap{display:flex;gap:8px;align-items:flex-start}.rp-designer{border:1px solid var(--border);padding:10px;background:var(--bg-surface-alt)}.rp-designer>header,.rp-preview-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.rp-designer input:not([type=file]),.rp-designer select{background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:5px}.rp-file-button{position:relative;border:1px solid var(--border);padding:5px 8px;cursor:pointer}.rp-file-button input{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}.rp-band-list{display:grid;grid-template-columns:1fr 1fr;gap:6px}.rp-band{min-height:44px;border:1px dashed var(--border);padding:6px;background:var(--bg-surface)}.rp-page-preview{background:var(--bg-surface);border:1px solid var(--border);padding:20px;min-height:220px;max-width:900px;margin:auto}.rp-page-preview table{border-collapse:collapse;width:100%}.rp-page-preview th,.rp-page-preview td{border:1px solid var(--border);padding:5px;text-align:left}.rp-status{min-height:1.3em;margin:0;color:var(--text-secondary)}`}</style>
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
