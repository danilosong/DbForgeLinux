function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function interpolate(template: string, values: readonly string[]): string {
  return template.replace(/\{(\d+)\}/g, (token, index: string) => values[Number(index)] ?? token)
}

/** Translates an exact message or an English message template containing {0}, {1}, … placeholders. */
export function translateMessage(message: string, catalog: Record<string, string>, values: readonly string[] = [], fallback: Record<string, string> = {}): string {
  const direct = catalog[message] ?? fallback[message]
  if (direct !== undefined) return interpolate(direct, values)

  for (const [source, translated] of Object.entries(catalog)) {
    const pieces = source.split(/\{\d+\}/g)
    if (pieces.length === 1) continue
    const expression = new RegExp(`^${pieces.map(escapeRegExp).join('([\\s\\S]*?)')}$`)
    const match = expression.exec(message)
    if (!match) continue
    const captures = match.slice(1)
    return translated.replace(/\{(\d+)\}/g, (token, index: string) => captures[Number(index)] ?? token)
  }

  return interpolate(message, values)
}
