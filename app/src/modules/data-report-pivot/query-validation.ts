import { splitSqlStatements } from '../../shared/sqlStatements.js'

/** Accept one read-only SELECT suitable for reports; block server-side file writes and locking reads. */
export function validateReportQuery(query: string): void {
  const statements = splitSqlStatements(query).map((item) => item.sql.trim()).filter(Boolean)
  if (statements.length !== 1 || !/^SELECT\b/i.test(statements[0]!)) {
    throw new Error('Report Pivot accepts one SELECT statement at a time.')
  }

  const executable = sqlCodeWithoutStringsOrComments(statements[0]!)
  if (/\bINTO\s+(?:OUTFILE|DUMPFILE)\b|\bFOR\s+UPDATE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b/i.test(executable)) {
    throw new Error('Report Pivot accepts read-only SELECT queries without file output or row locks.')
  }
}

function sqlCodeWithoutStringsOrComments(sql: string): string {
  let result = ''
  let quote = ''
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]!
    const next = sql[index + 1] ?? ''
    if (quote) {
      if (char === quote && next === quote) { result += '  '; index++; continue }
      if (char === '\\' && quote !== '`') { result += '  '; index++; continue }
      if (char === quote) quote = ''
      result += ' '
      continue
    }
    if ((char === '-' && next === '-' && (index + 2 >= sql.length || /\s/.test(sql[index + 2]!))) || char === '#') {
      while (index < sql.length && sql[index] !== '\n') { result += ' '; index++ }
      result += '\n'
      continue
    }
    if (char === '/' && next === '*') {
      const executableComment = sql[index + 2] === '!'
      index += executableComment ? 2 : 1
      if (!executableComment) {
        while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) { result += sql[index] === '\n' ? '\n' : ' '; index++ }
        if (index < sql.length) { result += '  '; index++ }
      }
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; result += ' '; continue }
    result += char
  }
  return result
}
