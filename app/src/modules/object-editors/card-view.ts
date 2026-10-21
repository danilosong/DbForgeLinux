export interface CardField { name: string; value: unknown }

export function tableRecordCard(row: Record<string, unknown> | undefined): CardField[] {
  if (!row) return []
  return Object.entries(row).map(([name, value]) => ({ name, value }))
}

export function formatCardValue(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return '—'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
