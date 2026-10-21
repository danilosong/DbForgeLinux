import { lstat, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

export type SystemOpenKind = 'file' | 'folder'

/** Accept only an existing regular file/directory whose path contains no symlink. */
export async function validateSystemOpenPath(input: string, kind: SystemOpenKind): Promise<string> {
  if (typeof input !== 'string' || !input.trim() || !isAbsolute(input) || input.includes('\0')) throw new TypeError('Choose an existing absolute file or folder first.')
  const candidate = resolve(input)
  const fileInfo = await lstat(candidate)
  if (fileInfo.isSymbolicLink()) throw new TypeError('Cannot open a symbolic link.')
  const target = kind === 'folder' && fileInfo.isFile() ? dirname(candidate) : candidate
  const resolved = await realpath(target)
  if (resolved !== target) throw new TypeError('Cannot open a path that traverses a symbolic link.')
  const details = await stat(resolved)
  if (kind === 'file' && !details.isFile()) throw new TypeError('The selected path is not a regular file.')
  if (kind === 'folder' && !details.isDirectory()) throw new TypeError('The selected path is not a folder.')
  return resolved
}
