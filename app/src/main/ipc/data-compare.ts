import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import { compareData, type DataCompareDifference, type SyncStatement } from '../../modules/data-compare/index.js'

export function registerDataCompareIpc({ driver }: IpcDeps): void {
  const compare = async (sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[], allowDeletes = false) => {
    if (!sourceConnectionId || !targetConnectionId || !sourceDatabase || !targetDatabase || !sourceTable || !targetTable) throw new Error('Selecione as tabelas de origem e destino.')
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('Comparison Key: informe ao menos uma coluna-chave.')
    const differences: DataCompareDifference[] = []
    const statements: SyncStatement[] = []
    const report = await compareData({
      source: { driver, connectionId: sourceConnectionId, database: sourceDatabase, table: sourceTable },
      target: { driver, connectionId: targetConnectionId, database: targetDatabase, table: targetTable },
      keyColumns: keys, columns, allowDeletes,
      onDifference: (difference) => { differences.push(difference) },
      onStatement: (statement) => { statements.push(statement) }
    })
    return { report, differences, statements }
  }
  ipcMain.handle('data-compare:compare', async (_event, ...args: [string, string, string, string, string, string, string[], string[]?]) => {
    const { report, differences } = await compare(...args)
    return { report, differences }
  })
  ipcMain.handle('data-compare:synchronize', async (_event, sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean) => {
    if (!confirmed) throw new Error('Confirme a sincronização antes de alterar os dados de destino.')
    const { statements } = await compare(sourceConnectionId, sourceDatabase, sourceTable, targetConnectionId, targetDatabase, targetTable, keys, columns, allowDeletes)
    if (allowDeletes && !confirmed) throw new Error('Confirme a exclusão de registros de destino.')
    let succeeded = 0
    const errors: string[] = []
    try {
      await driver.withTransaction(targetConnectionId, async (transaction) => {
        for (const statement of statements) {
          try { await transaction.execute(statement.sql, statement.values); succeeded++ }
          catch (error) { errors.push(error instanceof Error ? error.message : 'Falha ao executar statement.'); throw error }
        }
      })
    } catch (error) {
      if (!errors.length) errors.push(error instanceof Error ? error.message : 'Falha na transação.')
    }
    return { succeeded, failed: errors.length, errors }
  })
}
