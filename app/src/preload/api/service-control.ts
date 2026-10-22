import { ipcRenderer } from 'electron'
import type { ServiceControlApi } from '../../shared/contracts/service-control.js'

export const serviceControlApi: ServiceControlApi = {
  listMysqlServices: () => ipcRenderer.invoke('service-control:list'),
  controlMysqlService: (unit, action, confirmation) => ipcRenderer.invoke('service-control:action', unit, action, confirmation),
  readMysqlServiceLogs: (unit) => ipcRenderer.invoke('service-control:logs', unit)
}
