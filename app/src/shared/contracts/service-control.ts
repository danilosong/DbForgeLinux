export type ServiceState = 'active' | 'inactive' | 'failed' | 'unknown'
export interface MysqlService { unit: string; state: ServiceState; enabled: boolean | null; description: string }
export type MysqlServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable'
export interface ServiceActionResult { service: MysqlService; command: string; authorizationRequired: boolean }
export interface ServiceControlApi {
  listMysqlServices(): Promise<MysqlService[]>
  controlMysqlService(unit: string, action: MysqlServiceAction): Promise<ServiceActionResult>
}
