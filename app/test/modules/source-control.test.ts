import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { GitRepository, addProjectFile, cloneRepository, createProject, exportSchemaToFolder, linkProject, openProject, projectFileStatuses, readProjectScripts, writeProjectScript } from '../../src/modules/source-control/index.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const run = promisify(execFile)
const folders: string[] = []
async function temp(): Promise<string> { const folder = await mkdtemp(join(tmpdir(), 'tuxsql-source-control-')); folders.push(folder); return folder }
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

  it('reads and resolves merge conflict stages and exposes parent links for the commit DAG', async () => {
    const folder = await temp()
    await git(folder, 'init', '-b', 'main'); await git(folder, 'config', 'user.name', 'Test User'); await git(folder, 'config', 'user.email', 'test@example.com')
    await writeFile(join(folder, 'schema.sql'), 'CREATE TABLE sample (id INT);\n-- shared\n')
    await git(folder, 'add', '--', 'schema.sql'); await git(folder, 'commit', '-m', 'Base schema'); await git(folder, 'switch', '-c', 'feature')
    await writeFile(join(folder, 'schema.sql'), 'CREATE TABLE sample (id BIGINT);\n-- shared\n')
    await git(folder, 'commit', '-am', 'Feature type')
    await git(folder, 'switch', 'main')
    await writeFile(join(folder, 'schema.sql'), 'CREATE TABLE sample (id INT);\n-- local change\n')
    await git(folder, 'commit', '-am', 'Main comment')
    await expect(git(folder, 'merge', 'feature')).rejects.toBeDefined()

    const repository = new GitRepository(folder)
    const conflict = await repository.readConflict('schema.sql')
    expect(conflict.base).toContain('id INT')
    expect(conflict.ours).toContain('local change')
    expect(conflict.theirs).toContain('id BIGINT')
    expect(conflict.result).toContain('<<<<<<<')
    await repository.saveConflictResolution('schema.sql', 'CREATE TABLE sample (id BIGINT);\n-- local change\n')
    await repository.markConflictResolved('schema.sql')
    expect((await repository.status()).conflicted).toBe(false)
    await git(folder, 'commit', '-m', 'Merge feature schema')
    const graph = await repository.graph()
    const merge = graph.find((item) => item.message === 'Merge feature schema')
    expect(merge?.parents).toHaveLength(2)
    expect(graph.flatMap((item) => item.refs)).toContain('HEAD -> main')
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

  it('does not write through project symlinks and does not execute repository hooks', async () => {
    const folder = await temp(); const outside = await temp(); const repository = new GitRepository(folder)
    await repository.initialize()
    await git(folder, 'config', 'user.name', 'Test User'); await git(folder, 'config', 'user.email', 'test@example.com')
    await createProject(folder, 'Safe Project')
    await writeFile(join(outside, 'owned.sql'), 'untouched')
    await symlink(outside, join(folder, 'linked'))
    await expect(writeProjectScript(folder, 'linked/owned.sql', 'DROP DATABASE production;')).rejects.toThrow('links simbólicos')
    expect(await readFile(join(outside, 'owned.sql'), 'utf8')).toBe('untouched')

    const marker = join(outside, 'hook-ran')
    const hooks = join(folder, '.git', 'hooks')
    await writeFile(join(hooks, 'pre-commit'), `#!/bin/sh\nprintf ran > '${marker}'\n`)
    await chmod(join(hooks, 'pre-commit'), 0o700)
    await writeFile(join(folder, 'safe.sql'), 'SELECT 1;\n')
    await expect(repository.commit('No hook execution', ['safe.sql'])).resolves.toMatchObject({ message: 'No hook execution' })
    await expect(readFile(marker, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
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

  it('links a database to a dedicated/shared project without storing connection secrets', async () => {
    const folder = await temp()
    await createProject(folder, 'Commerce scripts')
    const linked = await linkProject(folder, 'Commerce scripts', 'conn-1', 'Dev MySQL', 'commerce', 'dedicated')
    expect(linked.linkedDatabase).toEqual({ connectionId: 'conn-1', connectionName: 'Dev MySQL', database: 'commerce', model: 'dedicated' })
    const persisted = await readFile(join(folder, '.dbproj.json'), 'utf8')
    expect(persisted).not.toMatch(/password|secret|credential/i)
    await linkProject(folder, 'Commerce scripts', 'conn-1', 'Dev MySQL', 'commerce', 'shared')
    expect((await openProject(folder)).linkedDatabase?.model).toBe('shared')
  })

  it('clones only into a new destination and blocks remote actions when no remote is configured', async () => {
    const origin = await temp()
    await git(origin, 'init', '-b', 'main')
    await git(origin, 'config', 'user.name', 'Test User')
    await git(origin, 'config', 'user.email', 'test@example.com')
    await mkdir(join(origin, 'tables'), { recursive: true })
    await writeFile(join(origin, 'tables', 'orders.sql'), 'CREATE TABLE orders (id INT);\n')
    await git(origin, 'add', '--', 'tables/orders.sql')
    await git(origin, 'commit', '-m', 'Add order table')
    const parent = await temp()
    const destination = join(parent, 'clone')
    await cloneRepository(origin, destination)
    const repository = new GitRepository(destination)
    expect(await repository.hasRemote()).toBe(true)
    expect((await repository.status()).branch).toBe('main')
    const localOnly = await temp(); const noRemote = new GitRepository(localOnly)
    await noRemote.initialize()
    expect(await noRemote.hasRemote()).toBe(false)
    await expect(noRemote.pull(true)).rejects.toThrow(/remote/i)
    await expect(noRemote.push(true)).rejects.toThrow(/remote/i)
  })

  it('groups project scripts by object folder and reads only listed safe scripts for preview', async () => {
    const folder = await temp()
    await createProject(folder, 'Explorer project')
    await writeProjectScript(folder, 'tables/orders.sql', 'CREATE TABLE orders (id INT);')
    await writeProjectScript(folder, 'procedures/rebuild.sql', 'CALL rebuild();')
    const files = await projectFileStatuses(folder)
    expect(files.map(({ category, path, state }) => [category, path, state])).toEqual([
      ['tables', 'tables/orders.sql', 'clean'], ['procedures', 'procedures/rebuild.sql', 'clean']
    ])
    expect(await readProjectScripts(folder, ['tables/orders.sql'])).toEqual([{ path: 'tables/orders.sql', contents: 'CREATE TABLE orders (id INT);' }])
    await expect(readProjectScripts(folder, ['../outside.sql'])).rejects.toThrow(/belong to this project/)
  })
})
