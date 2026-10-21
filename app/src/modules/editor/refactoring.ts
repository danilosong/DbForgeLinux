import type { EditorMetadata } from '../../shared/contracts/editor.js'
import { sqlKeywords } from './completion.js'

export function transformIdentifiers(sql: string, mode: 'add-backticks' | 'remove-backticks'): string {
  const tokens = tokenizeIdentifiers(sql)
  return tokens.map((token) => {
    if (!token.identifier) return token.value
    const plain = token.value.replaceAll('`', '')
    if (mode === 'add-backticks') return token.quoted || sqlKeywords.has(plain.toLowerCase()) ? token.value : `\`${plain.replaceAll('`', '``')}\``
    return token.quoted && !sqlKeywords.has(plain.toLowerCase()) && /^[A-Za-z_$][\w$]*$/.test(plain) ? plain : token.value
  }).join('')
}

export function qualifyObjectNames(sql: string, metadata: EditorMetadata): string {
  const tokens = tokenizeIdentifiers(sql)
  return tokens.map((token, index) => {
    if (!token.identifier || tokens[index - 1]?.value === '.') return token.value
    const plain = token.value.replaceAll('`', '')
    const object = metadata.objects.find((item) => item.name.toLowerCase() === plain.toLowerCase())
    return object ? `${metadata.database ? `\`${metadata.database.replaceAll('`', '``')}\`.` : ''}\`${object.name.replaceAll('`', '``')}\`` : token.value
  }).join('')
}

export function expandSqlWildcards(sql: string, metadata: EditorMetadata): string {
  const tables = [...sql.matchAll(/\b(?:FROM|JOIN)\s+(?:`?[\w$]+`?\.)?(`?[\w$]+`?)(?:\s+(?:AS\s+)?(`?[\w$]+`?))?/gi)]
  const aliases = new Map<string, string>()
  for (const match of tables) {
    const objectName = match[1]?.replaceAll('`', '')
    const aliasCandidate = match[2]?.replaceAll('`', '')
    const alias = aliasCandidate && !/^(WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP|ORDER|LIMIT|HAVING|USE|FOR|LOCK)$/i.test(aliasCandidate) ? aliasCandidate : objectName
    if (objectName && alias) aliases.set(alias.toLowerCase(), objectName)
  }
  let result = sql
  for (const [alias, objectName] of aliases) {
    const object = metadata.objects.find((item) => item.name.toLowerCase() === objectName.toLowerCase())
    if (!object?.columns.length) continue
    const columns = object.columns.map((column) => `${alias}.${column.name}`).join(',\n       ')
    result = result.replace(new RegExp(`\\b${alias}\\s*\\.\\s*\\*`, 'i'), columns)
  }
  if (aliases.size === 1) {
    const [alias, objectName] = [...aliases.entries()][0]!
    const object = metadata.objects.find((item) => item.name.toLowerCase() === objectName.toLowerCase())
    if (object?.columns.length) result = result.replace(/\bSELECT\s+\*\s+(?=FROM\b)/i, `SELECT ${object.columns.map((column) => `${alias}.${column.name}`).join(',\n       ')} `)
  }
  return result
}

interface Token { value: string; identifier: boolean; quoted?: boolean }
function tokenizeIdentifiers(source: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)
    const opaque = /^(?:--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|''|[^'])*'|"(?:\\.|""|[^"])*")/.exec(rest)
    if (opaque) { out.push({ value: opaque[0], identifier: false }); i += opaque[0].length; continue }
    if (source[i] === '`') {
      let end = i + 1
      while (end < source.length) { if (source[end] === '`' && source[end + 1] === '`') { end += 2; continue }; if (source[end] === '`') { end++; break }; end++ }
      out.push({ value: source.slice(i, end), identifier: true, quoted: true }); i = end; continue
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)
    if (word) { out.push({ value: word[0], identifier: true }); i += word[0].length; continue }
    out.push({ value: source[i]!, identifier: false }); i++
  }
  return out
}
