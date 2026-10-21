import { BrowserWindow, dialog, ipcMain } from 'electron'
import { access, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { inspectDatabase } from '../../modules/schema/index.js'
import { GitRepository, addProjectFile, cloneRepository, createProject, exportSchemaToFolder, linkProject, openProject, projectFileStatuses, readProjectScripts, writeProjectScript } from '../../modules/source-control/index.js'
import type { IpcDeps } from './registry.js'

async function chooseFolder(title: string): Promise<string | null> {
  const options = { title, properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
  const window = BrowserWindow.getFocusedWindow()
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
}

export function registerSourceControlIpc({ driver, userDataDir }: IpcDeps): void {
  const recentFile = join(userDataDir, 'source-control-recent.json')
  async function recents(): Promise<string[]> { try { const value: unknown = JSON.parse(await readFile(recentFile, 'utf8')); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 10) : [] } catch { return [] } }
  async function remember(root: string): Promise<void> { const next = [root, ...(await recents()).filter((item) => item !== root)].slice(0, 10); await writeFile(recentFile, JSON.stringify(next, null, 2), { mode: 0o600 }) }
  ipcMain.handle('source-control:choose-repository', () => chooseFolder('Select Git repository'))
  ipcMain.handle('source-control:choose-project-folder', () => chooseFolder('Choose project folder'))
  ipcMain.handle('source-control:clone-repository', async (_event, url: string, parent: string, folderName: string) => {
    if (!folderName.trim() || basename(folderName) !== folderName || folderName === '.' || folderName === '..') throw new Error('Enter a single folder name for the clone destination.')
    const destination = join(parent, folderName)
    await cloneRepository(url, destination)
    return destination
  })
  ipcMain.handle('source-control:link-database', async (_event, input: { root: string; name: string; connectionId: string; connectionName: string; database: string; model: 'dedicated' | 'shared' }) => {
    const repository = new GitRepository(input.root)
    try { await repository.status() } catch { await repository.initialize() }
    const project = await linkProject(input.root, input.name, input.connectionId, input.connectionName, input.database, input.model)
    await remember(project.root)
    return project
  })
  ipcMain.handle('source-control:has-remote', (_event, path: string) => new GitRepository(path).hasRemote())
  ipcMain.handle('source-control:status', (_event, path: string) => new GitRepository(path).status())
  ipcMain.handle('source-control:init', (_event, path: string) => new GitRepository(path).initialize())
  ipcMain.handle('source-control:diff', (_event, path: string, file?: string, staged?: boolean) => new GitRepository(path).diff(file, staged))
  ipcMain.handle('source-control:commit', (_event, path: string, message: string, files: string[]) => new GitRepository(path).commit(message, files))
  ipcMain.handle('source-control:branches', (_event, path: string) => new GitRepository(path).branches())
  ipcMain.handle('source-control:create-branch', (_event, path: string, name: string) => new GitRepository(path).createBranch(name))
  ipcMain.handle('source-control:checkout-branch', (_event, path: string, name: string) => new GitRepository(path).checkoutBranch(name))
  ipcMain.handle('source-control:delete-branch', (_event, path: string, name: string, confirmed: boolean) => new GitRepository(path).deleteBranch(name, confirmed))
  ipcMain.handle('source-control:fetch', (_event, path: string) => new GitRepository(path).fetch())
  ipcMain.handle('source-control:pull', (_event, path: string, confirmed: boolean) => new GitRepository(path).pull(confirmed))
  ipcMain.handle('source-control:push', (_event, path: string, confirmed: boolean) => new GitRepository(path).push(confirmed))
  ipcMain.handle('source-control:log', (_event, path: string, limit?: number, file?: string) => new GitRepository(path).log(limit, file))
  ipcMain.handle('source-control:commit-diff', (_event, path: string, hash: string, file?: string) => new GitRepository(path).diffCommit(hash, file))
  ipcMain.handle('source-control:graph', (_event, path: string, limit?: number) => new GitRepository(path).graph(limit))
  ipcMain.handle('source-control:conflict-read', (_event, path: string, file: string) => new GitRepository(path).readConflict(file))
  ipcMain.handle('source-control:conflict-save', (_event, path: string, file: string, contents: string) => new GitRepository(path).saveConflictResolution(file, contents))
  ipcMain.handle('source-control:conflict-resolve', (_event, path: string, file: string) => new GitRepository(path).markConflictResolved(file))

  ipcMain.handle('source-control:create-project', async (_event, name: string) => {
    const folder = await chooseFolder('Choose Projects location')
    return folder ? createProject(folder, name) : null
  })
  ipcMain.handle('source-control:open-project', async () => {
    const folder = await chooseFolder('Open Project Folder')
    if (!folder) return null
    const project = await openProject(folder); await remember(project.root); return project
  })
  ipcMain.handle('source-control:open-project-path', async (_event, root: string) => { const project = await openProject(root); await remember(project.root); return project })
  ipcMain.handle('source-control:recent-projects', () => recents())
  ipcMain.handle('source-control:close-project', () => undefined)
  ipcMain.handle('source-control:project-files', (_event, root: string) => projectFileStatuses(root))
  ipcMain.handle('source-control:read-scripts', (_event, root: string, files: string[]) => readProjectScripts(root, files))
  ipcMain.handle('source-control:apply-scripts', async (_event, connectionId: string, database: string, scripts: Array<{ path: string; contents: string }>, confirmed: boolean) => {
    if (!confirmed) throw new Error('Confirm applying the reviewed scripts to the database.')
    if (!scripts.length) throw new Error('Select at least one script.')
    await driver.setDatabase(connectionId, database)
    for (const script of scripts) await driver.executeSql(connectionId, script.contents)
  })
  ipcMain.handle('source-control:add-file', async (_event, root: string) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = { title: 'Add Existing File', properties: ['openFile'] as ('openFile')[], defaultPath: root }
    const selected = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (selected.canceled || !selected.filePaths[0]) return null
    const relative = selected.filePaths[0].slice(root.length).replace(/^[/\\]+/, '')
    return addProjectFile(root, relative)
  })
  ipcMain.handle('source-control:write-script', (_event, root: string, file: string, contents: string) => writeProjectScript(root, file, contents))
  ipcMain.handle('source-control:export-schema', async (_event, connectionId: string, database: string, folder?: string) => {
    if (!connectionId || !database.trim()) throw new Error('Selecione a conexão e o database.')
    const destination = folder ?? await chooseFolder('Script Database to Folder')
    if (!destination) return null
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), database)
    const report = await exportSchemaToFolder(schema, destination)
    try { await access(join(destination, '.dbproj.json'))
      const project = await openProject(destination)
      for (const file of report.written) await addProjectFile(project.root, file)
      await remember(project.root)
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; const project = await createProject(destination, database); for (const file of report.written) await addProjectFile(project.root, file); await remember(project.root) }
    return report
  })
}
