import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { createTable } from '../schema/ddl.js'
import type { DatabaseModel, SchemaObject } from '../schema/model.js'
import type { ExportSchemaReport, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryStatus, WorkingChange } from './types.js'

const execFileAsync = promisify(execFile)
const maxBuffer = 16 * 1024 * 1024

export type { ExportSchemaReport, ProjectMetadata, RepositoryBranch, RepositoryCommit, RepositoryStatus, SourceControlState, WorkingChange } from './types.js'

export class GitRepository {
  constructor(readonly path: string) {}
  private async git(...args: string[]): Promise<string> {
    const result = await execFileAsync('git', ['-C', this.path, ...args], { encoding: 'utf8', maxBuffer, shell: false })
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
    if (file && !staged) {
      const status = await this.status()
      if (status.changes.some((change) => change.path === file && change.state === 'untracked')) {
        try { const result = await execFileAsync('git', ['-C', this.path, 'diff', '--no-index', '--no-ext-diff', '--no-color', '--', '/dev/null', resolve(this.path, file)], { encoding: 'utf8', maxBuffer, shell: false }); return result.stdout }
        catch (error) { if (String((error as NodeJS.ErrnoException & { stdout?: string }).code) === '1') return String((error as { stdout?: string }).stdout ?? ''); throw error }
      }
    }
    return this.git('diff', '--no-ext-diff', '--no-color', ...(staged ? ['--cached'] : []), '--', ...(file ? [file] : []))
  }
  async diffCommit(hash: string, file?: string): Promise<string> {
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) throw new Error('Commit hash inválido.')
    return this.git('show', '--no-ext-diff', '--no-color', '--format=fuller', hash, '--', ...(file ? [file] : []))
  }
  async commit(message: string, files: string[]): Promise<RepositoryCommit> {
    const cleanMessage = message.trim()
    if (!cleanMessage) throw new Error('Informe a commit message.')
    if (!files.length) throw new Error('Selecione ao menos um arquivo para commit.')
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
  async fetch(): Promise<void> { await this.git('fetch', '--all', '--prune') }
  async pull(): Promise<void> { await this.git('pull', '--ff-only') }
  async push(): Promise<void> { await this.git('push') }
  async log(limit = 50): Promise<RepositoryCommit[]> {
    const count = Math.max(1, Math.min(200, Math.floor(limit)))
    const raw = await this.git('log', `-${count}`, '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s')
    return raw.split('\n').filter(Boolean).map(parseCommit)
  }
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
function projectFilePath(root: string, file: string): string {
  if (!file.trim() || isAbsolute(file)) throw new Error('O caminho do arquivo deve ser relativo ao projeto.')
  const resolved = resolve(root, file)
  const rel = relative(root, resolved)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('O arquivo deve permanecer dentro da pasta do projeto.')
  return resolved
}

export async function createProject(root: string, name: string): Promise<ProjectMetadata> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Project name is empty.')
  const absoluteRoot = resolve(root)
  await mkdir(absoluteRoot, { recursive: true })
  try { await access(metadataPath(absoluteRoot)); throw new Error('Já existe um projeto nesta pasta.') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const metadata: ProjectMetadata = { version: 1, name: cleanName, root: absoluteRoot, connections: [], files: [], createdAt: new Date().toISOString() }
  await writeFile(metadataPath(absoluteRoot), JSON.stringify(metadata, null, 2), { encoding: 'utf8', mode: 0o600 })
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
  const path = projectFilePath(project.root, file)
  await access(path)
  const relativePath = relative(project.root, path).split(sep).join('/')
  if (!project.files.includes(relativePath)) project.files.push(relativePath)
  await writeFile(metadataPath(project.root), JSON.stringify(project, null, 2), { encoding: 'utf8', mode: 0o600 })
  return project
}

export async function writeProjectScript(root: string, file: string, contents: string): Promise<ProjectMetadata> {
  const project = await openProject(root)
  const path = projectFilePath(project.root, file)
  if (!path.toLowerCase().endsWith('.sql')) throw new Error('Scripts do projeto devem usar a extensão .sql.')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, { encoding: 'utf8', mode: 0o600 })
  const relativePath = relative(project.root, path).split(sep).join('/')
  if (!project.files.includes(relativePath)) project.files.push(relativePath)
  await writeFile(metadataPath(project.root), JSON.stringify(project, null, 2), { encoding: 'utf8', mode: 0o600 })
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
      const path = projectFilePath(root, relativePath)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `${objectSql(database, item.object)}\n`, { encoding: 'utf8', mode: 0o600 })
      report.written.push(relativePath)
    } catch (error) { report.errors.push({ object: `${item.object.kind} ${item.object.name}`, error: error instanceof Error ? error.message : 'Falha ao exportar DDL.' }) }
  }
  return report
}
