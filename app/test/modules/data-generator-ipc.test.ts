import { describe, expect, it, vi } from 'vitest'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) } }))
import { registerDataGeneratorIpc } from '../../src/main/ipc/data-generator.js'
describe('data generator IPC',()=>{const driver={connectionEnvironment:()=> 'dev'};it('requires explicit confirmation before inserting rows',async()=>{registerDataGeneratorIpc({driver} as never);await expect(handlers.get('data-generator:generate')!({}, {confirmed:false})).rejects.toThrow('Confirm data generation.')});it('requires the exact destructive phrase to clear selected tables',async()=>{registerDataGeneratorIpc({driver} as never);await expect(handlers.get('data-generator:generate')!({}, {confirmed:true,database:'shop',tables:['orders'],truncateTables:['orders'],truncateConfirmation:'wrong'})).rejects.toThrow('The table clearing confirmation does not match the selection.')})})

describe('data generator on Production connections', () => {
  const prodDriver = { connectionEnvironment: () => 'prod', queryRows: vi.fn(async () => { throw new Error('must not touch the database') }) }
  const input = { connectionId: 'c', database: 'shop', tables: ['orders'], rowsPerTable: 5, generators: {}, confirmed: true }
  it('blocks generation unless it is released for the run and the database name is typed', async () => {
    registerDataGeneratorIpc({ driver: prodDriver } as never)
    const generate = handlers.get('data-generator:generate')!
    await expect(generate({}, input)).rejects.toThrow('blocked on Production')
    await expect(generate({}, { ...input, productionConfirmation: 'shop' })).rejects.toThrow('blocked on Production')
    await expect(generate({}, { ...input, allowProduction: true })).rejects.toThrow('Type the database name shop')
    await expect(generate({}, { ...input, allowProduction: true, productionConfirmation: 'SHOP' })).rejects.toThrow('Type the database name shop')
    expect(prodDriver.queryRows).not.toHaveBeenCalled()
  })
  it('passes the gate with both the release and the typed name, and never gates other environments', async () => {
    const { assertGenerationAllowedForEnvironment } = await import('../../src/main/ipc/data-generator.js')
    expect(() => assertGenerationAllowedForEnvironment('prod', 'shop', { allowProduction: true, productionConfirmation: 'shop' })).not.toThrow()
    for (const environment of ['none', 'dev', 'test', 'sandbox', 'custom', undefined]) expect(() => assertGenerationAllowedForEnvironment(environment, 'shop', {})).not.toThrow()
  })
})
