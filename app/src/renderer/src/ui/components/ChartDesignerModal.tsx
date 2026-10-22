import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { chartFamilies, findChartFamily } from '../../../../modules/chart-designer/catalog.js'
import { applyChartAction, createChartHistory, createSeriesModel, getChannelValue, redoChart, treeItems, undoChart, type ChartChannel, type ChartDocumentModel, type ChartHistory, type ChartSeriesModel, type ChartSeriesUpdate } from '../../../../modules/chart-designer/model.js'
import { useI18n } from '../i18n/useI18n.js'
import { ChartPreview } from './ChartPreview.js'
import './chart-designer.css'

type DesignerTab = 'Options' | 'Properties' | 'Data'
type PropertyGroup = 'Appearance' | 'Behavior' | 'Data' | 'Elements'

const mappingChannels: Array<{ id: ChartChannel; name: string }> = [
  { id: 'argument', name: 'Argument' }, { id: 'value', name: 'Value' }, { id: 'color', name: 'Color' }, { id: 'size', name: 'Size' },
  { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'open', name: 'Open' },
  { id: 'close', name: 'Closing' }, { id: 'start', name: 'Start' }, { id: 'end', name: 'End' }
]

const propertyGroups: Record<PropertyGroup, string[]> = {
  Appearance: ['Labels Visibility', 'Visible'],
  Behavior: ['Argument Scale Type', 'Value Scale Type', 'Checkable in Legend', 'Checked in Legend', 'Show in Legend', 'Series Points Sorting', 'Crosshair Options', 'Tool Tip Options', 'Top N Options'],
  Data: ['Argument Data Member', 'Value Data Member', 'Color Data Member', 'Filter String', 'Data Sorted', 'Numeric Summary'],
  Elements: ['Label', 'View']
}

export interface ChartDesignerModalProps {
  sourceName: string
  columns: string[]
  rows: Array<Record<string, unknown>>
  totalRows: number
  resultWasTruncated: boolean
  initialDocument?: ChartDocumentModel
  showEveryTime: boolean
  onSave(document: ChartDocumentModel): void
  onCancel(): void
  onPreferenceChange(value: boolean): void
}

function selectedSeries(document: ChartDocumentModel, id: string): ChartSeriesModel | undefined { return document.series.find((series) => series.id === id) }
function serializeSize(value: unknown): string { return value instanceof Date ? value.toISOString() : String(value ?? '') }

export function ChartDesignerModal({ sourceName, columns, rows, totalRows, resultWasTruncated, initialDocument, showEveryTime, onSave, onCancel, onPreferenceChange }: ChartDesignerModalProps): React.JSX.Element {
  const { t } = useI18n()
  const [history, setHistory] = useState<ChartHistory>(() => createChartHistory(initialDocument))
  const [selected, setSelected] = useState('chart')
  const [tab, setTab] = useState<DesignerTab>('Options')
  const [addOpen, setAddOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [gallerySearch, setGallerySearch] = useState('')
  const [propertySearch, setPropertySearch] = useState('')
  const [family, setFamily] = useState('bar')
  const document = history.present
  const series = selectedSeries(document, selected) ?? document.series[0]
  const nodes = treeItems(document)
  const familyItems = chartFamilies.find((item) => item.id === family)?.series ?? []
  const filteredFamilies = chartFamilies.filter((item) => t(item.name).toLocaleLowerCase().includes(gallerySearch.toLocaleLowerCase()) || item.series.some((name) => t(name).toLocaleLowerCase().includes(gallerySearch.toLocaleLowerCase())))
  const visibleProperties = useMemo(() => Object.entries(propertyGroups).map(([group, properties]) => [group as PropertyGroup, properties.filter((property) => t(property).toLocaleLowerCase().includes(propertySearch.toLocaleLowerCase()))] as const).filter(([, properties]) => properties.length), [propertySearch, t])

  function dispatch(action: Parameters<typeof applyChartAction>[1]): void { setHistory((current) => applyChartAction(current, action)) }
  function addSeries(type: string): void {
    const next = createSeriesModel(type, columns, rows, document.series.length + 1)
    dispatch({ type: 'add-series', series: next }); setSelected(next.id); setGalleryOpen(false); setAddOpen(false); setTab('Data')
  }
  function dropColumn(event: DragEvent<HTMLButtonElement>, channel: ChartChannel): void {
    event.preventDefault()
    const column = event.dataTransfer.getData('application/x-tuxsql-chart-column') || event.dataTransfer.getData('text/plain')
    if (column && series) dispatch({ type: 'update-series', id: series.id, update: { mappings: { [channel]: column } } })
  }
  function mapColumn(channel: ChartChannel, column: string): void { if (series) dispatch({ type: 'update-series', id: series.id, update: { mappings: { [channel]: column } } }) }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { if (galleryOpen) setGalleryOpen(false); else onCancel() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); setHistory((current) => undoChart(current)) }
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z')) { event.preventDefault(); setHistory((current) => redoChart(current)) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [galleryOpen, onCancel])

  return <div className="chart-designer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section className="chart-designer-modal" role="dialog" aria-modal="true" aria-labelledby="chart-designer-title" data-testid="chart-designer-modal">
      <header className="chart-designer-titlebar"><h2 id="chart-designer-title">{t('Chart Designer')}</h2><span>{t('Source')}: {sourceName}</span><button type="button" className="chart-close" aria-label={t('Cancel')} onClick={onCancel}>×</button></header>
      <div className="chart-designer-toolbar">
        <div className="chart-add-wrap"><button type="button" aria-expanded={addOpen} onClick={() => setAddOpen((value) => !value)}>＋ {t('Add')} ▾</button>{addOpen && <div className="chart-add-menu" role="menu">
          <strong>{t('Chart Elements')}</strong><button role="menuitem" onClick={() => { setGalleryOpen(true); setAddOpen(false) }}>{t('Series…')}</button><button role="menuitem" onClick={() => { dispatch({ type: 'update-chart', update: { legend: !document.legend } }); setAddOpen(false) }}>{t('Legend')}</button><button role="menuitem" disabled={!series}>{t('Pane')}</button><button role="menuitem" disabled={!series}>{t('Secondary Axis X')}</button><button role="menuitem" disabled={!series}>{t('Secondary Axis Y')}</button><button role="menuitem" onClick={() => { dispatch({ type: 'update-chart', update: { title: document.title || t('Chart Title') } }); setAddOpen(false) }}>{t('Chart Title')}</button><button role="menuitem" onClick={() => { dispatch({ type: 'add-annotation' }); setAddOpen(false) }}>{t('Annotation…')}</button>
          <strong>{t('Series Elements')}</strong><button role="menuitem" disabled={!series} onClick={() => { if (series) dispatch({ type: 'update-series', id: series.id, update: { showInLegend: !series.showInLegend } }); setAddOpen(false) }}>{t('Indicator')}</button><button role="menuitem" disabled={!series} onClick={() => { dispatch({ type: 'add-title' }); setAddOpen(false) }}>{t('Title')}</button>
          <strong>{t('Axis Elements')}</strong><button role="menuitem" disabled={!series}>{t('Constant Line')}</button><button role="menuitem" disabled={!series}>{t('Strip')}</button><button role="menuitem" disabled={!series}>{t('Scale Break')}</button>
        </div>}</div>
        <button type="button" disabled={!history.past.length} onClick={() => setHistory((current) => undoChart(current))}>↶ {t('Undo')}</button><button type="button" disabled={!history.future.length} onClick={() => setHistory((current) => redoChart(current))}>↷ {t('Redo')}</button><button type="button" onClick={() => setGalleryOpen(true)}>✧ {t('Wizard')}</button>
        <span className="chart-toolbar-spacer" />{document.series.length > 0 && <button type="button" className="chart-remove-button" disabled={!series} onClick={() => { if (series) { dispatch({ type: 'remove-series', id: series.id }); setSelected('chart') } }}>{t('Remove selected')}</button>}
      </div>
      <div className="chart-designer-body">
        <nav className="chart-tree" aria-label={t('Chart elements')}>
          {nodes.map((node) => <button type="button" key={node.id} className={`chart-tree-node chart-tree-${node.kind}${selected === node.id ? ' selected' : ''}`} aria-current={selected === node.id ? 'true' : undefined} onClick={() => { setSelected(node.id); if (node.kind === 'series') setTab('Properties') }}><span aria-hidden="true">{node.kind === 'chart' ? '▣' : node.kind === 'series' ? '▥' : node.kind === 'legend' ? '☷' : node.kind === 'title' ? 'T' : node.kind === 'annotation' ? '◆' : '⌄'}</span>{node.id === 'chart' || node.id === 'series-group' ? t(node.label.replace(/ \(\d+\)$/, '')) + (node.id === 'series-group' ? ` (${document.series.length})` : '') : node.id === 'additional-legends' ? `${t('Additional Legends')} (${document.additionalLegends.length})` : node.id === 'titles' ? `${t('Titles')} (${document.titles.length})` : node.id === 'annotations' ? `${t('Annotations')} (${document.annotations.length})` : node.label}</button>)}
        </nav>
        <main className="chart-designer-preview"><ChartPreview document={document} rows={rows} totalRows={totalRows} resultWasTruncated={resultWasTruncated} label={(key) => t(key)} /></main>
        <aside className="chart-designer-side"><div className="chart-designer-tabs" role="tablist" aria-label={t('Chart settings')}>{(['Options', 'Properties', 'Data'] as const).map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{t(item)}</button>)}</div>
          {tab === 'Options' && <div className="chart-designer-pane" role="tabpanel"><fieldset><legend>{t('Appearance')}</legend><label>{t('Appearance')}<select value={document.appearance} onChange={(event) => dispatch({ type: 'update-chart', update: { appearance: event.target.value } })}>{['Default', 'Dark', 'Clean', 'Classic'].map((item) => <option key={item}>{t(item)}</option>)}</select></label><label>{t('Palette')}<select value={document.palette} onChange={(event) => dispatch({ type: 'update-chart', update: { palette: event.target.value } })}>{['Nature', 'Pastel', 'Office', 'Vibrant', 'Monochrome', 'Devart Default'].map((item) => <option key={item}>{t(item)}</option>)}</select></label><label>{t('Back Color')}<input type="color" value={document.background === 'transparent' ? '#ffffff' : document.background} onChange={(event) => dispatch({ type: 'update-chart', update: { background: event.target.value } })} /></label></fieldset><fieldset><legend>{t('Behavior')}</legend><label className="chart-check"><span>{t('Auto Layout')}</span><input type="checkbox" checked={document.autoLayout} onChange={(event) => dispatch({ type: 'update-chart', update: { autoLayout: event.target.checked } })} /></label></fieldset></div>}
          {tab === 'Data' && <div className="chart-designer-pane chart-data-pane" role="tabpanel"><label>{t('Choose a datasource')}<select aria-label={t('Choose a datasource')} value={sourceName} disabled><option>{sourceName}</option></select></label><p>{t('Drag data members to the corresponding cell to define chart data.')}</p>{series ? <div className="chart-mapping-list">{mappingChannels.filter((channel) => channel.id === 'argument' || channel.id === 'value' || channel.id === 'color' || (series.type === 'Bubble' && channel.id === 'size') || ['range', 'financial', 'gantt'].includes(findChartFamily(series.type)?.id ?? '') && ['low', 'high', 'open', 'close', 'start', 'end'].includes(channel.id)).map((channel) => <button type="button" key={channel.id} className="chart-mapping-row" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropColumn(event, channel.id)}><span>{t(channel.name)}</span><select aria-label={t(channel.name)} value={getChannelValue(series, channel.id)} onChange={(event) => mapColumn(channel.id, event.target.value)}><option value="">{t('Select a column')}</option>{columns.map((column) => <option key={column}>{column}</option>)}</select></button>)}</div> : <p>{t('Add a series to map its data.')}</p>}<div className="chart-data-columns" aria-label={t('Available columns')}>{columns.map((column) => <button type="button" draggable key={column} onDragStart={(event) => { event.dataTransfer.setData('application/x-tuxsql-chart-column', column); event.dataTransfer.setData('text/plain', column) }} onClick={() => { if (series) mapColumn(series.mappings.value ? 'argument' : 'value', column) }}>{column}</button>)}</div>{(totalRows > rows.length || resultWasTruncated) && <p role="status" className="chart-designer-truncation">{t('The result has more rows than the preview can use.')}</p>}</div>}
          {tab === 'Properties' && <div className="chart-designer-pane chart-properties-pane" role="tabpanel"><input type="search" aria-label={t('Search properties')} placeholder={t('Search properties')} value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)} />{visibleProperties.map(([group, properties]) => <fieldset key={group}><legend>{t(group)}</legend>{properties.map((property) => <PropertyControl key={property} property={property} series={series} t={t} onUpdate={(update) => series && dispatch({ type: 'update-series', id: series.id, update })} />)}</fieldset>)}</div>}
        </aside>
      </div>
      <footer className="chart-designer-footer"><label><input type="checkbox" checked={showEveryTime} onChange={(event) => onPreferenceChange(event.target.checked)} />{t('Display the designer every time a new chart is added')}</label><span className="chart-toolbar-spacer" /><button type="button" className="chart-primary" onClick={() => onSave(document)}>{t('OK')}</button><button type="button" onClick={onCancel}>{t('Cancel')}</button></footer>
      {galleryOpen && <div className="chart-gallery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGalleryOpen(false) }}><section className="chart-series-gallery" role="dialog" aria-modal="true" aria-labelledby="chart-gallery-title"><header><h3 id="chart-gallery-title">{t('Series Gallery')}</h3><button type="button" aria-label={t('Close')} onClick={() => setGalleryOpen(false)}>×</button></header><input autoFocus type="search" aria-label={t('Search series')} placeholder={t('Search...')} value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} /><div className="chart-gallery-content"><nav aria-label={t('Series families')}>{filteredFamilies.map((item) => <button type="button" key={item.id} className={family === item.id ? 'selected' : ''} onClick={() => setFamily(item.id)}>{t(item.name)}</button>)}</nav><div className="chart-gallery-items">{(gallerySearch ? filteredFamilies.flatMap((item) => item.series.filter((name) => t(name).toLocaleLowerCase().includes(gallerySearch.toLocaleLowerCase()))) : familyItems).map((type) => <button type="button" key={type} onClick={() => addSeries(type)}><span className="chart-series-thumbnail" aria-hidden="true"><span /></span>{t(type)}</button>)}{!filteredFamilies.length && <p>{t('No matching chart families.')}</p>}</div></div></section></div>}
    </section>
  </div>
}

function PropertyControl({ property, series, t, onUpdate }: { property: string; series?: ChartSeriesModel; t(key: string): string; onUpdate(update: ChartSeriesUpdate): void }): React.JSX.Element {
  if (!series) return <label className="chart-property-row"><span>{t(property)}</span><span>{t('Select a series to edit.')}</span></label>
  if (property === 'Visible') return <label className="chart-property-row"><span>{t(property)}</span><input type="checkbox" checked={series.visible} onChange={(event) => onUpdate({ visible: event.target.checked })} /></label>
  if (property === 'Show in Legend') return <label className="chart-property-row"><span>{t(property)}</span><input type="checkbox" checked={series.showInLegend} onChange={(event) => onUpdate({ showInLegend: event.target.checked })} /></label>
  if (property === 'Labels Visibility') return <label className="chart-property-row"><span>{t(property)}</span><input type="checkbox" checked={series.properties.labelsVisible} onChange={(event) => onUpdate({ properties: { labelsVisible: event.target.checked } })} /></label>
  if (property === 'Numeric Summary') return <label className="chart-property-row"><span>{t(property)}</span><select value={series.properties.numericSummary} onChange={(event) => onUpdate({ properties: { numericSummary: event.target.value as ChartSeriesModel['properties']['numericSummary'] } })}>{['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].map((item) => <option key={item}>{item}</option>)}</select></label>
  if (property === 'Argument Data Member' || property === 'Value Data Member' || property === 'Color Data Member') return <label className="chart-property-row"><span>{t(property)}</span><span>{serializeSize(series.mappings[property.startsWith('Argument') ? 'argument' : property.startsWith('Value') ? 'value' : 'color'])}</span></label>
  const value = property === 'Tool Tip Options' ? t('Show category and value') : property === 'Argument Scale Type' ? t('Auto') : property === 'Value Scale Type' ? t('Numerical') : property === 'Series Points Sorting' ? t('None') : property === 'Label' ? series.name : property === 'View' ? t('Live preview') : t('Default')
  return <label className="chart-property-row"><span>{t(property)}</span><span>{value}</span></label>
}
