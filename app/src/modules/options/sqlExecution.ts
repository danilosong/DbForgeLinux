/** Zero means unlimited; among finite settings, the smallest positive timeout wins. */
export function effectiveCommandTimeoutSeconds(...limits: number[]): number {
  const finiteLimits = limits.filter((limit) => Number.isFinite(limit) && limit > 0)
  return finiteLimits.length ? Math.min(...finiteLimits) : 0
}

export function validateSqlExecutionOptions(value: unknown): { commandTimeoutSeconds: number; profileCommandTimeoutSeconds: number; resultRowLimit: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid SQL execution options.')
  const options = value as Record<string, unknown>
  const timeout = options.commandTimeoutSeconds ?? 0
  const profileTimeout = options.profileCommandTimeoutSeconds ?? 0
  const rowLimit = options.resultRowLimit ?? 0
  if (!Number.isInteger(timeout) || (timeout as number) < 0 || (timeout as number) > 86400) throw new TypeError('Invalid SQL command timeout.')
  if (!Number.isInteger(profileTimeout) || (profileTimeout as number) < 0 || (profileTimeout as number) > 86400) throw new TypeError('Invalid profile command timeout.')
  if (!Number.isInteger(rowLimit) || (rowLimit as number) < 0 || (rowLimit as number) > 1000000) throw new TypeError('Invalid SQL result row limit.')
  return { commandTimeoutSeconds: timeout as number, profileCommandTimeoutSeconds: profileTimeout as number, resultRowLimit: rowLimit as number }
}
