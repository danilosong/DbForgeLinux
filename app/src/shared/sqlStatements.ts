export interface SqlStatementRange { start: number; end: number; sql: string }

export function splitSqlStatements(source: string): SqlStatementRange[] {
  const ranges: SqlStatementRange[] = []
  let start = 0
  let quote: "'" | '"' | '`' | null = null
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1 }
      continue
    }
    if (quote) {
      if (char === '\\') { index += 1; continue }
      if (char === quote && next === quote) { index += 1; continue }
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue }
    if (char === '#' || (char === '-' && next === '-' && (!source[index + 2] || /\s/.test(source[index + 2])))) { lineComment = true; if (char === '-') index += 1; continue }
    if (char === ';') { pushRange(ranges, source, start, index); start = index + 1 }
  }
  pushRange(ranges, source, start, source.length)
  return ranges
}

export function statementAtOffset(source: string, offset: number): SqlStatementRange | undefined {
  const position = Math.max(0, Math.min(source.length, offset))
  return splitSqlStatements(source).find(({ start, end }) => position >= start && position <= end && source.slice(start, end).trim().length > 0)
    ?? splitSqlStatements(source).filter(({ end, sql }) => end <= position && sql.trim()).at(-1)
}

function pushRange(ranges: SqlStatementRange[], source: string, start: number, end: number): void {
  const sql = source.slice(start, end).trim()
  if (sql) ranges.push({ start, end, sql })
}
