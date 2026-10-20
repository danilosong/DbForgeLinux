import { BrowserWindow, dialog, ipcMain } from 'electron'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectDatabase } from '../../modules/schema/index.js'
import { GitRepository, addProjectFile, createProject, exportSchemaToFolder, openProject, writeProjectScript } from '../../modules/source-control/index.js'
import type { IpcDeps } from './registry.js'

async function chooseFolder(title: string): Promise<string | null> {
  const options = { title, properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
  const window = BrowserWindow.getFocusedWindow()
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
}

export function registerSourceControlIpc({ driver }: IpcDeps): void {
  ipcMain.handle('source-control:choose-repository', () => chooseFolder('Select Git repository'))
  ipcMain.handle('source-control:status', (_event, path: string) => new GitRepository(path).status())
  ipcMain.handle('source-control:init', (_event, path: string) => new GitRepository(path).initialize())
  ipcMain.handle('source-control:diff', (_event, path: string, file?: string, staged?: boolean) => new GitRepository(path).diff(file, staged))
  ipcMain.handle('source-control:commit', (_event, path: string, message: string, files: string[]) => new GitRepository(path).commit(message, files))
  ipcMain.handle('source-control:branches', (_event, path: string) => new GitRepository(path).branches())
  ipcMain.handle('source-control:create-branch', (_event, path: string, name: string) => new GitRepository(path).createBranch(name))
  ipcMain.handle('source-control:checkout-branch', (_event, path: string, name: string) => new GitRepository(path).checkoutBranch(name))
  ipcMain.handle('source-control:delete-branch', (_event, path: string, name: string, confirmed: boolean) => new GitRepository(path).deleteBranch(name, confirmed))
  ipcMain.handle('source-control:fetch', (_event, path: string) => new GitRepository(path).fetch())
  ipcMain.handle('source-control:pull', (_event, path: string) => new GitRepository(path).pull())
  ipcMain.handle('source-control:push', (_event, path: string) => new GitRepository(path).push())
  ipcMain.handle('source-control:log', (_event, path: string, limit?: number) => new GitRepository(path).log(limit))
  ipcMain.handle('source-control:commit-diff', (_event, path: string, hash: string, file?: string) => new GitRepository(path).diffCommit(hash, file))

  ipcMain.handle('source-control:create-project', async (_event, name: string) => {
    const folder = await chooseFolder('Choose Projects location')
    return folder ? createProject(folder, name) : null
  })
  ipcMain.handle('source-control:open-project', async () => {
    const folder = await chooseFolder('Open Project Folder')
    return folder ? openProject(folder) : null
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
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return report
  })
}
