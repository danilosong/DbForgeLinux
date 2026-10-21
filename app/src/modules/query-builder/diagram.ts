import type { QueryTable } from './types.js'

export function columnPortY(table: QueryTable, columnName?: string, cardTop = 0): number {
  const index = Math.max(0, table.columns.findIndex((column) => column.name === columnName))
  // Table header, select-all row, then one 24px row per column.
  return cardTop + 75 + index * 24
}

export function joinPortXs(leftTableX: number, rightTableX: number, cardWidth = 260): { startX: number; endX: number } {
  if (leftTableX <= rightTableX) return { startX: leftTableX + cardWidth, endX: rightTableX }
  return { startX: leftTableX, endX: rightTableX + cardWidth }
}

export function joinPath(startX: number, startY: number, endX: number, endY: number): string {
  const controlX = (startX + endX) / 2
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`
}
