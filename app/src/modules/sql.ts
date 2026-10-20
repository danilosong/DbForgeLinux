export type SqlRow = Record<string, unknown>

export interface SqlClient {
  query(sql: string, parameters?: readonly unknown[]): Promise<SqlRow[]>
  execute(sql: string): Promise<void>
}

export function quoteIdentifier(value: string): string {
  if (!value || value.includes('\0')) throw new Error('Identificador SQL inválido.')
  return '`' + value.replaceAll('`', '``') + '`'
}

export function quoteString(value: string): string {
  if (value.includes('\0')) throw new Error('Literal SQL inválido.')
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
}

export function accountName(user: string, host = '%'): string {
  return `${quoteString(user)}@${quoteString(host)}`
}

export function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

export function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}

export function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
