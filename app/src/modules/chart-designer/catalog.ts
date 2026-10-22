export interface ChartFamily {
  id: string
  name: string
  series: readonly string[]
}

export const chartFamilies: readonly ChartFamily[] = [
  { id: 'bar', name: 'Bar', series: ['Bar', 'Bar Stacked', 'Bar Stacked 100%', 'Side By Side Bar Stacked', 'Side By Side Bar Stacked 100%', 'Waterfall'] },
  { id: 'point-bubble', name: 'Point and Bubble', series: ['Point', 'Bubble', 'Swift Point'] },
  { id: 'line', name: 'Line', series: ['Line', 'Line Stacked', 'Line Stacked 100%', 'Step Line', 'Spline', 'Scatter Line', 'Swift Plot'] },
  { id: 'area', name: 'Area', series: ['Area', 'Area Stacked', 'Area Stacked 100%', 'Area Step', 'Area Step Stacked (100%)', 'Step Area', 'Spline Area', 'Spline Area Stacked (100%)'] },
  { id: 'range', name: 'Range', series: ['Range Bar', 'Side By Side Range Bar', 'Range Area'] },
  { id: 'pie-doughnut', name: 'Pie and Doughnut', series: ['Pie', 'Doughnut', 'Nested Doughnut'] },
  { id: 'funnel', name: 'Funnel', series: ['Funnel'] },
  { id: 'radar', name: 'Radar', series: ['Radar Point', 'Radar Line', 'Scatter Radar Line', 'Radar Area', 'Radar Range Area'] },
  { id: 'polar', name: 'Polar', series: ['Polar Point', 'Polar Line', 'Scatter Polar Line', 'Polar Area', 'Polar Range Area'] },
  { id: 'financial', name: 'Financial', series: ['Stock', 'Candle Stick'] },
  { id: 'gantt', name: 'Gantt', series: ['Gantt', 'Side By Side Gantt'] }
]

export const allChartSeries = chartFamilies.flatMap((family) => family.series.map((name) => ({ name, family: family.id })))

export function findChartFamily(seriesName: string): ChartFamily | undefined {
  return chartFamilies.find((family) => family.series.includes(seriesName))
}
