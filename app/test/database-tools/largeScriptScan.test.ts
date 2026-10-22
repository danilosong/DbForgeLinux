import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const electron = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>(), selected: [] as string[] }))
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => electron.handlers.set(name, handler) },
  dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: electron.selected }) },
  BrowserWindow: { getFocusedWindow: () => null },
  app: { isPackaged: true, getPath: () => tmpdir(), getAppPath: () => tmpdir() }
}))

import { classifyScriptStatement, scanLargeScript } from '../../src/modules/database-tools/largeScript.js'
import { registerDatabaseToolsIpc } from '../../src/main/ipc/database-tools.js'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'

const call = (name: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(electron.handlers.get(name)!({ sender: { send: () => undefined } }, ...args))

describe('Execute Large Script pre-check', () => {
  it('classifies risky statements, ignoring comments and literals', () => {
    expect(classifyScriptStatement('DROP TABLE IF EXISTS t')).toBe('drop')
    expect(classifyScriptStatement('TRUNCATE TABLE t')).toBe('truncate')
    expect(classifyScriptStatement('DELETE FROM t -- WHERE id = 1')).toBe('delete-without-where')
    expect(classifyScriptStatement('UPDATE t SET a = 1')).toBe('update-without-where')
    expect(classifyScriptStatement("GRANT ALL ON *.* TO 'x'@'%'")).toBe('privileges')
    expect(classifyScriptStatement("DROP USER 'x'@'%'")).toBe('privileges')
    expect(classifyScriptStatement('SET GLOBAL max_connections = 10')).toBe('server-settings')
    expect(classifyScriptStatement('SET PERSIST_ONLY innodb_log_file_size = 1')).toBe('server-settings')
    expect(classifyScriptStatement('SET @@GLOBAL.read_only = 1')).toBe('server-settings')
    for (const safe of ['DELETE FROM t WHERE id = 1', "INSERT INTO t VALUES ('DROP TABLE x')", '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */', 'SET @x = @@GLOBAL.max_connections', '-- TRUNCATE t\nSELECT 1', 'CREATE TABLE t (id INT)']) {
      expect(classifyScriptStatement(safe), safe).toBeUndefined()
    }
  })

  it('scans with the same streaming splitter as a run, skipping USE like a run does and keeping bounded memory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-scan-'))
    try {
      const path = join(dir, 'script.sql')
      const bulk = `INSERT INTO t VALUES ${Array.from({ length: 60_000 }, (_, index) => `(${index}, 'drop;where')`).join(',')};\n`
      await writeFile(path, [
        'USE other;', 'DROP TABLE IF EXISTS t;', 'CREATE TABLE t (id INT, v TEXT);', bulk.trim(),
        'DELIMITER $$', 'CREATE PROCEDURE p() BEGIN SELECT 1; END$$', 'DELIMITER ;',
        'DELETE FROM t;', 'UPDATE t SET v = 1 WHERE id = 2;', "GRANT SELECT ON d.* TO 'r'@'%';", 'SET GLOBAL general_log = 1;'
      ].join('\n'), 'utf8')
      const scan = await scanLargeScript({ path, encoding: 'utf8', databaseSelected: true })
      expect(scan.skipped).toBe(1)
      expect(scan.statements).toBe(8)
      expect(scan.risks).toEqual({ drop: 1, truncate: 0, 'delete-without-where': 1, 'update-without-where': 0, privileges: 1, 'server-settings': 1 })
      expect(scan.samples.map(({ statement, kind }) => [statement, kind])).toEqual([[1, 'drop'], [5, 'delete-without-where'], [7, 'privileges'], [8, 'server-settings']])
      expect(scan.samples.every((item) => item.sql.length <= 200)).toBe(true)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it('pre-checks a 50 MB single-line statement within the same memory bound as a run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-scan-'))
    try {
      const path = join(dir, 'extended.sql')
      const handle = await open(path, 'w')
      // Same shape as the run's memory test (one 50 MB literal), so the bound is the one a run already guarantees.
      const block = 'x'.repeat(1024 * 1024)
      try {
        await handle.write("INSERT INTO t VALUES ('drop table x; ")
        for (let index = 0; index < 50; index++) await handle.write(block)
        await handle.write("');\nDELETE FROM t;\n")
      } finally { await handle.close() }
      const before = process.memoryUsage()
      const scan = await scanLargeScript({ path, encoding: 'utf8', databaseSelected: false })
      const after = process.memoryUsage()
      expect(scan.statements).toBe(2)
      expect(scan.risks['delete-without-where']).toBe(1)
      expect(scan.risks.drop).toBe(0)
      expect(after.heapUsed - before.heapUsed).toBeLessThan(200 * 1024 * 1024)
    } finally { await rm(dir, { recursive: true, force: true }) }
  }, 60_000)
})

const enabled = process.env.MYSQL_INTEGRATION === '1'
describe.skipIf(!enabled)('Execute Large Script on a Production-tagged connection (disposable MySQL)', () => {
  const driver = new MysqlDriver()
  const database = mysqlTestPrefix('large_script_prod')
  const server = { host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' }
  let dir = ''; let path = ''; let devId = ''; let prodId = ''
  const count = async (): Promise<number> => Number((await driver.queryRows(devId, `SELECT COUNT(*) AS n FROM \`${database}\`.t`))[0]?.n)

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tuxsql-large-prod-')); path = join(dir, 'load.sql')
    await writeFile(path, 'INSERT INTO t VALUES (1);\nINSERT INTO t VALUES (2);\nDELETE FROM t WHERE id = 1;\n', 'utf8')
    devId = await driver.connect({ ...createDefaultConnection('ls-dev', 'dev'), ...server, environment: 'dev' })
    prodId = await driver.connect({ ...createDefaultConnection('ls-prod', 'prod'), ...server, environment: 'prod' })
    await driver.executeSql(devId, `CREATE DATABASE \`${database}\``)
    await driver.executeSql(devId, `CREATE TABLE \`${database}\`.t (id INT PRIMARY KEY)`)
    registerDatabaseToolsIpc({ driver, userDataDir: dir } as never)
    electron.selected = [path]
    await call('database-tools:large-select')
  })

  afterAll(async () => {
    if (devId) { await driver.executeSql(devId, `DROP DATABASE IF EXISTS \`${database}\``); await driver.disconnect(devId) }
    if (prodId) await driver.disconnect(prodId)
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('refuses Production without the typed database name and runs nothing', async () => {
    await expect(call('database-tools:large-run', prodId, database, path, 'utf8', 'r1')).rejects.toThrow(`Type ${database}`)
    await expect(call('database-tools:large-run', prodId, database, path, 'utf8', 'r2', 'wrong')).rejects.toThrow(`Type ${database}`)
    expect(await count()).toBe(0)
  })

  it('runs on Production once confirmed and on other connections as before', async () => {
    const scan = await call('database-tools:large-scan', database, path, 'utf8') as { statements: number }
    expect(scan.statements).toBe(3)
    await call('database-tools:large-run', prodId, database, path, 'utf8', 'r3', database)
    expect(await count()).toBe(1)
    await driver.executeSql(devId, `DELETE FROM \`${database}\`.t WHERE id > 0`)
    await call('database-tools:large-run', devId, database, path, 'utf8', 'r4')
    expect(await count()).toBe(1)
  })
})
