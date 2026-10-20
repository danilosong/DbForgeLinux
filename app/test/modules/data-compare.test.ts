import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { compareData, type DataCompareEndpoint } from '../../src/modules/data-compare/index.js'
import type { DataCompareDifference, SyncStatement } from '../../src/modules/data-compare/index.js'
import type { DbDriver } from '../../src/main/db/DbDriver.js'

function endpoint(rows: Record<string, unknown>[], textKeys: string[] = []): DataCompareEndpoint {
  return {
    connectionId: 'c', database: 'db', table: 'items',
    driver: {
      streamRows: async function* () { yield* rows },
      queryRows: async () => textKeys.map((columnName) => ({ columnName, dataType: 'varchar' }))
    } as unknown as DbDriver
  }
}

describe('data compare', () => {
  it('merge-compara em streaming e retorna mudanças parametrizadas sem DELETE por padrão', async () => {
    const differences: DataCompareDifference[] = []
    const statements: SyncStatement[] = []
    const report = await compareData({
      source: endpoint([{ id: 1, label: "O'Reilly" }, { id: 2, label: 'source only' }, { id: 4, label: 'same' }]),
      target: endpoint([{ id: 1, label: 'old' }, { id: 3, label: 'target only' }, { id: 4, label: 'same' }]),
      keyColumns: ['id'], onDifference: (difference) => { differences.push(difference) },
      onStatement: (statement) => { statements.push(statement) }
    })
    expect(report).toEqual({ compared: 4, same: 1, different: 1, sourceOnly: 1, targetOnly: 1, statements: 2 })
    expect(differences.map((item) => item.kind)).toEqual(['different', 'source-only', 'target-only', 'same'])
    expect(statements.map((statement) => statement.kind)).toEqual(['UPDATE', 'INSERT'])
    expect(statements[0].values).toEqual(["O'Reilly", 1])
    expect(statements[1].values).toEqual([2, 'source only'])
    expect(statements[1].sql).toContain('INSERT INTO `db`.`items`')
    expect(statements.every((statement) => !statement.sql.includes("O'Reilly"))).toBe(true)
  })

  it('habilita DELETE somente com opt-in e escreve placeholders no stream', async () => {
    const writes: SyncStatement[] = []
    const output = new PassThrough()
    const chunks: Buffer[] = []; output.on('data', (chunk: Buffer) => chunks.push(chunk))
    const report = await compareData({
      source: endpoint([]), target: endpoint([{ id: 7, label: 'remove' }]), keyColumns: ['id'], allowDeletes: true,
      script: output, onStatement: (statement) => { writes.push(statement) }
    })
    expect(report.statements).toBe(1)
    expect(writes[0]).toMatchObject({ kind: 'DELETE', sql: 'DELETE FROM `db`.`items` WHERE `id` <=> ?', values: [7] })
    expect(Buffer.concat(chunks).toString()).toContain('DELETE FROM `db`.`items` WHERE `id` <=> ?;')
  })

  it('exige chave e não coleta resultados antes da comparação', async () => {
    await expect(compareData({ source: endpoint([]), target: endpoint([]), keyColumns: [] })).rejects.toThrow('coluna-chave')
  })

  it('ordena chaves textuais com collation binária nos dois servidores', async () => {
    const source = endpoint([{ id: 'B' }, { id: 'a' }, { id: 'c' }], ['id'])
    const target = endpoint([{ id: 'B' }, { id: 'a' }, { id: 'c' }], ['id'])
    const sourceQueries: string[] = []
    source.driver.streamRows = async function* (_id, sql) { sourceQueries.push(sql); yield* [{ id: 'B' }, { id: 'a' }, { id: 'c' }] }
    const targetQueries: string[] = []
    target.driver.streamRows = async function* (_id, sql) { targetQueries.push(sql); yield* [{ id: 'B' }, { id: 'a' }, { id: 'c' }] }
    const report = await compareData({ source, target, keyColumns: ['id'] })
    expect(report).toMatchObject({ compared: 3, same: 3 })
    expect(sourceQueries[0]).toContain('CONVERT(`id` USING utf8mb4) COLLATE utf8mb4_bin')
    expect(targetQueries[0]).toContain('CONVERT(`id` USING utf8mb4) COLLATE utf8mb4_bin')
  })
})
