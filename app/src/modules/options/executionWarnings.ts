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

/**
 * Gate for the editor's "destructive statement" confirmation. Comments and literals are blanked
 * first, so a commented-out filter (`DELETE FROM t -- WHERE id = 5`) or the word "where" inside a
 * string still counts as a statement without WHERE. The body of a MySQL executable comment
 * (slash-star-bang) stays code, because the server runs it.
 */
export function isDestructiveStatement(sql: string): boolean {
  return destructiveStatementKind(sql) !== undefined
}

export type DestructiveStatementKind = 'drop' | 'truncate' | 'delete' | 'update'

export function destructiveStatementKind(sql: string): DestructiveStatementKind | undefined {
  const code = maskSqlCommentsAndLiterals(sql).replace(/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/gi, ' ')
  if (/\bDROP\b/i.test(code)) return 'drop'
  if (/\bTRUNCATE\b/i.test(code)) return 'truncate'
  if (!/\bWHERE\b/i.test(code)) {
    if (/\bDELETE\b/i.test(code)) return 'delete'
    if (/\bUPDATE\b/i.test(code)) return 'update'
  }
  return undefined
}

export function maskSqlCommentsAndLiterals(source: string): string {
  const chars = source.split('')
  const blank = (from: number, to: number): void => { for (let index = from; index < to && index < chars.length; index++) if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ' }
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    if (char === "'" || char === '"' || char === '`') {
      let end = index + 1
      while (end < chars.length) {
        if (chars[end] === '\\' && char !== '`') { end += 2; continue }
        if (chars[end] === char) { if (chars[end + 1] === char) { end += 2; continue } break }
        end++
      }
      blank(index, end + 1); index = end; continue
    }
    if (char === '/' && chars[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2)
      if (chars[index + 2] === '!') {
        // Executable comment: drop only its delimiters and keep scanning the body as code.
        blank(index, index + 3); if (close >= 0) blank(close, close + 2)
        index += 2; continue
      }
      const end = close < 0 ? chars.length : close + 2
      blank(index, end); index = end - 1; continue
    }
    if (char === '#' || (char === '-' && chars[index + 1] === '-' && (index + 2 >= chars.length || /\s/.test(chars[index + 2]!)))) {
      let end = index
      while (end < chars.length && chars[end] !== '\n') end++
      blank(index, end); index = end
    }
  }
  return chars.join('')
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
