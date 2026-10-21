import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mysql from 'mysql2/promise'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('Connection properties integration', () => {
  const driver = new MysqlDriver()
  const database = `martelo_connection_${process.pid}`
  const adminConfig = { host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' }
  let admin: mysql.Connection | undefined

  beforeAll(async () => {
    admin = await mysql.createConnection(adminConfig)
    await admin.query(`CREATE DATABASE \`${database}\``)
  })

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
      await admin.end()
    }
  })

  it('tests a connection without a default database and enumerates selectable databases', async () => {
    const record = { ...createDefaultConnection('dialog-test', '127.0.0.1:33067'), host: adminConfig.host, port: adminConfig.port, user: adminConfig.user, database: undefined }
    const result = await driver.testConnection({ ...record, password: adminConfig.password, showAllDatabases: false })
    expect(result.serverVersion).toBeTruthy()
    expect(result.databases).toContain(database)
    expect(result.databases).not.toContain('mysql')

    const allDatabases = await driver.testConnection({ ...record, password: adminConfig.password, showAllDatabases: true })
    expect(allDatabases.databases).toContain('mysql')
  })
})
