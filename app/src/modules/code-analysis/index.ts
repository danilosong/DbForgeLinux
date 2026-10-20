import type { CodeAnalysisFinding } from '../../shared/contracts/code-analysis.js'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

export function analyzeSql(sql: string): CodeAnalysisFinding[] {
  if (!sql.trim()) return []
  const masked = maskNonCode(sql)
  const findings: CodeAnalysisFinding[] = []
  const add = (ruleId: string, category: CodeAnalysisFinding['category'], severity: CodeAnalysisFinding['severity'], message: string, index: number): void => {
    const before = sql.slice(0, index)
    const line = before.split('\n').length
    const column = index - before.lastIndexOf('\n')
    findings.push({ ruleId, category, severity, message, line, column })
  }

  for (const match of masked.matchAll(/\bSELECT\s+(?:[\w`$]+\s*\.\s*)?\*/gi)) {
    add('SQL001', 'Performance', 'Warning', 'Evite SELECT *; enumere as colunas necessárias.', match.index ?? 0)
  }
  for (const statement of splitSqlStatements(masked)) {
    if (/^\s*UPDATE\b/i.test(statement.sql) && !/\bWHERE\b/i.test(statement.sql)) {
      add('SQL002', 'Correctness', 'Warning', 'UPDATE sem WHERE pode alterar todas as linhas.', Math.max(statement.start, masked.toUpperCase().indexOf('UPDATE', statement.start)))
    }
    if (/^\s*DELETE\b/i.test(statement.sql) && !/\bWHERE\b/i.test(statement.sql)) {
      add('SQL003', 'Correctness', 'Warning', 'DELETE sem WHERE pode remover todas as linhas.', Math.max(statement.start, masked.toUpperCase().indexOf('DELETE', statement.start)))
    }
  }
  for (const match of masked.matchAll(/(?:=|<>|!=)\s*NULL\b/gi)) {
    add('SQL004', 'Correctness', 'Error', 'Use IS NULL ou IS NOT NULL para comparar valores NULL.', match.index ?? 0)
  }
  for (const match of masked.matchAll(/\bWHERE\b[^;\n]*?\b(?:LOWER|UPPER|DATE|YEAR|MONTH|DAY|COALESCE|IFNULL|CAST|CONVERT)\s*\(/gi)) {
    add('SQL005', 'Performance', 'Warning', 'Uma função aplicada à coluna no predicado pode impedir o uso de índice.', match.index ?? 0)
  }
  for (const match of masked.matchAll(/\bJOIN\s+[^;\n]*?(?=;|\n|\b(?:JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT)\b|$)/gi)) {
    if (!/\b(?:ON|USING)\b/i.test(match[0])) add('SQL006', 'Correctness', 'Warning', 'JOIN sem ON ou USING pode gerar produto cartesiano.', match.index ?? 0)
  }
  for (const match of masked.matchAll(/\bLIMIT\s+\d+(?:\s*,\s*\d+)?\b/gi)) {
    const statementStart = Math.max(masked.lastIndexOf(';', match.index ?? 0) + 1, 0)
    const segment = masked.slice(statementStart, match.index ?? 0)
    if (!/\bORDER\s+BY\b/i.test(segment)) add('SQL007', 'Style', 'Info', 'LIMIT sem ORDER BY pode retornar linhas diferentes entre execuções.', match.index ?? 0)
  }
  for (const match of masked.matchAll(/\bUNION\b(?!\s+ALL)\b/gi)) {
    add('SQL008', 'Performance', 'Info', 'Confirme se UNION DISTINCT é necessário; UNION ALL evita remover duplicatas.', match.index ?? 0)
  }
  return findings.sort((left, right) => left.line - right.line || left.column - right.column || left.ruleId.localeCompare(right.ruleId))
}

function maskNonCode(sql: string): string {
  const chars = sql.split('')
  let state: 'code' | 'single' | 'double' | 'backtick' | 'line' | 'block' = 'code'
  for (let index = 0; index < chars.length; index++) {
    const current = chars[index] ?? ''
    const next = chars[index + 1] ?? ''
    if (state === 'line') {
      if (current === '\n') state = 'code'
      else chars[index] = ' '
      continue
    }
    if (state === 'block') {
      if (current === '*' && next === '/') { chars[index] = ' '; chars[index + 1] = ' '; index++; state = 'code' }
      else if (current !== '\n') chars[index] = ' '
      continue
    }
    if (state !== 'code') {
      if (current === '\\') { chars[index] = ' '; if (next && next !== '\n') chars[index + 1] = ' '; index++; continue }
      const closing = state === 'single' ? "'" : state === 'double' ? '"' : '`'
      if (current === closing) {
        chars[index] = ' '
        if (next === closing) { chars[index + 1] = ' '; index++ } else state = 'code'
      } else if (current !== '\n') chars[index] = ' '
      continue
    }
    if (current === "'") { state = 'single'; chars[index] = ' '; continue }
    if (current === '"') { state = 'double'; chars[index] = ' '; continue }
    if (current === '`') { state = 'backtick'; chars[index] = ' '; continue }
    if (current === '#' || (current === '-' && next === '-' && (!sql[index + 2] || /\s/.test(sql[index + 2] ?? '')))) { state = 'line'; chars[index] = ' '; if (current === '-') { chars[index + 1] = ' '; index++ } continue }
    if (current === '/' && next === '*') { state = 'block'; chars[index] = ' '; chars[index + 1] = ' '; index++ }
  }
  return chars.join('')
}
