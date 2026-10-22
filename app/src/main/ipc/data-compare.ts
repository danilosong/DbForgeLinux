import { ipcMain } from 'electron'
import type { IpcDeps } from './registry.js'
import { compareData, type DataCompareDifference, type DataCompareOptions, type SyncStatement } from '../../modules/data-compare/index.js'

export function registerDataCompareIpc({ driver }: IpcDeps): void {
  const validateOptions = (options?: DataCompareOptions): void => {
    if (!options) return
    const allowed = new Set(['ignoreLob', 'ignoreComputedColumns', 'roundFloats', 'includeColumns', 'excludeColumns'])
    if (Object.keys(options as Record<string, unknown>).some((key) => !allowed.has(key))) throw new TypeError('Unknown Data Compare option.')
    if (options.ignoreLob !== undefined && typeof options.ignoreLob !== 'boolean') throw new TypeError('Invalid LOB option.')
    if (options.ignoreComputedColumns !== undefined && typeof options.ignoreComputedColumns !== 'boolean') throw new TypeError('Invalid computed-column option.')
    if (options.roundFloats !== undefined && (!Number.isInteger(options.roundFloats) || options.roundFloats < 0 || options.roundFloats > 15)) throw new TypeError('Float precision must be between 0 and 15.')
    for (const mask of [options.includeColumns, options.excludeColumns]) if (mask !== undefined && (typeof mask !== 'string' || mask.length > 512 || mask.includes('\0'))) throw new TypeError('Invalid column mask.')
  }
  const compare = async (sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns?: string[], allowDeletes = false, options?: DataCompareOptions) => {
    if (!sourceConnectionId || !targetConnectionId || !sourceDatabase || !targetDatabase || !sourceTable || !targetTable) throw new Error('Select the source and destination tables before comparing.')
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('Comparison Key: enter at least one key column.')
    validateOptions(options)
    const differences: DataCompareDifference[] = []
    const statements: SyncStatement[] = []
    const keyedStatements: Array<{ key: Record<string, unknown>; statement: SyncStatement }> = []
    let currentKey: Record<string, unknown> = {}
    const report = await compareData({
      source: { driver, connectionId: sourceConnectionId, database: sourceDatabase, table: sourceTable },
      target: { driver, connectionId: targetConnectionId, database: targetDatabase, table: targetTable },
      keyColumns: keys, columns, allowDeletes, options,
      onDifference: (difference) => { differences.push(difference); currentKey = difference.key },
      onStatement: (statement) => { statements.push(statement); keyedStatements.push({ key: currentKey, statement }) }
    })
    return { report, differences, statements, keyedStatements }
  }
  ipcMain.handle('data-compare:compare', async (_event, ...args: [string, string, string, string, string, string, string[], string[]?, boolean?, DataCompareOptions?]) => {
    return compare(...args)
  })
  ipcMain.handle('data-compare:synchronize', async (_event, sourceConnectionId: string, sourceDatabase: string, sourceTable: string, targetConnectionId: string, targetDatabase: string, targetTable: string, keys: string[], columns: string[], allowDeletes: boolean, confirmed: boolean, selectedKeys?: Record<string, unknown>[], options?: DataCompareOptions) => {
    if (!confirmed) throw new Error('Confirm synchronization before changing destination data.')
    validateOptions(options)
    const { keyedStatements } = await compare(sourceConnectionId, sourceDatabase, sourceTable, targetConnectionId, targetDatabase, targetTable, keys, columns, allowDeletes, options)
    const selected = selectedKeys ? new Set(selectedKeys.map((key) => JSON.stringify(key))) : undefined
    const includedStatements = selected ? keyedStatements.filter(({ key }) => selected.has(JSON.stringify(key))).map(({ statement }) => statement) : keyedStatements.map(({ statement }) => statement)
    if (allowDeletes && !confirmed) throw new Error('Confirm deletion of destination records.')
    let succeeded = 0
    const errors: string[] = []
    try {
      await driver.withTransaction(targetConnectionId, async (transaction) => {
        for (const statement of includedStatements) {
          try { await transaction.execute(statement.sql, statement.values); succeeded++ }
          catch (error) { errors.push(error instanceof Error ? error.message : 'Statement execution failed.'); throw error }
        }
      })
    } catch (error) {
      if (!errors.length) errors.push(error instanceof Error ? error.message : 'The transaction failed.')
    }
    return { succeeded, failed: errors.length, errors }
  })
}
