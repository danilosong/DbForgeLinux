import type { UpdateStatus } from '../../modules/updater/types.js'
export type { UpdateStatus } from '../../modules/updater/types.js'

export interface UpdaterApi {
  updaterCheck(): Promise<UpdateStatus>
  updaterApply(confirmBusy?: boolean): Promise<UpdateStatus>
  updaterCancel(): Promise<UpdateStatus>
  updaterStatus(): Promise<UpdateStatus>
  onUpdaterStatus(handler: (status: UpdateStatus) => void): () => void
}
