import { describe, expect, it, vi } from 'vitest'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) } }))
import { registerDataGeneratorIpc } from '../../src/main/ipc/data-generator.js'
describe('data generator IPC',()=>{it('requires explicit confirmation before inserting rows',async()=>{registerDataGeneratorIpc({driver:{}} as never);await expect(handlers.get('data-generator:generate')!({}, {confirmed:false})).rejects.toThrow('Confirme a geração de dados.')})})
