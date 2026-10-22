import { splitSqlStatements } from '../../shared/sqlStatements.js'

export interface SyncAction {
  title: string
  sql: string
}

export interface SyncActionGroup { title: string; actions: SyncAction[] }

export function createSyncActionPlan(script: string): SyncAction[] {
  return splitSqlStatements(script).map(({ sql }) => ({ title: describeAction(sql), sql: `${sql};` }))
}

export function groupSyncActionPlan(actions: SyncAction[]): SyncActionGroup[] {
  const groups: SyncActionGroup[] = []
  for (const action of actions) {
    const normalized = action.sql.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '')
    const operation = /^(DROP|CREATE|ALTER|START TRANSACTION|COMMIT|USE)\b/i.exec(normalized)?.[1]?.toUpperCase() ?? 'Other'
    const kind = /\b(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b/i.exec(normalized)?.[1]?.toLowerCase()
    const title = operation === 'START TRANSACTION' || operation === 'COMMIT' || operation === 'USE' ? operation[0] + operation.slice(1).toLowerCase() : `${operation[0]}${operation.slice(1).toLowerCase()}${kind ? ` ${kind}s` : ' statements'}`
    const previous = groups.at(-1)
    if (previous?.title === title) previous.actions.push(action)
    else groups.push({ title, actions: [action] })
  }
  return groups
}

export function functionCharacteristicWarnings(script: string): string[] {
  const warnings: string[] = []
  for (const statement of splitSqlStatements(script)) {
    const sql = statement.sql
    const match = /^\s*CREATE\s+(?:DEFINER\s*=\s*[^\s]+\s+)?FUNCTION\s+(?:`[^`]+`\.)?`?([^`\s(]+)`?\s*\([\s\S]*?\)\s+RETURNS\s+[^;]+?(?=\bBEGIN\b|\bRETURN\b)/i.exec(sql)
    const characteristics = match?.[0] ?? ''
    const deterministic = /\bDETERMINISTIC\b/i.test(characteristics) && !/\bNOT\s+DETERMINISTIC\b/i.test(characteristics)
    if (match && !(deterministic || /\b(?:NO SQL|READS SQL DATA)\b/i.test(characteristics))) warnings.push(`Function ${match[1]} has no declared determinism or SQL data-access characteristic.`)
  }
  return warnings
}

function describeAction(sql: string): string {
  const normalized = sql.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '')
  const database = /^USE\s+`?([^`\s;]+)`?/i.exec(normalized)?.[1]
  const object = /\b(?:TABLE|VIEW|DATABASE|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:`[^`]+`\.)?`?([^`\s(]+)`?/i.exec(normalized)?.[1]
  if (/^DROP\b/i.test(normalized)) return `Drop ${object ?? 'object'}`
  if (/^CREATE\b/i.test(normalized)) return `Create ${object ?? 'object'}`
  if (/^ALTER\b/i.test(normalized)) return `Alter ${object ?? 'object'}`
  if (/^USE\b/i.test(normalized)) return `Select database ${database ?? ''}`.trim()
  if (/^START\s+TRANSACTION\b/i.test(normalized)) return 'Start transaction'
  if (/^COMMIT\b/i.test(normalized)) return 'Commit transaction'
  if (/^INSERT\b/i.test(normalized)) return `Insert into ${object ?? 'table'}`
  if (/^UPDATE\b/i.test(normalized)) return `Update ${object ?? 'table'}`
  if (/^DELETE\b/i.test(normalized)) return `Delete from ${object ?? 'table'}`
  return normalized.split(/\s+/).slice(0, 4).join(' ') || 'SQL statement'
}
