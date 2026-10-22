import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, CandlestickChart, CustomChart, FunnelChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, PolarComponent, RadarComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { ChartDocumentModel } from '../../../../modules/chart-designer/model.js'
import { buildChartOption } from '../../../../modules/chart-designer/echartsOption.js'

echarts.use([BarChart, CandlestickChart, CustomChart, FunnelChart, LineChart, PieChart, RadarChart, ScatterChart, GridComponent, LegendComponent, PolarComponent, RadarComponent, TitleComponent, TooltipComponent, SVGRenderer])

export function ChartPreview({ document, rows, totalRows, resultWasTruncated, label }: { document: ChartDocumentModel; rows: readonly Record<string, unknown>[]; totalRows: number; resultWasTruncated: boolean; label: (key: string) => string }): React.JSX.Element {
  const element = useRef<HTMLDivElement>(null)
  const visibleSeries = document.series.some((series) => series.visible)
  const built = buildChartOption(document, rows, totalRows, resultWasTruncated)
  useEffect(() => {
    if (!element.current || !visibleSeries) return
    const chart = echarts.init(element.current, undefined, { renderer: 'svg', useDirtyRect: true })
    chart.setOption(built.option, { notMerge: true, lazyUpdate: false })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [built.option, visibleSeries])
  if (!visibleSeries) return <div className="chart-designer-empty">{label('There are no visible series in the chart...')}</div>
  return <div className="chart-designer-preview-frame"><div ref={element} className="chart-designer-echarts" role="img" aria-label={label('Live chart preview')} />{built.truncated && <p role="status" className="chart-designer-truncation">{label('The preview is limited to {0} points. Some rows are not shown.').replace('{0}', '50,000')}</p>}</div>
}
