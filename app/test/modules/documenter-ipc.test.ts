import { describe, expect, it, vi } from 'vitest'
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => handlers.set(name, fn) } }))
import { registerDocumenterIpc } from '../../src/main/ipc/documenter.js'
describe('documenter IPC',()=>{it('requires confirmation before writing output files',async()=>{registerDocumenterIpc({driver:{}} as never);await expect(handlers.get('documenter:generate')!({}, {confirmed:false})).rejects.toThrow('Confirm documentation generation.')})})
