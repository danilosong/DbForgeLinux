export type ServiceState = 'active' | 'inactive' | 'failed' | 'unknown'
export type ServiceControlErrorCode = 'platformUnavailable' | 'systemctlUnavailable' | 'systemdInactive' | 'systemCommandFailed' | 'unitInvalid' | 'actionInvalid' | 'confirmationMismatch' | 'pkexecUnavailable' | 'serviceActionFailed'
export interface MysqlService { unit: string; state: ServiceState; enabled: boolean | null; description: string }
export type MysqlServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable'
export function requiredActionConfirmation(action: MysqlServiceAction, unit: string): string { return `${action.toUpperCase()} ${unit}` }
export interface ServiceActionResult { service: MysqlService; command: string; authorizationRequired: boolean }
export interface ServiceControlApi {
  listMysqlServices(): Promise<MysqlService[]>
  controlMysqlService(unit: string, action: MysqlServiceAction, confirmation: string): Promise<ServiceActionResult>
  readMysqlServiceLogs(unit: string): Promise<string>
}
