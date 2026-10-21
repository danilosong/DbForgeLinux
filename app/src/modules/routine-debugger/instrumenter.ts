export interface InstrumentedRoutine { sql: string; statementLines: number[]; variables: string[] }

/** Instruments top-level procedure statements without rewriting their SQL text. */
export function instrumentProcedure(createSql: string, debugSchema = 'dbforge_linux_debug'): InstrumentedRoutine {
  return instrumentObject(createSql, 'PROCEDURE', debugSchema)
}

/** Instruments a trigger body. Trigger execution is driven by a user-supplied DML statement. */
export function instrumentTrigger(createSql: string, debugSchema = 'dbforge_linux_debug'): InstrumentedRoutine {
  return instrumentObject(createSql, 'TRIGGER', debugSchema)
}

function instrumentObject(createSql: string, kind: 'PROCEDURE' | 'TRIGGER', debugSchema: string): InstrumentedRoutine {
  if (!new RegExp(`^\\s*CREATE\\s+(?:DEFINER\\s*=\\s*[^\\s]+\\s+)?${kind}\\b`, 'i').test(createSql)) throw new Error(`Only stored ${kind.toLowerCase()}s can be compiled for debugging.`)
  if (/\b(?:PREPARE|EXECUTE|DEALLOCATE\s+PREPARE)\b/i.test(stripCommentsAndStrings(createSql))) throw new Error('SQL dynamic (PREPARE/EXECUTE) is not supported by the routine debugger.')
  const tokens = tokenize(createSql)
  const begin = tokens.find((token) => token.word === 'BEGIN')
  if (!begin && kind === 'PROCEDURE') throw new Error('Procedure body must use a BEGIN ... END block.')
  if (!begin && kind === 'TRIGGER') {
    const row = tokens.find((token) => token.word === 'ROW')
    if (!row) throw new Error('Trigger body must follow FOR EACH ROW.')
    const bodyStart = row.end
    const bodyTokens = tokens.filter((token) => token.start >= bodyStart)
    const first = bodyTokens.find((token) => token.word || token.symbol)
    if (!first) throw new Error('Trigger has no executable statement.')
    const line = lineAt(createSql, first.start)
    const injection = `CALL \`${debugSchema.replaceAll('`', '``')}\`.checkpoint(@dbforge_linux_debug_id, ${line}, JSON_OBJECT());\n`
    return { sql: `${createSql.slice(0, first.start)}${injection}${createSql.slice(first.start)}`, statementLines: [line], variables: [] }
  }
  if (!begin) throw new Error('Routine body could not be parsed.')
  const bodyEnd = findOuterEnd(tokens, tokens.indexOf(begin))
  if (!bodyEnd) throw new Error('Could not parse the outer procedure block.')

  const bodyStart = begin.end
  const bodyFinish = bodyEnd.start
  const bodyTokens = tokens.filter((token) => token.start >= bodyStart && token.end <= bodyFinish)
  const declarations: Array<{ start: number; end: number }> = []
  const variables = new Set<string>()
  let nestedDepth = 0
  let statementStart = bodyStart
  const injections: Array<{ at: number; text: string }> = []
  const statementLines: number[] = []
  const startStatement = (start: number, end: number): void => {
    const source = createSql.slice(start, end)
    const firstOffset = start + source.length - source.trimStart().length
    const first = source.trimStart()
    if (!first || /^DECLARE\b/i.test(first) || /^END\b/i.test(first)) return
    const line = lineAt(createSql, firstOffset)
    statementLines.push(line)
    injections.push({ at: firstOffset, text: `CALL \`${debugSchema.replaceAll('`', '``')}\`.checkpoint(@dbforge_linux_debug_id, ${line}, ${variablesJson(variables)});\n` })
  }

  for (let index = 0; index < bodyTokens.length; index++) {
    const token = bodyTokens[index]!
    if (token.symbol === ';') {
      if (nestedDepth === 0) { startStatement(statementStart, token.start); statementStart = token.end }
      continue
    }
    if (token.word === 'DECLARE' && nestedDepth === 0 && !createSql.slice(statementStart, token.start).trim()) {
      const nextSemi = bodyTokens.find((candidate) => candidate.start > token.start && candidate.symbol === ';')
      if (nextSemi) {
        const declaration = createSql.slice(token.start, nextSemi.start)
        for (const variable of declaredVariables(declaration)) variables.add(variable)
        declarations.push({ start: token.start, end: nextSemi.end })
      }
    }
    if (token.word === 'END') {
      const closingKind = bodyTokens[index + 1]?.word
      if (['IF', 'CASE', 'LOOP', 'WHILE', 'REPEAT'].includes(closingKind ?? '')) index++
      if (nestedDepth > 0) nestedDepth--
    } else if (token.word === 'BEGIN' || token.word === 'LOOP' || token.word === 'REPEAT' || token.word === 'IF' && hasThenBeforeSemicolon(bodyTokens, index) || token.word === 'WHILE' && hasDoBeforeSemicolon(bodyTokens, index)) nestedDepth++
    else if (token.word === 'CASE' && bodyTokens[index + 1]?.word === 'WHEN') {
      // CASE expressions do not own statement separators; CASE control blocks are uncommon in procedure bodies.
    }
  }
  if (!statementLines.length) throw new Error('There is no executable code to debug.')
  if (statementLines.length > 500) throw new Error('Routine debugger supports up to 500 executable statements per object.')
  const sql = applyInsertions(createSql, injections)
  return { sql, statementLines, variables: [...variables] }
}

interface Token { start: number; end: number; word?: string; symbol?: string }
function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]!
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '-' && sql[i + 1] === '-') { i += 2; while (i < sql.length && sql[i] !== '\n') i++; continue }
    if (ch === '#') { while (i < sql.length && sql[i] !== '\n') i++; continue }
    if (ch === '/' && sql[i + 1] === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i = Math.min(sql.length, i + 2); continue }
    if (ch === '\'' || ch === '"' || ch === '`') { const quote = ch; i++; while (i < sql.length) { if (sql[i] === '\\') i += 2; else if (sql[i] === quote) { if (sql[i + 1] === quote) i += 2; else { i++; break } } else i++ } continue }
    if (/[A-Za-z_$]/.test(ch)) { const start = i++; while (i < sql.length && /[\w$]/.test(sql[i]!)) i++; tokens.push({ start, end: i, word: sql.slice(start, i).toUpperCase() }); continue }
    tokens.push({ start: i, end: i + 1, symbol: ch }); i++
  }
  return tokens
}
function findOuterEnd(tokens: Token[], startIndex: number): Token | undefined {
  let depth = 0
  for (let index = startIndex; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token.word === 'END') {
      const closingKind = tokens[index + 1]?.word
      if (['IF', 'CASE', 'LOOP', 'WHILE', 'REPEAT'].includes(closingKind ?? '')) { index++; continue }
      if (--depth === 0) return token
    } else if (token.word === 'BEGIN') depth++
  }
  return undefined
}
function hasThenBeforeSemicolon(tokens: Token[], start: number): boolean { return tokens.slice(start + 1).some((token) => token.symbol === ';' ? false : token.word === 'THEN') }
function hasDoBeforeSemicolon(tokens: Token[], start: number): boolean { return tokens.slice(start + 1).some((token) => token.symbol === ';' ? false : token.word === 'DO') }
function declaredVariables(statement: string): string[] {
  if (/\b(?:CONDITION|CURSOR|HANDLER)\b/i.test(statement)) return []
  const names = /^DECLARE\s+(.+?)\s+(?:CONDITION|CURSOR|HANDLER|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIT|BOOL|BOOLEAN|SERIAL|DATE|TIME|DATETIME|TIMESTAMP|YEAR|CHAR|VARCHAR|BINARY|VARBINARY|TINYBLOB|BLOB|MEDIUMBLOB|LONGBLOB|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|ENUM|SET|JSON)\b/i.exec(statement)
  if (!names) return []
  return names[1]!.split(',').map((part) => part.trim().replace(/^`|`$/g, '').replaceAll('``', '`')).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
}
function variablesJson(variables: Set<string>): string {
  const items = [...variables].flatMap((name) => [`'${name.replaceAll("'", "''")}'`, `\`${name.replaceAll('`', '``')}\``])
  return items.length ? `JSON_OBJECT(${items.join(', ')})` : 'JSON_OBJECT()'
}
function applyInsertions(sql: string, items: Array<{ at: number; text: string }>): string {
  return items.sort((a, b) => b.at - a.at).reduce((result, item) => `${result.slice(0, item.at)}${item.text}${result.slice(item.at)}`, sql)
}
function lineAt(sql: string, offset: number): number { return sql.slice(0, offset).split('\n').length }
function stripCommentsAndStrings(sql: string): string { return tokenize(sql).map((token) => token.word ?? token.symbol ?? '').join(' ') }
