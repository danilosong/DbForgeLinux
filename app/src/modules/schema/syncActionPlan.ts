import { splitSqlStatements } from '../../shared/sqlStatements.js'

export interface SyncAction {
  title: string
  sql: string
}

export function createSyncActionPlan(script: string): SyncAction[] {
  return splitSqlStatements(script).map(({ sql }) => ({ title: describeAction(sql), sql: `${sql};` }))
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
