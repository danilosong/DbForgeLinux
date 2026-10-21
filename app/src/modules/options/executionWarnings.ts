import { splitSqlStatements, type SqlStatementRange } from '../../shared/sqlStatements.js'

export type DangerousStatementKind = 'truncate' | 'delete' | 'update'

export function warningSuppressedAt(source: string, offset: number): boolean {
  const lines = maskSqlLiteralsAndBlocks(source.slice(0, Math.max(0, offset))).split(/\r?\n/)
  let suppressed = false
  for (const line of lines) {
    const directive = /^\s*--\s*(nowarn|endnowarn)\s*$/i.exec(line)?.[1]?.toLowerCase()
    if (directive === 'nowarn') suppressed = true
    if (directive === 'endnowarn') suppressed = false
  }
  return suppressed
}

export function findDangerousStatements(source: string, maximumScriptKb: number): Array<{ statement: SqlStatementRange; kind: DangerousStatementKind }> {
  if (new TextEncoder().encode(source).length > maximumScriptKb * 1024) return []
  const result: Array<{ statement: SqlStatementRange; kind: DangerousStatementKind }> = []
  for (const statement of splitSqlStatements(source)) {
    const executable = statement.sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\r\n]*(?:\r?\n|$)/gm, '').trim()
    const keyword = /^(TRUNCATE|DELETE|UPDATE)\b/i.exec(executable)
    if (!keyword) continue
    const keywordOffset = source.indexOf(keyword[1]!, statement.start)
    if (warningSuppressedAt(source, keywordOffset)) continue
    result.push({ statement, kind: keyword[1]!.toLowerCase() as DangerousStatementKind })
  }
  return result
}

function maskSqlLiteralsAndBlocks(source: string): string {
  const chars = source.split('')
  let quote = ''
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    if (quote) {
      if (char === '\\') { if (index + 1 < chars.length && chars[index + 1] !== '\n') chars[index + 1] = ' '; chars[index] = ' '; index++; continue }
      if (char === quote) {
        if (chars[index + 1] === quote) { chars[index] = ' '; chars[index + 1] = ' '; index++; continue }
        quote = ''
      }
      if (char !== '\n' && char !== '\r') chars[index] = ' '
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; chars[index] = ' '; continue }
    if (char === '/' && chars[index + 1] === '*') {
      chars[index] = ' '; chars[index + 1] = ' '; index += 2
      while (index < chars.length) { if (chars[index] === '*' && chars[index + 1] === '/') { chars[index] = ' '; chars[index + 1] = ' '; index++; break }; if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' '; index++ }
    }
  }
  return chars.join('')
}
