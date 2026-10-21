import { lstat, readdir, realpath, stat, unlink } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'

export interface ExportRetentionPolicy {
  baseName: string
  extension: string
  maxAgeDays?: number
  keepCount?: number
}

export interface ExportRetentionPlan {
  directory: string
  files: string[]
}

export async function planExportRetention(outputFile: string, policy: ExportRetentionPolicy, now = Date.now()): Promise<ExportRetentionPlan> {
  const directory = await realpath(dirname(resolve(outputFile)))
  const outputName = basename(outputFile)
  const entries = await readdir(directory, { withFileTypes: true })
  const matches = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${policy.baseName}_`) && extname(entry.name).toLowerCase() === `.${policy.extension.toLowerCase()}`)
    .map(async (entry) => ({ path: resolve(directory, entry.name), current: entry.name === outputName, mtime: (await stat(resolve(directory, entry.name))).mtimeMs })))
  matches.sort((left, right) => right.mtime - left.mtime)
  const keepCount = policy.keepCount === undefined ? undefined : Math.max(1, Math.floor(policy.keepCount))
  const cutoff = policy.maxAgeDays === undefined ? undefined : now - Math.max(1, Math.floor(policy.maxAgeDays)) * 86_400_000
  const files = matches.filter((item, index) => !item.current && ((keepCount !== undefined && index >= keepCount) || (cutoff !== undefined && item.mtime < cutoff))).map(({ path }) => path)
  return { directory, files }
}

/** Deletes only direct regular-file children of the selected output directory. */
export async function deletePlannedExportFiles(plan: ExportRetentionPlan): Promise<number> {
  const directory = await realpath(plan.directory)
  let deleted = 0
  for (const candidate of plan.files) {
    const absolutePath = resolve(candidate)
    if (dirname(absolutePath) !== directory || basename(absolutePath) === '.' || basename(absolutePath) === '..') {
      throw new Error('Retention can only delete files inside the selected export folder.')
    }
    const details = await lstat(absolutePath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    })
    if (!details) continue
    if (!details.isFile()) continue
    await unlink(absolutePath)
    deleted += 1
  }
  return deleted
}

export async function deleteExportFilesAfterConfirmation(plan: ExportRetentionPlan, confirm: (plan: ExportRetentionPlan) => Promise<boolean>): Promise<number> {
  if (!plan.files.length || !(await confirm(plan))) return 0
  return deletePlannedExportFiles(plan)
}
