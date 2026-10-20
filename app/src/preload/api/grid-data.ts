import { ipcRenderer } from 'electron'
import type { GridDataApi } from '../../shared/contracts/grid-data.js'

export const gridDataApi: GridDataApi = {
  loadMasterDetails: (connectionId, master, row) => ipcRenderer.invoke('grid-data:master-detail', connectionId, master, row)
}
