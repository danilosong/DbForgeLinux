import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { GitRepository, addProjectFile, createProject, exportSchemaToFolder, openProject, writeProjectScript } from '../../src/modules/source-control/index.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const run = promisify(execFile)
const folders: string[] = []
async function temp(): Promise<string> { const folder = await mkdtemp(join(tmpdir(), 'dbforge-source-control-')); folders.push(folder); return folder }
async function git(folder: string, ...args: string[]): Promise<void> { await run('git', ['-C', folder, ...args], { encoding: 'utf8', shell: false }) }
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('source control module', () => {
  it('initializes a repository and previews untracked files as a diff', async () => {
    const folder = await temp(); const repository = new GitRepository(folder)
    await repository.initialize(); await writeFile(join(folder, 'new.sql'), 'SELECT 1;\n')
    expect((await repository.status()).changes).toMatchObject([{ path: 'new.sql', state: 'untracked' }])
    expect(await repository.diff('new.sql')).toContain('+SELECT 1;')
  })

  it('reads status and diff, commits selected files, and lists history and branches', async () => {
    const folder = await temp()
    await git(folder, 'init', '-b', 'main'); await git(folder, 'config', 'user.name', 'Test User'); await git(folder, 'config', 'user.email', 'test@example.com')
    await writeFile(join(folder, 'schema.sql'), 'CREATE TABLE sample (id INT);\n'); await git(folder, 'add', '--', 'schema.sql'); await git(folder, 'commit', '-m', 'Initial schema')
    await writeFile(join(folder, 'schema.sql'), 'CREATE TABLE sample (id BIGINT);\n')
    const repository = new GitRepository(folder)
    expect((await repository.status()).changes).toMatchObject([{ path: 'schema.sql', state: 'modified' }])
    expect(await repository.diff('schema.sql')).toContain('+CREATE TABLE sample (id BIGINT);')
    const commit = await repository.commit('Update id type', ['schema.sql'])
    expect(commit.message).toBe('Update id type')
    expect((await repository.log()).map((item) => item.message)).toEqual(['Update id type', 'Initial schema'])
    expect(await repository.diffCommit(commit.hash)).toContain('id BIGINT')
    await repository.createBranch('feature/new-schema')
    expect((await repository.branches()).map((item) => item.name)).toContain('feature/new-schema')
    await repository.checkoutBranch('feature/new-schema')
    expect((await repository.status()).branch).toBe('feature/new-schema')
    await expect(repository.deleteBranch('main', false)).rejects.toThrow('Confirme')
  })

  it('creates projects and only adds SQL file contents without executing them', async () => {
    const folder = await temp()
    const project = await createProject(folder, 'Commerce')
    expect((await openProject(folder)).name).toBe('Commerce')
    await writeProjectScript(folder, 'scripts/create.sql', 'DROP DATABASE production;')
    const existing = join(folder, 'notes.sql'); await writeFile(existing, 'SELECT 1;')
    const updated = await addProjectFile(folder, 'notes.sql')
    expect(updated.files).toEqual(['scripts/create.sql', 'notes.sql'])
    expect(await readFile(join(folder, 'scripts/create.sql'), 'utf8')).toBe('DROP DATABASE production;')
    expect(project.root).toBe(folder)
    await expect(addProjectFile(folder, '../outside.sql')).rejects.toThrow('permanecer dentro')
    await expect(writeProjectScript(folder, 'bad.txt', 'SELECT 1')).rejects.toThrow('.sql')
  })

  it('exports schema objects as per-object scripts and reports failures without executing them', async () => {
    const folder = await temp()
    const database: DatabaseModel = {
      kind: 'database', name: 'shop',
      tables: [{ kind: 'table', name: 'orders', createSql: 'CREATE TABLE `orders` (`id` int);', columns: [], indexes: [], foreignKeys: [], checks: [] }],
      views: [{ kind: 'view', name: 'order_view', definition: 'SELECT * FROM orders' }], procedures: [], functions: [], triggers: [], events: []
    }
    const report = await exportSchemaToFolder(database, folder)
    expect(report).toEqual({ written: ['tables/orders.sql', 'views/order_view.sql'], errors: [] })
    expect(await readFile(join(folder, 'tables/orders.sql'), 'utf8')).toContain('CREATE TABLE')
    expect(await readFile(join(folder, 'views/order_view.sql'), 'utf8')).toContain('CREATE VIEW')
  })
})
