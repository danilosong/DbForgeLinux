import type { SchemaDifference, DatabaseModel } from '../../modules/schema/index.js'

export interface SchemaCompareResult { differences: SchemaDifference[]; script: string; source: DatabaseModel; target: DatabaseModel }
export interface SchemaCompareApi {
  compareSchemas(sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, includeDrops?: boolean): Promise<SchemaCompareResult>
  synchronizeSchema(targetConnectionId: string, targetDatabase: string, script: string, confirmDestructive: boolean): Promise<{ succeeded: number; failed: number; errors: string[] }>
}
