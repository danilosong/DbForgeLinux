import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { executeLargeScript } from '../../src/modules/database-tools/largeScript.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const enabled = process.env.MYSQL_INTEGRATION === '1'
const container = process.env.MYSQL_DUMP_DOCKER_CONTAINER
const password = process.env.MYSQL_PASSWORD ?? 'integration-only'

describe.skipIf(!enabled || !container)('Execute Large Script restores a real mysqldump (several tables)', () => {
  const driver = new MysqlDriver()
  const source = mysqlTestPrefix('ls_dump_source')
  const target = mysqlTestPrefix('ls_dump_target')
  let connectionId = ''
  let dir = ''
  let isMariaDb = false
  const tables = ['customers', 'orders', 'notes']
  const checksums = async (database: string): Promise<string[]> => {
    const rows = await driver.queryRows(connectionId, `CHECKSUM TABLE ${tables.map((name) => `\`${database}\`.\`${name}\``).join(', ')}`)
    return rows.map((row) => String(row.Checksum))
  }

  beforeAll(async () => {
    connectionId = await driver.connect({ ...createDefaultConnection('ls-dump', 'dump'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password })
    isMariaDb = /mariadb/i.test(String((await driver.queryRows(connectionId, 'SELECT VERSION() AS version'))[0]?.version ?? ''))
    for (const database of [source, target]) await driver.executeSql(connectionId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${source}\`.customers (id INT PRIMARY KEY, name VARCHAR(80), city VARCHAR(40))`)
    await driver.executeSql(connectionId, `CREATE TABLE \`${source}\`.orders (id INT PRIMARY KEY, customer_id INT, total DECIMAL(10,2), placed DATETIME, FOREIGN KEY (customer_id) REFERENCES customers(id))`)
    await driver.executeSql(connectionId, `CREATE TABLE \`${source}\`.notes (id INT PRIMARY KEY, body TEXT)`)
    // Enough rows that mysqldump splits each table into several ~1 MB extended INSERTs.
    const recursionVariable = isMariaDb ? 'max_recursive_iterations' : 'cte_max_recursion_depth'
    await driver.executeSql(connectionId, `SET SESSION ${recursionVariable} = 100000; INSERT INTO \`${source}\`.customers WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 30000) SELECT i, CONCAT('Customer ', i, ' O''Brien'), ELT(1 + i % 3, 'São Paulo', 'Curitiba', 'Recife') FROM n`)
    await driver.executeSql(connectionId, `SET SESSION ${recursionVariable} = 100000; INSERT INTO \`${source}\`.orders WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60000) SELECT i, 1 + i % 30000, i * 1.25, '2026-10-22 10:00:00' FROM n`)
    await driver.queryRows(connectionId, `INSERT INTO \`${source}\`.notes VALUES (?, ?), (?, ?), (?, ?)`, [1, 'semicolon; inside -- not a comment', 2, "quote ' and backslash \\ and DELIMITER $$", 3, '/* not a block */ DROP TABLE x; DELETE FROM y'])
    await driver.executeSql(connectionId, `CREATE TRIGGER \`${source}\`.notes_bi BEFORE INSERT ON \`${source}\`.notes FOR EACH ROW BEGIN IF NEW.body IS NULL THEN SET NEW.body = ''; END IF; END`)
    dir = await mkdtemp(join(tmpdir(), 'tuxsql-ls-dump-'))
  }, 120_000)

  afterAll(async () => {
    if (connectionId) {
      for (const database of [source, target]) await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${database}\``)
      await driver.disconnect(connectionId)
    }
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('restores every table byte-for-byte, including the trigger, through the streaming parser', async () => {
    const dumpClient = isMariaDb ? 'mariadb-dump' : 'mysqldump'
    const dumpOptions = ['--host=127.0.0.1', '--port=3306', '--user=root', '--triggers', '--routines', '--single-transaction', ...(isMariaDb ? [] : ['--set-gtid-purged=OFF']), source]
    const dump = execFileSync('docker', ['exec', '-e', `MYSQL_PWD=${password}`, container!, dumpClient, ...dumpOptions], { maxBuffer: 256 * 1024 * 1024 })
    const normalizedDump = isMariaDb ? dump.toString('utf8').replaceAll(source, target) : dump.toString('utf8')
    const path = join(dir, 'dump.sql')
    await writeFile(path, normalizedDump)
    const inserts = dump.toString('utf8').split('\n').filter((line) => line.startsWith('INSERT INTO')).length
    expect(inserts).toBeGreaterThan(tables.length)
    expect((await stat(path)).size).toBeGreaterThan(2 * 1024 * 1024)

    await driver.setDatabase(connectionId, target)
    const report = await driver.withSplitterCompatibleSqlMode(connectionId, (execute) => executeLargeScript({ path, encoding: 'utf8', databaseSelected: true, execute: async (sql) => { await execute(sql) }, onProgress: () => undefined, onError: async (error) => { throw new Error(`statement ${error.statement}: ${error.message}`) } }))

    expect(report.errors).toEqual([])
    expect(report.stopped).toBe(false)
    expect(await checksums(target)).toEqual(await checksums(source))
    const triggers = await driver.queryRows(connectionId, 'SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?', [target])
    expect(triggers.map((row) => row.name)).toEqual(['notes_bi'])
  }, 180_000)
})
