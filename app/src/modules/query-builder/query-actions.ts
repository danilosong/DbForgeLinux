import type { QuerySelection } from './types.js'

export function selectAllRowsFromTable(selections: QuerySelection[], tableAlias: string): QuerySelection[] {
  if (!tableAlias) throw new Error('Choose a table first.')
  return selections.map((selection) => ({ ...selection, included: selection.source.table === tableAlias }))
}
