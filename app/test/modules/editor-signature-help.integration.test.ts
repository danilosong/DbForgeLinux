import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mysql from 'mysql2/promise'
import { mysql84NativeSignatures } from '../../src/modules/editor/signatureHelp.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'

describe.skipIf(!enabled)('MySQL 8.4 native function signatures', () => {
  let connection: mysql.Connection
  let serverVersion = ''

  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33067),
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? 'integration-only',
      database: 'mysql'
    })
    const [rows] = await connection.query<Array<{ version: string }>>('SELECT VERSION() AS version')
    serverVersion = String(rows[0]?.version ?? '')
    if (/mariadb/i.test(serverVersion)) expect(serverVersion).toMatch(/^11\./)
    else expect(serverVersion).toMatch(/^8\.4\./)
  })

  afterAll(async () => {
    await connection?.end()
  })

  it('executes a read-only SELECT for every catalog function on MySQL 8.4', async ({ skip }) => {
    if (/mariadb/i.test(serverVersion)) skip('This catalog contains MySQL 8.4 native functions and is not a MariaDB function inventory.')
    const missing: string[] = []
    for (const signature of mysql84NativeSignatures) {
      const argumentsSql = signature.parameters.map(() => 'NULL').join(', ')
      try {
        await connection.query(`SELECT ${signature.name}(${argumentsSql}) AS result`)
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'ER_SP_DOES_NOT_EXIST' || code === 'ER_FUNCTION_NOT_DEFINED' || code === 'ER_UNKNOWN_FUNCTION' || /FUNCTION mysql\.[A-Za-z0-9_]+ does not exist/i.test((error as Error).message)) {
          missing.push(`${signature.name}: ${(error as Error).message}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
