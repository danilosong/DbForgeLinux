type Listener = (columns: string[], rows: Array<Record<string, unknown>>) => void
let current: { columns: string[]; rows: Array<Record<string, unknown>> } = { columns: [], rows: [] }
const listeners = new Set<Listener>()

export function setSelectedGridRows(columns: string[], rows: Array<Record<string, unknown>>): void {
  current = { columns: [...columns], rows: rows.slice(0, 500).map((row) => ({ ...row })) }
  for (const listener of listeners) listener(current.columns, current.rows)
  window.dispatchEvent(new CustomEvent('tuxsql:grid-selection', { detail: current }))
}

export function getSelectedGridRows(): { columns: string[]; rows: Array<Record<string, unknown>> } { return current }

export function subscribeSelectedGridRows(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
