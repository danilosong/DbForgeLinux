export interface DebugRoutineParameter { name: string; type: string; direction: 'IN' | 'OUT' | 'INOUT'; value: string; nullValue: boolean }

/** Reads a procedure argument list without splitting commas inside type declarations. */
export function parseDebugRoutineParameters(createSql: string): DebugRoutineParameter[] {
  const header = /\bPROCEDURE\s+(?:`[^`]+`|[\w$]+)\s*\(/i.exec(createSql)
  if (!header) return []
  const open = header.index + header[0].lastIndexOf('(')
  let depth = 1
  let quote = ''
  let escaped = false
  let close = -1
  for (let index = open + 1; index < createSql.length; index++) {
    const char = createSql[index]!
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '(') depth++
    else if (char === ')' && --depth === 0) { close = index; break }
  }
  if (close < 0) return []
  return splitParameters(createSql.slice(open + 1, close)).flatMap((part) => {
    const match = /^\s*(?:(INOUT|IN|OUT)\s+)?(`?[^`\s]+`?)\s+([\s\S]+?)\s*$/i.exec(part)
    if (!match) return []
    return [{ name: match[2]!.replaceAll('`', ''), type: match[3]!, direction: (match[1]?.toUpperCase() ?? 'IN') as DebugRoutineParameter['direction'], value: '', nullValue: false }]
  })
}

function splitParameters(text: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
    } else if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) { parts.push(text.slice(start, index)); start = index + 1 }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start))
  return parts
}
