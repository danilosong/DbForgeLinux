import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { applySecurityPlan, buildSecurityPlan, getUserSecurityDetails } from '../../src/modules/security/index.js'
import { killSessions } from '../../src/modules/sessions/index.js'
import { explainQuery } from '../../src/modules/profiler/index.js'
import type { SqlClient } from '../../src/modules/sql.js'
import { mysqlTestPrefix, mysqlTestUser } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('security, sessions and profiler integration', () => {
  const driver = new MysqlDriver()
  let ownerConnection: string
  let workerConnection: string
  let userCreated = false
  const user = mysqlTestUser('security')
  const database = mysqlTestPrefix('security')
  const host = 'localhost'
  const config = {
    ...createDefaultConnection(mysqlTestPrefix('connection'), 'M12 integration'),
    host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: 'integration-only'
  }
  const client = (id: string): SqlClient => ({
    query: (sql, parameters = []) => driver.queryRows(id, sql, [...parameters]),
    execute: async (sql) => { await driver.executeSql(id, sql) }
  })

  afterAll(async () => {
    try {
      if (userCreated && ownerConnection) {
        const plan = buildSecurityPlan([{ kind: 'dropUser', account: { user, host } }], { confirm: true })
        await applySecurityPlan(client(ownerConnection), plan, true).catch(() => undefined)
      }
      if (ownerConnection) await driver.executeSql(ownerConnection, `DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
    } finally {
      if (workerConnection) await driver.disconnect(workerConnection).catch(() => undefined)
      if (ownerConnection) await driver.disconnect(ownerConnection).catch(() => undefined)
    }
  })

  it('creates, grants, introspects, revokes; kills a worker session; and parses EXPLAIN', async () => {
    ownerConnection = await driver.connect(config)
    const security = client(ownerConnection)
    await driver.executeSql(ownerConnection, `CREATE DATABASE \`${database}\``)
    await applySecurityPlan(security, buildSecurityPlan([{ kind: 'createUser', account: { user, host }, password: 'temporary-secret' }]), true)
    userCreated = true
    await applySecurityPlan(security, buildSecurityPlan([{ kind: 'grant', privileges: ['SELECT'], scope: { kind: 'database', database }, grantee: { user, host } }]), true)
    const details = await getUserSecurityDetails(security, { user, host })
    expect(details.grants.join('\n')).toContain(`SELECT ON \`${database}\`.*`)
    expect(details.privileges.some((privilege) => privilege.privilege === 'SELECT')).toBe(true)
    await applySecurityPlan(security, buildSecurityPlan([{ kind: 'revoke', privileges: ['SELECT'], scope: { kind: 'database', database }, grantee: { user, host } }], { confirm: true }), true)
    expect((await getUserSecurityDetails(security, { user, host })).privileges.some((privilege) => privilege.privilege === 'SELECT')).toBe(false)

    const plan = await explainQuery(security, 'SELECT 1 AS value', 'JSON')
    expect(plan.roots.length).toBeGreaterThan(0)
    const analyzed = await explainQuery(security, 'SELECT 1 AS value', 'ANALYZE', { confirmAnalyze: true, serverFamily: 'mysql' })
    expect(analyzed.roots.length).toBeGreaterThan(0)

    workerConnection = await driver.connect(config)
    const workerId = Number((await driver.queryRows(workerConnection, 'SELECT CONNECTION_ID() AS id'))[0].id)
    const sleepingQuery = driver.executeSql(workerConnection, 'SELECT SLEEP(20)').then(() => undefined, () => undefined)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const killed = await killSessions(security, [workerId], 'session', { confirm: true })
    expect(killed).toEqual([{ id: workerId, success: true }])
    await sleepingQuery
  }, 30000)
})

const mariaEnabled = process.env.MARIADB_INTEGRATION === '1'
describe.skipIf(!mariaEnabled)('profiler MariaDB integration', () => {
  const driver = new MysqlDriver()
  let connectionId = ''
  afterAll(async () => { if (connectionId) await driver.disconnect(connectionId).catch(() => undefined) })

  it('runs ANALYZE FORMAT=JSON against a real MariaDB server', async () => {
    connectionId = await driver.connect({
      ...createDefaultConnection(mysqlTestPrefix('mariadb_connection'), 'MariaDB profiler integration'),
      host: process.env.MARIADB_HOST ?? '127.0.0.1', port: Number(process.env.MARIADB_PORT ?? 33069), user: 'root', password: 'integration-only'
    })
    const client: SqlClient = { query: (sql, parameters = []) => driver.queryRows(connectionId, sql, [...parameters]), execute: async (sql) => { await driver.executeSql(connectionId, sql) } }
    const plan = await explainQuery(client, 'SELECT 1 AS value', 'ANALYZE', { confirmAnalyze: true, serverFamily: 'mariadb' })
    expect(plan.roots.length).toBeGreaterThan(0)
    expect(plan.raw).toHaveLength(1)
  }, 30000)
})
