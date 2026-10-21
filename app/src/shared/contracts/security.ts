import type { AccountRef, SecurityChange, SecurityPlan, UserAccount, UserSecurityDetails } from '../../modules/security/index.js'

export interface SecurityApi {
  listSecurityAccounts(connectionId: string): Promise<UserAccount[]>
  listSupportedPrivileges(connectionId: string): Promise<string[]>
  getSecurityDetails(connectionId: string, account: AccountRef): Promise<UserSecurityDetails>
  previewSecurityChanges(connectionId: string, changes: SecurityChange[]): Promise<SecurityPlan>
  applySecurityChanges(connectionId: string, changes: SecurityChange[], confirm: true): Promise<Array<{ index: number; success: boolean; error?: string }>>
}
