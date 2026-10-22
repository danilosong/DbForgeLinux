import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from './mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('MySQL driver risk-flow integration', () => {
  const driver = new MysqlDriver()
  let connectionId = ''

  afterAll(async () => { if (connectionId) await driver.disconnect(connectionId) })

  it('kills a server-side streaming query when canceled, then reuses the pool', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection(mysqlTestPrefix('stream_cancel_connection'), 'Streaming cancel risk'),
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067),
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? 'integration-only'
    })

    const controller = new AbortController()
    const result = (async () => {
      for await (const row of driver.streamRows(connectionId, 'SELECT SLEEP(30) AS sleeping', [], controller.signal, 0, 'risk-stream-cancel')) { void row }
    })()
    let active = false
    for (let attempt = 0; attempt < 50; attempt++) {
      const rows = await driver.queryRows(connectionId, "SELECT ID FROM information_schema.PROCESSLIST WHERE INFO = 'SELECT SLEEP(30) AS sleeping'")
      if (rows.length) { active = true; break }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(active).toBe(true)
    controller.abort()
    await result.then(
      () => { throw new Error('The aborted stream unexpectedly completed.') },
      (error: unknown) => {
        const failure = error as { name?: string; code?: string }
        expect(failure.name === 'AbortError' || failure.code === 'ER_QUERY_INTERRUPTED').toBe(true)
      }
    )

    const alive = await driver.executeSql(connectionId, 'SELECT 1 AS alive LIMIT 1')
    expect(alive[0]?.rows[0]?.alive).toBe(1)
    let remaining: Array<Record<string, unknown>> = []
    for (let attempt = 0; attempt < 50; attempt++) {
      remaining = await driver.queryRows(connectionId, "SELECT ID FROM information_schema.PROCESSLIST WHERE INFO = 'SELECT SLEEP(30) AS sleeping'")
      if (!remaining.length) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(remaining).toEqual([])
  }, 15_000)
})
