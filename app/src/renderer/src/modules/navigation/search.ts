export interface TextMatch { offset: number; length: number; line: number; column: number; text: string }

export function findTextMatches(text: string, query: string, options: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean; limit?: number } = {}): TextMatch[] {
  if (!query) return []
  const limit = Math.max(1, Math.min(options.limit ?? 5000, 10000))
  let expression: RegExp
  try {
    const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expression = new RegExp(options.wholeWord ? `\\b(?:${source})\\b` : source, `${options.caseSensitive ? 'g' : 'gi'}m`)
  } catch { return [] }
  const matches: TextMatch[] = []
  for (const match of text.matchAll(expression)) {
    const offset = match.index ?? 0
    const before = text.slice(0, offset)
    const line = before.split('\n').length
    const column = offset - before.lastIndexOf('\n')
    matches.push({ offset, length: match[0].length, line, column, text: text.split('\n')[line - 1]?.trim() ?? '' })
    if (matches.length >= limit) break
    if (!match[0].length) expression.lastIndex++
  }
  return matches
}
