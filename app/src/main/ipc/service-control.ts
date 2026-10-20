import { ipcMain } from 'electron'
import type { MysqlServiceAction } from '../../shared/contracts/service-control.js'
import { controlMysqlService, listMysqlServices } from '../../modules/service-control/index.js'

export function registerServiceControlIpc(): void {
  ipcMain.handle('service-control:list', () => listMysqlServices())
  ipcMain.handle('service-control:action', (_event, unit: string, action: MysqlServiceAction) => controlMysqlService(unit, action))
}
