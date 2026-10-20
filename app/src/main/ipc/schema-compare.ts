import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import { inspectDatabase, compareSchemas } from '../../modules/schema/index.js'

export function registerSchemaCompareIpc({ driver }: IpcDeps): void {
  ipcMain.handle('schema-compare:compare', async (_event, sourceConnectionId: string, sourceDatabase: string, targetConnectionId: string, targetDatabase: string, includeDrops = false) => {
    if (!sourceConnectionId || !targetConnectionId || !sourceDatabase || !targetDatabase) throw new Error('Selecione origem e destino antes de comparar.')
    const [source, target] = await Promise.all([
      inspectDatabase((sql, parameters) => driver.queryRows(sourceConnectionId, sql, parameters), sourceDatabase),
      inspectDatabase((sql, parameters) => driver.queryRows(targetConnectionId, sql, parameters), targetDatabase)
    ])
    // compareSchemas emits a script that copies its second argument into the first.
    const result = compareSchemas(target, source, { includeDrops })
    return { ...result, source, target }
  })
  ipcMain.handle('schema-compare:synchronize', async (_event, targetConnectionId: string, targetDatabase: string, script: string, confirmDestructive: boolean) => {
    if (!targetConnectionId || !targetDatabase || !script.trim()) throw new Error('Nenhum script selecionado para sincronização.')
    if (/\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(script) && !confirmDestructive) throw new Error('Confirme a possível perda de dados antes de sincronizar.')
    // The target is supplied separately so accidental USE statements cannot redirect writes.
    const statements = script.split(/;\s*(?:\r?\n|$)/).map((sql) => sql.trim()).filter(Boolean)
    const errors: string[] = []
    let succeeded = 0
    for (const statement of statements) {
      try {
        await driver.setDatabase(targetConnectionId, targetDatabase)
        await driver.executeSql(targetConnectionId, statement)
        succeeded++
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Falha ao executar statement.')
        break
      }
    }
    return { succeeded, failed: errors.length, errors }
  })
}
