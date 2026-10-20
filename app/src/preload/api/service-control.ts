import { ipcRenderer } from 'electron'
import type { ServiceControlApi } from '../../shared/contracts/service-control.js'

export const serviceControlApi: ServiceControlApi = {
  listMysqlServices: () => ipcRenderer.invoke('service-control:list'),
  controlMysqlService: (unit, action) => ipcRenderer.invoke('service-control:action', unit, action)
}
