export function quoteIdentifier(value: string): string {
  if (!value || value.includes('\0')) throw new Error('SQL identifier is invalid.')
  return '`' + value.replaceAll('`', '``') + '`'
}

export function qualifiedName(database: string, name: string): string {
  return `${quoteIdentifier(database)}.${quoteIdentifier(name)}`
}

export function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

export function normalizeSql(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().replace(/;$/, '').toLowerCase()
}
