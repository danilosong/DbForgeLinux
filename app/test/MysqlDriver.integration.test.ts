import { afterAll, describe, expect, it } from 'vitest'
import { createDefaultConnection } from '../src/shared/connectionDefaults.js'
import { MysqlDriver } from '../src/main/db/MysqlDriver.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('MysqlDriver integration', () => {
  const driver = new MysqlDriver()
  let id: string
  const config = {
    ...createDefaultConnection('integration', 'Integration'),
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 33067),
    user: 'root',
    password: 'integration-only'
  }

  afterAll(async () => { if (id) await driver.disconnect(id) })

  it('testa conexão, lista databases/tabelas e retorna resultados múltiplos', async () => {
    await expect(driver.testConnection(config)).resolves.toHaveProperty('serverVersion')
    id = await driver.connect(config)
    expect(await driver.listDatabases(id)).toContain('sample')
    await driver.executeSql(id, 'CREATE TABLE IF NOT EXISTS sample.items (id INT PRIMARY KEY, name VARCHAR(40)); INSERT INTO sample.items VALUES (1, \'one\') ON DUPLICATE KEY UPDATE name=VALUES(name);')
    expect(await driver.listTables(id, 'sample')).toContain('items')
    const results = await driver.executeSql(id, 'SELECT * FROM sample.items; SELECT COUNT(*) AS total FROM sample.items;')
    expect(results).toHaveLength(2)
    expect(results[0].rows[0]).toMatchObject({ id: 1, name: 'one' })
    expect(results[1].rows[0]).toMatchObject({ total: 1 })
  })
})
