import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import { compareData, type DataCompareDifference, type SyncStatement } from '../../modules/data-compare/index.js'

export function registerDataCompareIpc({ driver }: IpcDeps): void {
  const compare = async (sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[], allowDeletes = false) => {
    if (!sourceConnectionId || !targetConnectionId || !sourceDatabase || !targetDatabase || !sourceTable || !targetTable) throw new Error('Selecione as tabelas de origem e destino.')
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('Comparison Key: informe ao menos uma coluna-chave.')
    const differences: DataCompareDifference[] = []
    const statements: SyncStatement[] = []
    const keyedStatements: Array<{ key: Record<string, unknown>; statement: SyncStatement }> = []
    let currentKey: Record<string, unknown> = {}
    const report = await compareData({
      source: { driver, connectionId: sourceConnectionId, database: sourceDatabase, table: sourceTable },
      target: { driver, connectionId: targetConnectionId, database: targetDatabase, table: targetTable },
      keyColumns: keys, columns, allowDeletes,
      onDifference: (difference) => { differences.push(difference); currentKey = difference.key },
      onStatement: (statement) => { statements.push(statement); keyedStatements.push({ key: currentKey, statement }) }
    })
    return { report, differences, statements, keyedStatements }
  }
  ipcMain.handle('data-compare:compare', async (_event, ...args: [string, string, string, string, string, string, string[], string[]?, boolean?]) => {
    return compare(...args)
  })
  ipcMain.handle('data-compare:synchronize', async (_event, sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean, selectedKeys?: Record<string, unknown>[]) => {
    if (!confirmed) throw new Error('Confirme a sincronização antes de alterar os dados de destino.')
    const { keyedStatements } = await compare(sourceConnectionId, sourceDatabase, sourceTable, targetConnectionId, targetDatabase, targetTable, keys, columns, allowDeletes)
    const selected = selectedKeys ? new Set(selectedKeys.map((key) => JSON.stringify(key))) : undefined
    const includedStatements = selected ? keyedStatements.filter(({ key }) => selected.has(JSON.stringify(key))).map(({ statement }) => statement) : keyedStatements.map(({ statement }) => statement)
    if (allowDeletes && !confirmed) throw new Error('Confirme a exclusão de registros de destino.')
    let succeeded = 0
    const errors: string[] = []
    try {
      await driver.withTransaction(targetConnectionId, async (transaction) => {
        for (const statement of includedStatements) {
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
