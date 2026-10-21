import { execFile } from 'node:child_process'
import { access, constants, lstat, mkdir, open, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { createTable } from '../schema/ddl.js'
import type { DatabaseModel, SchemaObject } from '../schema/model.js'
import type { ExportSchemaReport, MergeConflictFile, ProjectFileStatus, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryGraphCommit, RepositoryStatus, WorkingChange } from './types.js'

const execFileAsync = promisify(execFile)
const maxBuffer = 16 * 1024 * 1024

export type { ExportSchemaReport, MergeConflictFile, ProjectFileStatus, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryGraphCommit, RepositoryStatus, SourceControlState, WorkingChange } from './types.js'

export class GitRepository {
  constructor(readonly path: string) {}
  private async git(...args: string[]): Promise<string> {
    const safeConfig = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', '-c', 'commit.gpgsign=false', '-c', 'protocol.ext.allow=never']
    const result = await execFileAsync('git', [...safeConfig, '-C', this.path, ...args], { encoding: 'utf8', maxBuffer, shell: false, env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' } })
    return result.stdout
  }
  async root(): Promise<string> { return (await this.git('rev-parse', '--show-toplevel')).trim() }
  async initialize(): Promise<void> { await this.git('init') }
  async status(): Promise<RepositoryStatus> {
    const root = await this.root()
    const raw = await this.git('status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all')
    const records = raw.split('\0').filter(Boolean)
    const header = records.shift() ?? '## HEAD'
    const branch = /^##\s+(.+?)(?:\.\.\.| \[|$)/.exec(header)?.[1] ?? 'HEAD'
    const ahead = Number(/ahead (\d+)/.exec(header)?.[1] ?? 0)
    const behind = Number(/behind (\d+)/.exec(header)?.[1] ?? 0)
    const changes: WorkingChange[] = records.map((record) => parseChange(record))
    return { root, branch, ahead, behind, changes, conflicted: changes.some((change) => change.state === 'conflicted') }
  }
  async diff(file?: string, staged = false): Promise<string> {
    if (file) await projectFilePath(this.path, file)
    if (file && !staged) {
      const status = await this.status()
      if (status.changes.some((change) => change.path === file && change.state === 'untracked')) {
        try { const result = await execFileAsync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', '-c', 'protocol.ext.allow=never', '-C', this.path, 'diff', '--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--', '/dev/null', resolve(this.path, file)], { encoding: 'utf8', maxBuffer, shell: false, env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' } }); return result.stdout }
        catch (error) { if (String((error as NodeJS.ErrnoException & { stdout?: string }).code) === '1') return String((error as { stdout?: string }).stdout ?? ''); throw error }
      }
    }
    return this.git('diff', '--no-ext-diff', '--no-textconv', '--no-color', ...(staged ? ['--cached'] : []), '--', ...(file ? [file] : []))
  }
  async diffCommit(hash: string, file?: string): Promise<string> {
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) throw new Error('Commit hash inválido.')
    return this.git('show', '--no-ext-diff', '--no-color', '--format=fuller', hash, '--', ...(file ? [file] : []))
  }
  async commit(message: string, files: string[]): Promise<RepositoryCommit> {
    const cleanMessage = message.trim()
    if (!cleanMessage) throw new Error('Informe a commit message.')
    if (!files.length) throw new Error('Selecione ao menos um arquivo para commit.')
    for (const file of files) await projectFilePath(this.path, file)
    await this.git('add', '--', ...files)
    await this.git('commit', '-m', cleanMessage)
    const log = await this.git('log', '-1', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s')
    return parseCommit(log.trim())
  }
  async branches(): Promise<RepositoryBranch[]> {
    const [current, local, remote] = await Promise.all([
      this.git('branch', '--show-current'),
      this.git('branch', '--format=%(refname:short)'),
      this.git('branch', '--remotes', '--format=%(refname:short)')
    ])
    const currentName = current.trim()
    return [
      ...local.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, current: name === currentName, remote: false })),
      ...remote.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, current: false, remote: true }))
    ]
  }
  async createBranch(name: string): Promise<void> {
    const clean = name.trim()
    if (!clean) throw new Error('Informe o nome da branch.')
    await this.git('check-ref-format', '--branch', clean)
    await this.git('branch', '--', clean)
  }
  async checkoutBranch(name: string): Promise<void> {
    if (!name.trim()) throw new Error('Selecione uma branch.')
    await this.git('switch', '--', name)
  }
  async deleteBranch(name: string, confirmed: boolean): Promise<void> {
    if (!confirmed) throw new Error('Confirme a exclusão da branch.')
    await this.git('branch', '-d', '--', name)
  }
  async hasRemote(): Promise<boolean> { return Boolean((await this.git('remote')).trim()) }
  async fetch(): Promise<void> { if (!await this.hasRemote()) throw new Error('Configure a remote repository before fetching.'); await this.git('fetch', '--all', '--prune') }
  async pull(confirmed = false): Promise<void> { if (!confirmed) throw new Error('Confirm before pulling remote changes.'); if (!await this.hasRemote()) throw new Error('Configure a remote repository before pulling.'); await this.git('pull', '--ff-only') }
  async push(confirmed = false): Promise<void> { if (!confirmed) throw new Error('Confirm before pushing changes.'); if (!await this.hasRemote()) throw new Error('Configure a remote repository before pushing.'); await this.git('push') }
  async log(limit = 50, file?: string): Promise<RepositoryCommit[]> {
    const count = Math.max(1, Math.min(200, Math.floor(limit)))
    if (file) await projectFilePath(this.path, file)
    const raw = await this.git('log', `-${count}`, '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s', '--', ...(file ? [file] : []))
    return raw.split('\n').filter(Boolean).map(parseCommit)
  }
  async graph(limit = 100): Promise<RepositoryGraphCommit[]> {
    const count = Math.max(1, Math.min(200, Math.floor(limit)))
    const raw = await this.git('log', '--all', `-${count}`, '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D')
    return raw.split('\n').filter(Boolean).map((record) => {
      const [hash = '', parents = '', author = '', email = '', date = '', message = '', refs = ''] = record.split('\x1f')
      return { hash, parents: parents ? parents.split(' ') : [], author, email, date, message, refs: refs.split(',').map((ref) => ref.trim()).filter(Boolean) }
    })
  }
  async readConflict(file: string): Promise<MergeConflictFile> {
    await projectFilePath(this.path, file)
    if (!(await this.status()).changes.some((change) => change.path === file && change.state === 'conflicted')) throw new Error('Select a file with an active merge conflict.')
    const stage = async (number: 1 | 2 | 3): Promise<string> => {
      try { return await this.git('show', `:${number}:${file}`) } catch { return '' }
    }
    return { path: file, base: await stage(1), ours: await stage(2), theirs: await stage(3), result: await readFile(await projectFilePath(this.path, file), 'utf8') }
  }
  async saveConflictResolution(file: string, contents: string): Promise<void> {
    await projectFilePath(this.path, file)
    if (!(await this.status()).changes.some((change) => change.path === file && change.state === 'conflicted')) throw new Error('Select a file with an active merge conflict.')
    await writeProjectFile(this.path, file, contents)
  }
  async markConflictResolved(file: string): Promise<void> {
    await projectFilePath(this.path, file)
    if (!(await this.status()).changes.some((change) => change.path === file && change.state === 'conflicted')) throw new Error('Select a file with an active merge conflict.')
    await this.git('add', '--', file)
  }
}

export async function cloneRepository(url: string, destination: string): Promise<void> {
  const cleanUrl = url.trim()
  if (!cleanUrl || cleanUrl.startsWith('-') || /[\r\n\0]/.test(cleanUrl)) throw new Error('Enter a valid repository URL.')
  const target = resolve(destination)
  try { await access(target); throw new Error('The clone destination already exists.') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  await execFileAsync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'protocol.ext.allow=never', 'clone', '--', cleanUrl, target], { encoding: 'utf8', maxBuffer, shell: false, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' } })
}

export async function linkProject(root: string, name: string, connectionId: string, connectionName: string, database: string, model: 'dedicated' | 'shared'): Promise<ProjectMetadata> {
  let project: ProjectMetadata
  try { project = await openProject(root) } catch { project = await createProject(root, name) }
  project.linkedDatabase = { connectionId, connectionName, database, model }
  await writeProjectMetadata(project.root, project)
  return project
}

export async function projectFileStatuses(root: string): Promise<ProjectFileStatus[]> {
  const project = await openProject(root)
  let changes: WorkingChange[] = []
  try { changes = (await new GitRepository(root).status()).changes } catch { /* folders can be source projects before git init */ }
  const stateByPath = new Map(changes.map((change) => [change.path, change.state]))
  const paths = [...new Set([...project.files, ...changes.map((change) => change.path)])].filter((path) => path.toLowerCase().endsWith('.sql'))
  return paths.map((path) => ({ path, category: path.split('/')[0] ?? 'scripts', state: stateByPath.get(path) ?? 'clean' }))
}

export async function readProjectScripts(root: string, files: string[]): Promise<Array<{ path: string; contents: string }>> {
  const project = await openProject(root)
  const results: Array<{ path: string; contents: string }> = []
  for (const file of [...new Set(files)]) {
    if (!project.files.includes(file)) throw new Error('Select scripts that belong to this project.')
    const target = await projectFilePath(project.root, file)
    const info = await lstat(target)
    if (!info.isFile()) throw new Error('Project scripts must be regular files.')
    results.push({ path: file, contents: await readFile(target, 'utf8') })
  }
  return results
}

export function parseChange(record: string): WorkingChange {
  const status = record.slice(0, 2)
  const path = record.slice(3)
  const conflicted = ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status)
  const state: WorkingChange['state'] = conflicted ? 'conflicted' : status === '??' ? 'untracked' : status.includes('D') ? 'deleted' : status.includes('A') ? 'added' : 'modified'
  return { path, state, staged: status[0] !== ' ' && status !== '??' }
}

function parseCommit(record: string): RepositoryCommit {
  const [hash = '', author = '', email = '', date = '', ...message] = record.split('\x1f')
  return { hash, author, email, date, message: message.join('\x1f') }
}

function metadataPath(root: string): string { return join(root, '.dbproj.json') }
function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

async function projectFilePath(root: string, file: string): Promise<string> {
  if (!file.trim() || isAbsolute(file)) throw new Error('O caminho do arquivo deve ser relativo ao projeto.')
  const rootAbsolute = resolve(root)
  const resolved = resolve(rootAbsolute, file)
  const rootReal = await realpath(root)
  if (!isWithin(rootAbsolute, resolved)) throw new Error('O arquivo deve permanecer dentro da pasta do projeto.')
  const rel = relative(rootAbsolute, resolved)
  let cursor = rootReal
  for (const part of rel.split(sep).slice(0, -1)) {
    cursor = join(cursor, part)
    try {
      const info = await lstat(cursor)
      if (info.isSymbolicLink() || !info.isDirectory() || !isWithin(rootReal, await realpath(cursor))) throw new Error('O caminho do arquivo não pode atravessar links simbólicos.')
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error }
  }
  try {
    const info = await lstat(resolved)
    if (info.isSymbolicLink() || !isWithin(rootReal, await realpath(resolved))) throw new Error('O arquivo não pode ser um link simbólico.')
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  return resolved
}

async function writeProjectFile(root: string, file: string, contents: string): Promise<void> {
  let path = await projectFilePath(root, file)
  await mkdir(dirname(path), { recursive: true })
  path = await projectFilePath(root, file)
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600)
  try { await handle.writeFile(contents, 'utf8') } finally { await handle.close() }
}

async function writeProjectMetadata(root: string, project: ProjectMetadata): Promise<void> {
  await writeProjectFile(root, '.dbproj.json', `${JSON.stringify(project, null, 2)}\n`)
}

export async function createProject(root: string, name: string): Promise<ProjectMetadata> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Project name is empty.')
  const absoluteRoot = resolve(root)
  await mkdir(absoluteRoot, { recursive: true })
  try { await access(metadataPath(absoluteRoot)); throw new Error('Já existe um projeto nesta pasta.') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const metadata: ProjectMetadata = { version: 1, name: cleanName, root: absoluteRoot, connections: [], files: [], createdAt: new Date().toISOString() }
  await writeProjectMetadata(absoluteRoot, metadata)
  return metadata
}

export async function openProject(root: string): Promise<ProjectMetadata> {
  const absoluteRoot = resolve(root)
  try {
    const value: unknown = JSON.parse(await readFile(metadataPath(absoluteRoot), 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('Project file corrupted.')
    const project = value as ProjectMetadata
    if (project.version !== 1 || !project.name || !Array.isArray(project.files) || !Array.isArray(project.connections)) throw new Error('Project file corrupted.')
    return { ...project, root: absoluteRoot }
  } catch (error) {
    if (error instanceof Error && error.message === 'Project file corrupted.') throw error
    throw new Error('Project file corrupted.', { cause: error })
  }
}

export async function addProjectFile(root: string, file: string): Promise<ProjectMetadata> {
  const project = await openProject(root)
  const path = await projectFilePath(project.root, file)
  await access(path)
  const relativePath = relative(project.root, path).split(sep).join('/')
  if (!project.files.includes(relativePath)) project.files.push(relativePath)
  await writeProjectMetadata(project.root, project)
  return project
}

export async function writeProjectScript(root: string, file: string, contents: string): Promise<ProjectMetadata> {
  const project = await openProject(root)
  const path = await projectFilePath(project.root, file)
  if (!path.toLowerCase().endsWith('.sql')) throw new Error('Scripts do projeto devem usar a extensão .sql.')
  await writeProjectFile(project.root, file, contents)
  const relativePath = relative(project.root, path).split(sep).join('/')
  if (!project.files.includes(relativePath)) project.files.push(relativePath)
  await writeProjectMetadata(project.root, project)
  return project
}

function objectSql(database: DatabaseModel, object: SchemaObject): string {
  if (object.kind === 'table') {
    const table = database.tables.find((item) => item.name === object.name)
    if (!table) throw new Error('Definição da tabela não encontrada.')
    return table.createSql ?? createTable(table, database.name)
  }
  if (object.createSql?.trim()) return object.createSql.trim().replace(/;?$/, ';')
  if (object.kind === 'view' && 'definition' in object) return `CREATE VIEW \`${database.name.replaceAll('`', '``')}\`.\`${object.name.replaceAll('`', '``')}\` AS ${object.definition};`
  throw new Error('O servidor não forneceu DDL completo para este objeto.')
}

export async function exportSchemaToFolder(database: DatabaseModel, folder: string): Promise<ExportSchemaReport> {
  const root = resolve(folder)
  await mkdir(root, { recursive: true })
  const objects: Array<{ category: string; object: SchemaObject }> = [
    ...database.tables.map((object) => ({ category: 'tables', object })),
    ...database.views.map((object) => ({ category: 'views', object })),
    ...database.procedures.map((object) => ({ category: 'procedures', object })),
    ...database.functions.map((object) => ({ category: 'functions', object })),
    ...database.triggers.map((object) => ({ category: 'triggers', object })),
    ...database.events.map((object) => ({ category: 'events', object }))
  ]
  const report: ExportSchemaReport = { written: [], errors: [] }
  for (const item of objects) {
    const fileName = item.object.name.replaceAll('/', '_').replaceAll('\\', '_')
    const relativePath = `${item.category}/${fileName}.sql`
    try {
      await projectFilePath(root, relativePath)
      await writeProjectFile(root, relativePath, `${objectSql(database, item.object)}\n`)
      report.written.push(relativePath)
    } catch (error) { report.errors.push({ object: `${item.object.kind} ${item.object.name}`, error: error instanceof Error ? error.message : 'Falha ao exportar DDL.' }) }
  }
  return report
}
