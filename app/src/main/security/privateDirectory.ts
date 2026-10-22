import { chmodSync, mkdirSync, statSync } from 'node:fs'

/**
 * Creates the profile directory owner-only (0700) and tightens an existing one, since the
 * Debian/Ubuntu default umask 002 would otherwise leave it group-writable. A symlinked profile
 * (for example moved to another disk) is followed and its target tightened.
 */
export function ensurePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  const details = statSync(path)
  if (!details.isDirectory()) throw new Error('The profile path is not a directory.')
  if ((details.mode & 0o777) !== 0o700) chmodSync(path, 0o700)
}
