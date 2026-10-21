import type { EditorMetadata } from '../../shared/contracts/editor.js'
import { sqlSnippets } from './snippets.js'
import type { SqlSnippet } from './snippets.js'

export type SqlSuggestionKind = 'database' | 'table' | 'column' | 'routine' | 'keyword' | 'snippet'
export interface SqlSuggestion { label: string; insertText: string; detail: string; kind: SqlSuggestionKind; schema?: string }

const keywords = 'ADD ALL ALTER AND AS ASC BEGIN BETWEEN BY CALL CASE CHANGE CHAR CHARACTER CHECK COLLATE COLUMN COMMIT CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIMESTAMP DATABASE DATABASES DEFAULT DELETE DESC DISTINCT DROP ELSE END ESCAPE EXISTS FALSE FETCH FOR FOREIGN FROM FULLTEXT FUNCTION GRANT GROUP HAVING IF IN INDEX INNER INSERT INTERVAL INTO IS JOIN KEY LEFT LIKE LIMIT LOCK LONGTEXT NOT NULL OFFSET ON OR ORDER OUTER PRIMARY PROCEDURE REFERENCES RELEASE RENAME REPLACE RESTRICT RETURN REVOKE RIGHT ROLLBACK SCHEMA SELECT SET SHOW TABLE THEN TRUE TRIGGER UNION UNIQUE UPDATE USE USING VALUES VIEW WHEN WHERE WITH'.split(' ')
const reservedAliases = new Set('WHERE JOIN LEFT RIGHT INNER OUTER ON GROUP ORDER LIMIT HAVING SET VALUES USING'.split(' '))
const cleanIdentifier = (value: string): string => value.replaceAll('`', '')
const quoteSuggestion = (value: string): string => /^[A-Za-z_$][\w$]*$/.test(value) ? value : `\`${value.replaceAll('`', '``')}\``

export function expandSnippetLiterals(source: string, database = ''): string {
  const literals: Record<string, string> = { CARET: '$0', DATE: new Date().toISOString().slice(0, 10), TIME: new Date().toTimeString().slice(0, 8), USER: 'CURRENT_USER()', DB: database ? database.replaceAll('`', '``') : 'DATABASE()', SERVER: '@@hostname' }
  let index = 1
  return source.replace(/\$([A-Za-z_][\w]*)\$/g, (_whole, name: string) => {
    if (name.toLowerCase() === 'caret') return '$0'
    const value = literals[name.toUpperCase()]
    return value === undefined ? `\${${index++}:${name}}` : value
  })
}

export function buildSqlSuggestions(sql: string, offset: number, metadata: EditorMetadata, userSnippets: SqlSnippet[] = []): SqlSuggestion[] {
  const before = sql.slice(0, Math.max(0, Math.min(sql.length, offset)))
  const qualifier = /([\w$`]+)\.([\w$`]*)$/.exec(before)
  const prefix = /[\w$`]+$/.exec(before)?.[0] ?? ''
  const normalizedPrefix = cleanIdentifier(prefix).toLowerCase()
  const make = (label: string, kind: SqlSuggestionKind, detail: string, insertText = quoteSuggestion(label), schema?: string): SqlSuggestion => ({ label, insertText, kind, detail, ...(schema ? { schema } : {}) })

  if (qualifier) {
    const name = cleanIdentifier(qualifier[1]).toLowerCase()
    const aliases = findAliases(sql, metadata)
    const object = metadata.objects.find((item) => item.name.toLowerCase() === name || aliases.get(name)?.toLowerCase() === item.name.toLowerCase())
    if (object) return object.columns
      .filter((column) => column.name.toLowerCase().includes(cleanIdentifier(qualifier[2]).toLowerCase()))
      .map((column) => make(column.name, 'column', `${column.type} · ${object.name}`, quoteSuggestion(column.name), metadata.database))
    if (name === metadata.database.toLowerCase() || metadata.databases.some((database) => database.toLowerCase() === name)) {
      return metadata.objects.filter((item) => item.name.toLowerCase().includes(cleanIdentifier(qualifier[2]).toLowerCase())).map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`, quoteSuggestion(item.name), metadata.database))
    }
    return []
  }

  const context = /\b(FROM|JOIN|UPDATE|INTO|TABLE)\s+([\w$`]*)$/i.exec(before)
  if (context) return metadata.objects
    .filter((item) => item.name.toLowerCase().includes(cleanIdentifier(context[2]).toLowerCase()))
    .map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`, quoteSuggestion(item.name), metadata.database))

  const routineContext = /\b(CALL|FUNCTION)\s+([\w$`]*)$/i.exec(before)
  if (routineContext) return metadata.routines
    .filter((item) => item.name.toLowerCase().includes(cleanIdentifier(routineContext[2]).toLowerCase()))
    .map((item) => make(item.name, 'routine', item.kind))

  const results: SqlSuggestion[] = [
    ...metadata.databases.map((database) => make(database, 'database', 'database')),
    ...metadata.objects.map((item) => make(item.name, 'table', `${item.kind} · ${metadata.database}`)),
    ...metadata.routines.map((item) => make(item.name, 'routine', item.kind)),
    ...keywords.map((keyword) => make(keyword, 'keyword', 'SQL keyword', keyword)),
    ...[...sqlSnippets, ...userSnippets].map((snippet) => make(snippet.label, 'snippet', `${snippet.prefix} · ${snippet.description}`, expandSnippetLiterals(snippet.body, metadata.database)))
  ]
  return results.filter((item) => !normalizedPrefix || item.label.toLowerCase().includes(normalizedPrefix) || (item.kind === 'snippet' && item.detail.toLowerCase().includes(normalizedPrefix)))
}

export const sqlKeywords = new Set(keywords.map((keyword) => keyword.toLowerCase()))

export function applyKeywordCaseAtOffset(sql: string, offset: number, mode: 'upper' | 'lower' | 'as-typed'): string {
  if (mode === 'as-typed') return sql
  const caret = Math.max(0, Math.min(sql.length, offset))
  const before = sql.slice(0, caret)
  const word = /[A-Za-z_][\w$]*$/.exec(before)?.[0]
  if (!word || !sqlKeywords.has(word.toLowerCase())) return sql
  const start = caret - word.length
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
