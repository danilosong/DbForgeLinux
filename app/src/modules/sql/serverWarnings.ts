export interface ServerWarningRow { Level?: unknown; Code?: unknown; Message?: unknown }

export function formatServerWarnings(rows: readonly ServerWarningRow[], statementNumber: number): string[] {
  return rows.map((row) => {
    const level = String(row.Level ?? 'Warning')
    const code = row.Code === undefined ? '' : ` ${String(row.Code)}`
    const message = String(row.Message ?? 'Server reported a warning.')
    return `Warning · statement ${statementNumber} · ${level}${code}: ${message}`
  })
}
