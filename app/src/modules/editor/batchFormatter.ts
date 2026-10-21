import { copyFile, lstat, mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { formatSql, type SqlFormatOptions } from './formatter.js'
import { readBoundedRegularFile } from '../security/boundedFile.js'

export interface BatchFormatOptions { paths: string[]; backup: boolean; recursive?: boolean; formatOptions?: SqlFormatOptions }
export interface BatchFormatResult { path: string; changed: boolean; backupPath?: string }
const collect = async (path: string, recursive: boolean, output: string[] = []): Promise<string[]> => {
  const info = await lstat(path)
  if (info.isSymbolicLink()) throw new Error('SQL formatter does not follow symbolic links.')
  if (info.isFile()) { if (extname(path).toLowerCase() === '.sql') output.push(resolve(path)); return output }
  if (!info.isDirectory()) return output
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = join(path, item.name)
    if (item.isFile() && extname(item.name).toLowerCase() === '.sql') output.push(resolve(child))
    else if (recursive && item.isDirectory()) await collect(child, true, output)
  }
  return output
}

/** Formats selected SQL files with an atomic replacement; backups are copied before replacement. */
export async function formatSqlFiles(options: BatchFormatOptions): Promise<BatchFormatResult[]> {
  validateFormatOptions(options.formatOptions)
  if (!options.paths.length || options.paths.length > 1000) throw new Error('Select between 1 and 1000 SQL files or directories.')
  const files = [...new Set((await Promise.all(options.paths.map((path) => collect(path, Boolean(options.recursive)))).then((groups) => groups.flat())))]
  const results: BatchFormatResult[] = []
  for (const path of files) {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Selected SQL file is no longer a regular file.')
    const source = (await readBoundedRegularFile(path, 64 * 1024 * 1024)).toString('utf8')
    const formatted = formatSql(source, options.formatOptions)
    if (formatted === source) { results.push({ path, changed: false }); continue }
    const backupPath = options.backup ? `${path}.bak` : undefined
    if (backupPath) await copyFile(path, backupPath, constants.COPYFILE_EXCL)
    await mkdir(dirname(path), { recursive: true })
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
    try { await writeFile(temporary, formatted, { encoding: 'utf8', mode: info.mode }); await rename(temporary, path) }
    catch (error) { const { unlink } = await import('node:fs/promises'); await unlink(temporary).catch(() => undefined); throw error }
    results.push({ path, changed: true, ...(backupPath ? { backupPath } : {}) })
  }
  return results
}

export async function previewSqlFiles(options: Pick<BatchFormatOptions, 'paths' | 'recursive' | 'formatOptions'>): Promise<Array<{ path: string; formatted: string; changed: boolean }>> {
  validateFormatOptions(options.formatOptions)
  if (!options.paths.length || options.paths.length > 1000) throw new Error('Select between 1 and 1000 SQL files or directories.')
  const files = [...new Set((await Promise.all(options.paths.map((path) => collect(path, Boolean(options.recursive)))).then((groups) => groups.flat())))]
  let total = 0
  const previews: Array<{ path: string; formatted: string; changed: boolean }> = []
  for (const path of files.slice(0, 20)) {
    const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Selected SQL file is no longer a regular file.'); total += info.size
    if (total > 2 * 1024 * 1024) throw new Error('Preview is limited to 2 MB across the first 20 SQL files.')
    const source = (await readBoundedRegularFile(path, 2 * 1024 * 1024)).toString('utf8'); const formatted = formatSql(source, options.formatOptions)
    previews.push({ path, formatted, changed: formatted !== source })
  }
  return previews
}

function validateFormatOptions(options: SqlFormatOptions | undefined): void {
  if (!options) return
  if (options.keywordCase !== undefined && options.keywordCase !== 'upper' && options.keywordCase !== 'lower') throw new Error('Invalid SQL keyword case option.')
  if (options.indentSize !== undefined && options.indentSize !== 2 && options.indentSize !== 4) throw new Error('Indent size must be 2 or 4 spaces.')
}
