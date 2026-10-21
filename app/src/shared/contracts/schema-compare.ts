import type { SchemaDifference, DatabaseModel } from '../../modules/schema/index.js'

export interface SchemaCompareResult { differences: SchemaDifference[]; script: string; source: DatabaseModel; target: DatabaseModel }
export interface SchemaCompareApi {
  inspectSchema(connectionId: string, database: string): Promise<DatabaseModel>
  compareSchemas(sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, includeDrops?: boolean): Promise<SchemaCompareResult>
  loadOfflineSchema(kind: 'Scripts Folder' | 'Snapshot'): Promise<DatabaseModel | null>
  compareSchemaModels(source: DatabaseModel, target: DatabaseModel, includeDrops?: boolean): Promise<SchemaCompareResult>
  saveSchemaSnapshot(connectionId: string, database: string): Promise<boolean>
  synchronizeSchema(targetConnectionId: string, targetDatabase: string, script: string, confirmDestructive: boolean): Promise<{ succeeded: number; failed: number; errors: string[] }>
}
