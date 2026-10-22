import type { ConnectionRecord } from './connections.js'
export type LocalDatabaseFlavor = 'mysql' | 'mariadb'
export type ContainerEngine = 'docker' | 'podman'
export interface ContainerEngineStatus { available: boolean; engine?: ContainerEngine; status: 'available' | 'unavailable' }
export interface DisposableLocalServer { id: string; name: string; engine: ContainerEngine; flavor: LocalDatabaseFlavor; host: '127.0.0.1'; port?: number; state: 'running' | 'starting' | 'unknown'; profileCreated: boolean; canCreateProfile: boolean }
export interface LocalServerApi {
  inspectLocalContainerEngine(): Promise<ContainerEngineStatus>
  listDisposableLocalServers(): Promise<DisposableLocalServer[]>
  createDisposableLocalServer(flavor: LocalDatabaseFlavor): Promise<DisposableLocalServer>
  removeDisposableLocalServer(id: string, confirmation: string): Promise<void>
  createDisposableConnectionProfile(id: string): Promise<Pick<ConnectionRecord, 'id' | 'name'>>
}
export function requiredContainerRemovalConfirmation(name: string): string { return `REMOVE ${name}` }
