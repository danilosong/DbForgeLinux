import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { IpcDeps } from '../../src/main/ipc/registry.js'

const ipc = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => ipc.handlers.set(name, handler) } }))

import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { registerSessionsIpc } from '../../src/main/ipc/sessions.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
const call = (name: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(ipc.handlers.get(name)!({}, ...args))

describe.skipIf(!enabled)('Server Variables against the disposable MySQL', () => {
  const driver = new MysqlDriver()
  let connectionId = ''
  let original = ''
  const read = async (): Promise<string> => String((await driver.queryRows(connectionId, 'SELECT @@GLOBAL.max_connections AS v'))[0]?.v)

  beforeAll(async () => {
    connectionId = await driver.connect({ ...createDefaultConnection('server-variables', 'variables'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
    registerSessionsIpc({ driver } as unknown as IpcDeps)
    original = await read()
  })

  afterAll(async () => {
    if (!connectionId) return
    await driver.executeSql(connectionId, `SET GLOBAL max_connections = ${Number(original)}`)
    await driver.executeSql(connectionId, 'RESET PERSIST IF EXISTS max_connections')
    await driver.disconnect(connectionId)
  })

  it('refuses SET GLOBAL without the typed name and applies the previewed statement once confirmed', async () => {
    const target = String(Number(original) + 7)
    const change = { name: 'max_connections', oldValue: original, newValue: target, scope: 'GLOBAL', dynamic: true }
    await expect(call('sessions:set-variable', connectionId, change, { confirm: true })).rejects.toThrow('Type the variable name')
    expect(await read()).toBe(original)
    const preview = await call('sessions:preview-variable', connectionId, change, {}) as { sql: string; requiresTypedConfirmation: boolean }
    expect(preview).toMatchObject({ sql: `SET GLOBAL max_connections = ${target}`, requiresTypedConfirmation: true })
    await call('sessions:set-variable', connectionId, change, { confirm: true, confirmation: 'max_connections' })
    expect(await read()).toBe(target)
  })

  it('SET PERSIST also needs the typed name and lands in performance_schema.persisted_variables', async () => {
    const target = String(Number(original) + 9)
    const change = { name: 'max_connections', oldValue: original, newValue: target, scope: 'GLOBAL', dynamic: true }
    await expect(call('sessions:set-variable', connectionId, change, { confirm: true, persist: true, confirmation: 'wrong' })).rejects.toThrow('Type the variable name')
    await call('sessions:set-variable', connectionId, change, { confirm: true, persist: true, confirmation: 'max_connections' })
    const persisted = await driver.queryRows(connectionId, "SELECT VARIABLE_VALUE AS v FROM performance_schema.persisted_variables WHERE VARIABLE_NAME = 'max_connections'")
    expect(String(persisted[0]?.v)).toBe(target)
  })

  it('SET SESSION keeps the plain confirmation (only the caller session changes)', async () => {
    await call('sessions:set-variable', connectionId, { name: 'sql_select_limit', oldValue: '', newValue: '500', scope: 'SESSION', dynamic: true }, { confirm: true })
  })
})
