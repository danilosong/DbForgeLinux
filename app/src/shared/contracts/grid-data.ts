import type { EditableResult } from '../../modules/grid-editing/index.js'

export interface MasterDetailRelation { name: string; table: string; rows: Array<Record<string, unknown>>; truncated: boolean }
export interface GridDataApi {
  loadMasterDetails(connectionId: string, master: EditableResult, row: Record<string, unknown>): Promise<MasterDetailRelation[]>
}
