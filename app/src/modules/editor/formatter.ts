const keywordSet = new Set('SELECT FROM WHERE GROUP BY ORDER BY HAVING LIMIT OFFSET JOIN LEFT JOIN RIGHT JOIN INNER JOIN OUTER JOIN CROSS JOIN ON AND OR UNION UNION ALL INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER TABLE DROP TABLE AS DISTINCT CASE WHEN THEN ELSE END IS NOT NULL IN EXISTS ASC DESC'.split(' '))
const clauseTokens = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'VALUES', 'SET', 'UNION', 'UNION ALL'])
const joinTokens = new Set(['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN'])

interface Token { value: string; kind: 'word' | 'space' | 'literal' | 'comment' | 'symbol' }

export function formatSql(source: string): string {
  const tokens = tokenize(source.trim())
  const output: string[] = []
  let depth = 0
  let lineStart = true
  let pendingSpace = false
  let continuationLine = false
  const currentLine = (): string => output.join('').split('\n').at(-1) ?? ''
  const append = (value: string): void => {
    if (lineStart && value !== '\n') { output.push('  '.repeat(Math.max(0, depth + (continuationLine ? 1 : 0)))); lineStart = false; continuationLine = false }
    if (pendingSpace && currentLine() && !currentLine().endsWith(' ') && value !== '\n') output.push(' ')
    output.push(value); pendingSpace = false
    if (value.endsWith('\n')) lineStart = true
  }
  const newline = (continued = false): void => {
    while (output.length && output.at(-1) === ' ') output.pop()
    if (output.length && !output.at(-1)?.endsWith('\n')) output.push('\n')
    lineStart = true; pendingSpace = false; continuationLine = continued
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.kind === 'space') { pendingSpace = true; continue }
    if (token.kind === 'comment') { if (currentLine().trim()) newline(); append(token.value); newline(); continue }
    if (token.kind === 'word') {
      const nextWord = tokens[index + 1]?.kind === 'space' ? tokens[index + 2] : tokens[index + 1]
      const pair = `${token.value.toUpperCase()} ${nextWord?.kind === 'word' ? nextWord.value.toUpperCase() : ''}`
      const paired = ['GROUP BY', 'ORDER BY', 'UNION ALL', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN'].includes(pair)
      const keyword = paired ? pair : token.value.toUpperCase()
      if (clauseTokens.has(keyword) || joinTokens.has(keyword) || (keyword === 'ON' && depth === 0)) newline()
      else if ((keyword === 'AND' || keyword === 'OR') && depth === 0) newline(true)
      if (paired) { append(keyword); index += 2; continue }
      append(keywordSet.has(keyword) ? keyword : token.value)
      continue
    }
    if (token.value === '(') { append('('); depth += 1; pendingSpace = false; continue }
    if (token.value === ')') { depth = Math.max(0, depth - 1); pendingSpace = false; append(')'); continue }
    if (token.value === ',') { append(','); if (depth === 0) newline(true); else pendingSpace = true; continue }
    if (token.value === ';') { append(';'); newline(); continue }
    if (token.value === '*' && currentLine().endsWith('(')) { append(token.value); continue }
    if (['=', '<', '>', '+', '-', '*', '/'].includes(token.value)) { pendingSpace = true; append(token.value); pendingSpace = true; continue }
    append(token.value)
  }
  return output.join('').trim()
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const space = /^\s+/.exec(rest)
    if (space) { tokens.push({ value: space[0], kind: 'space' }); index += space[0].length; continue }
    const comment = /^(?:--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/.exec(rest)
    if (comment) { tokens.push({ value: comment[0], kind: 'comment' }); index += comment[0].length; continue }
    const quote = rest[0]
    if (quote === "'" || quote === '"' || quote === '`') {
      let end = 1
      while (end < rest.length) {
        if (rest[end] === '\\') { end += 2; continue }
        if (rest[end] === quote && rest[end + 1] === quote) { end += 2; continue }
        if (rest[end] === quote) { end += 1; break }
        end += 1
      }
      tokens.push({ value: rest.slice(0, end), kind: 'literal' }); index += end; continue
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)
    if (word) { tokens.push({ value: word[0], kind: 'word' }); index += word[0].length; continue }
    tokens.push({ value: rest[0], kind: 'symbol' }); index += 1
  }
  return tokens
}
