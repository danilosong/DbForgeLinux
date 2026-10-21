export interface RestoreCommandTarget { host: string; port: number; user: string; database: string; backupPath: string }

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'` }

export function buildRestoreCommandLine(target: RestoreCommandTarget): string {
  if (!target || typeof target.host !== 'string' || !target.host || target.host.length > 255 || !Number.isInteger(target.port) || target.port < 1 || target.port > 65535 || typeof target.user !== 'string' || !target.user || target.user.length > 128 || typeof target.database !== 'string' || !target.database || target.database.length > 64 || typeof target.backupPath !== 'string' || !target.backupPath.startsWith('/')) throw new Error('Restore command target is invalid.')
  return `#!/bin/sh\n# The MySQL client prompts for the password; no credential is stored in this file.\nexec mysql --host=${shellQuote(target.host)} --port=${target.port} --user=${shellQuote(target.user)} --password ${shellQuote(target.database)} < ${shellQuote(target.backupPath)}\n`
}
