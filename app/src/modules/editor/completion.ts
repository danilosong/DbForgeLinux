import type { EditorMetadata } from '../../shared/contracts/editor.js'
import { sqlSnippets } from './snippets.js'
import type { SqlSnippet } from './snippets.js'

export type SqlSuggestionKind = 'database' | 'table' | 'column' | 'routine' | 'keyword' | 'snippet'
export interface SqlSuggestion { label: string; insertText: string; detail: string; kind: SqlSuggestionKind; schema?: string }
export interface SqlCompletionOptions {
  filter?: 'prefix' | 'substring' | 'camelCase'
  sortKeywords?: boolean
  autoAlias?: boolean
  aliasUppercase?: boolean
  aliasUseAs?: boolean
  aliasQualifier?: 'object' | 'schema-object' | 'none'
  qualifyColumnWithAlias?: boolean
  identifierQuoting?: 'always' | 'reserved' | 'needed'
  aliasRules?: Array<{ condition: string; action: 'none' | 'short' | 'full' }>
}

const keywords = 'ADD ALL ALTER AND AS ASC BEGIN BETWEEN BY CALL CASE CHANGE CHAR CHARACTER CHECK COLLATE COLUMN COMMIT CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIMESTAMP DATABASE DATABASES DEFAULT DELETE DESC DISTINCT DROP ELSE END ESCAPE EXISTS FALSE FETCH FOR FOREIGN FROM FULLTEXT FUNCTION GRANT GROUP HAVING IF IN INDEX INNER INSERT INTERVAL INTO IS JOIN KEY LEFT LIKE LIMIT LOCK LONGTEXT NOT NULL OFFSET ON OR ORDER OUTER PRIMARY PROCEDURE REFERENCES RELEASE RENAME REPLACE RESTRICT RETURN REVOKE RIGHT ROLLBACK SCHEMA SELECT SET SHOW TABLE THEN TRUE TRIGGER UNION UNIQUE UPDATE USE USING VALUES VIEW WHEN WHERE WITH INT INTEGER BIGINT SMALLINT TINYINT MEDIUMINT DECIMAL NUMERIC FLOAT DOUBLE REAL BIT BOOL BOOLEAN DATE TIME DATETIME TIMESTAMP YEAR VARCHAR VARBINARY BINARY TEXT TINYTEXT MEDIUMTEXT BLOB TINYBLOB MEDIUMBLOB LONGBLOB JSON ENUM SET UNSIGNED ZEROFILL ENGINE CHARSET COLLATION AUTO_INCREMENT NULL DEFAULT CURRENT_USER'.split(' ')
const reservedAliases = new Set('WHERE JOIN LEFT RIGHT INNER OUTER ON GROUP ORDER LIMIT HAVING SET VALUES USING'.split(' '))
const cleanIdentifier = (value: string): string => value.replaceAll('`', '')
const quoteSuggestion = (value: string, mode: SqlCompletionOptions['identifierQuoting'] = 'needed'): string => {
  const safe = /^[A-Za-z_$][\w$]*$/.test(value)
  const keyword = sqlKeywords?.has(value.toLowerCase()) ?? false
  if (mode === 'always' || mode === 'reserved' && keyword || mode === 'needed' && (!safe || keyword)) return `\`${value.replaceAll('`', '``')}\``
  return value
}

export function expandSnippetLiterals(source: string, database = ''): string {
  const literals: Record<string, string> = { CARET: '$0', DATE: new Date().toISOString().slice(0, 10), TIME: new Date().toTimeString().slice(0, 8), USER: 'CURRENT_USER()', DB: database ? database.replaceAll('`', '``') : 'DATABASE()', SERVER: '@@hostname' }
  let index = 1
  return source.replace(/\$([A-Za-z_][\w]*)\$/g, (_whole, name: string) => {
    if (name.toLowerCase() === 'caret') return '$0'
    const value = literals[name.toUpperCase()]
    return value === undefined ? `\${${index++}:${name}}` : value
  })
}

export function buildSqlSuggestions(sql: string, offset: number, metadata: EditorMetadata, userSnippets: SqlSnippet[] = [], options: SqlCompletionOptions = {}): SqlSuggestion[] {
  const before = sql.slice(0, Math.max(0, Math.min(sql.length, offset)))
  const qualifier = /([\w$`]+)\.([\w$`]*)$/.exec(before)
  const prefix = /[\w$`]+$/.exec(before)?.[0] ?? ''
  const normalizedPrefix = cleanIdentifier(prefix).toLowerCase()
  const make = (label: string, kind: SqlSuggestionKind, detail: string, insertText = quoteSuggestion(label, options.identifierQuoting), schema?: string): SqlSuggestion => ({ label, insertText, kind, detail, ...(schema ? { schema } : {}) })

  if (qualifier) {
    const name = cleanIdentifier(qualifier[1]).toLowerCase()
    const aliases = findAliases(sql, metadata)
    const object = metadata.objects.find((item) => item.name.toLowerCase() === name || aliases.get(name)?.toLowerCase() === item.name.toLowerCase())
    if (object) return object.columns
      .filter((column) => column.name.toLowerCase().includes(cleanIdentifier(qualifier[2]).toLowerCase()))
      .map((column) => make(column.name, 'column', `${column.type} · ${object.name}`, quoteSuggestion(column.name, options.identifierQuoting), metadata.database))
    if (name === metadata.database.toLowerCase() || metadata.databases.some((database) => database.toLowerCase() === name)) {
      return metadata.objects.filter((item) => item.name.toLowerCase().includes(cleanIdentifier(qualifier[2]).toLowerCase())).map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`, quoteSuggestion(item.name), metadata.database))
    }
    return []
  }

  const context = /\b(FROM|JOIN|UPDATE|INTO|TABLE)\s+([\w$`]*)$/i.exec(before)
  if (context) return metadata.objects
    .filter((item) => item.name.toLowerCase().includes(cleanIdentifier(context[2]).toLowerCase()))
    .map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`, tableInsertion(item.name, metadata.database, options), metadata.database))

  const routineContext = /\b(CALL|FUNCTION)\s+([\w$`]*)$/i.exec(before)
  if (routineContext) return metadata.routines
    .filter((item) => item.name.toLowerCase().includes(cleanIdentifier(routineContext[2]).toLowerCase()))
    .map((item) => make(item.name, 'routine', item.kind))

  const contextualColumns = findTableReferences(sql, metadata).flatMap(({ object, alias }) => object.columns.map((column) => make(column.name, 'column', `${column.type} · ${object.name} ${alias}`, options.qualifyColumnWithAlias === false ? quoteSuggestion(column.name, options.identifierQuoting) : `${quoteSuggestion(alias, options.identifierQuoting)}.${quoteSuggestion(column.name, options.identifierQuoting)}`, metadata.database)))
  const results: SqlSuggestion[] = [
    ...metadata.databases.map((database) => make(database, 'database', 'database')),
    ...contextualColumns,
    ...metadata.objects.map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`)),
    ...metadata.routines.map((item) => make(item.name, 'routine', item.kind)),
    ...keywords.map((keyword) => make(keyword, 'keyword', 'SQL keyword', keyword)),
    ...[...sqlSnippets, ...userSnippets].map((snippet) => make(snippet.label, 'snippet', `${snippet.prefix} · ${snippet.description}`, expandSnippetLiterals(snippet.body, metadata.database)))
  ]
  const visible = results.filter((item) => !normalizedPrefix || matchesCompletionFilter(item.label, normalizedPrefix, options.filter ?? 'substring') || (item.kind === 'snippet' && item.detail.toLowerCase().includes(normalizedPrefix)))
  return options.sortKeywords === false ? visible : [...visible.filter((item) => item.kind !== 'keyword'), ...visible.filter((item) => item.kind === 'keyword')]
}

export function resolveAliasRule(name: string, schema: string, rules: NonNullable<SqlCompletionOptions['aliasRules']>): 'none' | 'short' | 'full' | undefined {
  const fullName = `${schema}.${name}`
  for (const rule of rules) {
    const mask = rule.condition.trim().replace(/<([^<>]+)>/g, '$1')
    if (!mask) continue
    const pattern = [...mask].map((char) => char === '*' ? '.*' : char === '?' ? '.' : /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char).join('')
    const matcher = new RegExp(`^${pattern}$`, 'i')
    if (matcher.test(name) || matcher.test(fullName)) return rule.action
  }
  return undefined
}

function findTableReferences(sql: string, metadata: EditorMetadata): Array<{ object: EditorMetadata['objects'][number]; alias: string }> {
  const aliases = findAliases(sql, metadata)
  const references: Array<{ object: EditorMetadata['objects'][number]; alias: string }> = []
  for (const [alias, table] of aliases) {
    const object = metadata.objects.find((item) => item.name.toLowerCase() === table.toLowerCase())
    if (object) references.push({ object, alias })
  }
  const matcher = /\b(?:FROM|JOIN)\s+(`?[\w$]+`?)(?:\s+(?:AS\s+)?(`?[\w$]+`?))?/gi
  for (const match of sql.matchAll(matcher)) {
    const table = cleanIdentifier(match[1]!)
    const possibleAlias = cleanIdentifier(match[2] ?? table)
    const object = metadata.objects.find((item) => item.name.toLowerCase() === table.toLowerCase())
    if (object && !reservedAliases.has(possibleAlias.toUpperCase()) && !references.some((item) => item.alias.toLowerCase() === possibleAlias.toLowerCase())) references.push({ object, alias: possibleAlias })
  }
  return references
}

function tableInsertion(name: string, schema: string, options: SqlCompletionOptions): string {
  const quotedName = quoteSuggestion(name, options.identifierQuoting)
  if (!options.autoAlias || options.aliasQualifier === 'none') return quotedName
  const action = resolveAliasRule(name, schema, options.aliasRules ?? []) ?? 'short'
  if (action === 'none') return quotedName
  const bare = cleanIdentifier(name)
  const aliasBase = action === 'full' ? bare : bare.split(/[_-]+/).map((part) => part[0]).join('') || bare[0] || 't'
  const alias = options.aliasUppercase ? aliasBase.toUpperCase() : aliasBase.toLowerCase()
  const qualifier = options.aliasQualifier === 'schema-object' ? `${quoteSuggestion(schema, options.identifierQuoting)}.` : ''
  return `${qualifier}${quotedName}${options.aliasUseAs === false ? ' ' : ' AS '}${quoteSuggestion(alias, options.identifierQuoting)}`
}

function matchesCompletionFilter(label: string, prefix: string, mode: NonNullable<SqlCompletionOptions['filter']>): boolean {
  const normalized = label.toLowerCase()
  if (mode === 'prefix') return normalized.startsWith(prefix)
  if (mode === 'camelCase') {
    const initials = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).map((part) => part[0] ?? '').join('').toLowerCase()
    return normalized.startsWith(prefix) || initials.startsWith(prefix)
  }
  return normalized.includes(prefix)
}

export const sqlKeywords = new Set(keywords.map((keyword) => keyword.toLowerCase()))

export function applyKeywordCaseAtOffset(sql: string, offset: number, mode: 'upper' | 'lower' | 'as-typed'): string {
  if (mode === 'as-typed') return sql
  const caret = Math.max(0, Math.min(sql.length, offset))
  const before = sql.slice(0, caret)
  const word = /[A-Za-z_][\w$]*$/.exec(before)?.[0]
  if (!word || !sqlKeywords.has(word.toLowerCase())) return sql
  const start = caret - word.length
  // Do not rewrite text inside quoted identifiers, strings, or SQL comments.
  let quote = ''
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < start; index += 1) {
    const char = sql[index]!
    const next = sql[index + 1]
    if (lineComment) { if (char === '\n') lineComment = false; continue }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index += 1 }; continue }
    if (quote) {
      if (char === '\\' && quote !== '`') { index += 1; continue }
      if (char === quote && next === quote) { index += 1; continue }
      if (char === quote) quote = ''
      continue
    }
    if ((char === '-' && next === '-' && (!sql[index + 2] || /\s/.test(sql[index + 2]!))) || char === '#') { lineComment = true; if (char === '-') index += 1; continue }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue }
    if (char === "'" || char === '"' || char === '`') quote = char
  }
  if (quote || lineComment || blockComment) return sql
  const replacement = mode === 'upper' ? word.toUpperCase() : word.toLowerCase()
  return replacement === word ? sql : `${sql.slice(0, start)}${replacement}${sql.slice(caret)}`
}

function findAliases(sql: string, metadata: EditorMetadata): Map<string, string> {
  const aliases = new Map<string, string>()
  const matcher = /\b(?:FROM|JOIN)\s+(`?(?:[\w$]+)`?)\s+(?:AS\s+)?(`?[\w$]+`?)/gi
  for (const match of sql.matchAll(matcher)) {
    const table = cleanIdentifier(match[1])
    const alias = cleanIdentifier(match[2])
    if (!reservedAliases.has(alias.toUpperCase()) && metadata.objects.some((item) => item.name.toLowerCase() === table.toLowerCase())) aliases.set(alias.toLowerCase(), table)
  }
  return aliases
}
