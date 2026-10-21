import type { JoinType, QueryJoin } from './types.js'

export interface DraggedColumn { table: string; column: string }

export function joinFromDraggedColumns(left: DraggedColumn, right: DraggedColumn, type: JoinType): QueryJoin | null {
  if (!left.table || !right.table || !left.column || !right.column || left.table === right.table) return null
  return { leftTable: left.table, rightTable: right.table, type, conditions: type === 'CROSS' ? [] : [{ left, operator: '=', right }] }
}
