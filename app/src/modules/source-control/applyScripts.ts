import { destructiveStatementKind, type DestructiveStatementKind } from '../options/executionWarnings.js'
import { redactSqlSecrets } from '../../shared/redactSqlSecrets.js'
import { splitSqlStatements } from '../../shared/sqlStatements.js'

export type ScriptReviewCounts = Record<DestructiveStatementKind, number>
export interface ReviewedSourceScript { path: string; contents: string }

function sourceScriptStatements(contents: string): Array<{ sql: string }> {
  // CREATE routines are one server statement even though their bodies contain semicolons.
  // Exported project files store one object per file and omit the mysql CLI DELIMITER command.
  if (/^\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*.+?\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b)/i.test(contents)) {
    return [{ sql: contents.trim().replace(/;\s*$/, '') }]
  }
  return splitSqlStatements(contents)
}

export function reviewSourceScripts(scripts: readonly ReviewedSourceScript[]): ScriptReviewCounts {
  const counts: ScriptReviewCounts = { drop: 0, truncate: 0, delete: 0, update: 0 }
  for (const script of scripts) for (const { sql } of sourceScriptStatements(script.contents)) {
    const kind = destructiveStatementKind(sql)
    if (kind) counts[kind]++
  }
  return counts
}

export interface SourceScriptApplyDriver {
  setDatabase(connectionId: string, database: string): Promise<void>
  executeSql(connectionId: string, sql: string): Promise<unknown>
}

export async function applyReviewedSourceScripts(input: {
  driver: SourceScriptApplyDriver
  connectionId: string
  database: string
  scripts: readonly ReviewedSourceScript[]
  production: boolean
  confirmed: boolean
  typedDatabase?: string
  reviewedCounts: ScriptReviewCounts
}): Promise<void> {
  if (!input.confirmed) throw new Error('Confirm applying the reviewed scripts to the database.')
  if (!input.scripts.length) throw new Error('Select at least one script.')
  if (!input.reviewedCounts || ['drop', 'truncate', 'delete', 'update'].some((kind) => typeof input.reviewedCounts[kind as keyof ScriptReviewCounts] !== 'number')) throw new Error('Review the scripts before applying them.')
  const counts = reviewSourceScripts(input.scripts)
  if ((Object.keys(counts) as Array<keyof ScriptReviewCounts>).some((kind) => counts[kind] !== input.reviewedCounts[kind])) throw new Error('The scripts changed after review. Review them again before applying.')
  if (input.production && input.typedDatabase !== input.database) throw new Error('Type the exact database name to confirm changes to this production database.')
  await input.driver.setDatabase(input.connectionId, input.database)
  for (const script of input.scripts) {
    const statements = sourceScriptStatements(script.contents)
    for (const [index, statement] of statements.entries()) {
      try { await input.driver.executeSql(input.connectionId, statement.sql) }
      catch (error) {
        const detail = redactSqlSecrets(error instanceof Error ? error.message : 'Database error.')
        throw new Error(`Source script ${script.path}, statement ${index + 1} failed: ${detail}`, { cause: error })
      }
    }
  }
}
