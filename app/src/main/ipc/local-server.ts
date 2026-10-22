import { ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type { ConnectionRecord } from '../../shared/contracts.js'
import { createDefaultConnection } from '../../shared/connectionDefaults.js'
import { disposableServerManager } from '../../modules/local-server/index.js'
import type { IpcDeps } from './registry.js'

export function registerLocalServerIpc({ connectionsStore, vault }: IpcDeps): void {
  ipcMain.handle('local-server:inspect', () => disposableServerManager.inspect())
  ipcMain.handle('local-server:list', () => disposableServerManager.list())
  ipcMain.handle('local-server:create', (_event, flavor: 'mysql' | 'mariadb') => disposableServerManager.create(flavor))
  ipcMain.handle('local-server:remove', (_event, id: string, confirmation: string) => disposableServerManager.remove(id, confirmation))
  ipcMain.handle('local-server:create-profile', async (_event, id: string) => {
    const { server, password } = await disposableServerManager.consumeCredentials(id)
    if (!server.port) throw new Error('localServer.error.portPending')
    const connectionId = randomUUID()
    const passwordRef = `disposable-${connectionId}`
    const record: ConnectionRecord = {
      ...createDefaultConnection(connectionId, `Local ${server.flavor} (${server.name.slice(-8)})`),
      type: server.flavor,
      host: '127.0.0.1',
      port: server.port,
      passwordRef,
      environment: 'dev'
    }
    await vault.save(passwordRef, password)
    try { await connectionsStore.save(record) }
    catch (error) { await vault.delete(passwordRef); throw error }
    disposableServerManager.markProfileCreated(id)
    return { id: record.id, name: record.name }
  })
}
