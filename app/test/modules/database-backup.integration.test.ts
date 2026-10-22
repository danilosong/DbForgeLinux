import { afterAll, describe, expect, it } from 'vitest'
import { MysqlDriver } from '../../src/main/db/MysqlDriver.js'
import { createDefaultConnection } from '../../src/shared/connectionDefaults.js'
import { createBackupSqlWithOptions, restoreBackup } from '../../src/modules/database-tools/backup.js'
import { inspectDatabase } from '../../src/modules/schema/index.js'
import { mysqlTestPrefix } from '../mysqlTestNames.js'
import { execFileSync, spawnSync } from 'node:child_process'

const enabled = process.env.MYSQL_INTEGRATION === '1'
const dumpContainer = process.env.MYSQL_DUMP_DOCKER_CONTAINER
const localDumpBinary = ['mysqldump', 'mariadb-dump'].find((binary) => spawnSync(binary, ['--version'], { stdio: 'ignore' }).status === 0)
describe.skipIf(!enabled)('database backup MySQL integration', () => {
  const driver = new MysqlDriver(); const prefix = mysqlTestPrefix('backup_restore'); const sourceDb = `${prefix}_src`; const targetDb = `${prefix}_dst`; const victimDb = `${prefix}_victim`; let connectionId = ''
  afterAll(async () => {
    if (!connectionId) return
    try { await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${sourceDb}\``).catch(() => undefined); await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${targetDb}\``).catch(() => undefined); await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${victimDb}\``).catch(() => undefined) }
    finally { await driver.disconnect(connectionId).catch(() => undefined) }
  })
  it('backs up an owned throwaway schema and safely restores it to a second throwaway schema', async () => {
    connectionId = await driver.connect({ ...createDefaultConnection(`${prefix}_connection`, 'Backup integration'), host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
    await driver.executeSql(connectionId, `CREATE DATABASE \`${sourceDb}\``); await driver.executeSql(connectionId, `CREATE DATABASE \`${targetDb}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${sourceDb}\`.items (id INT PRIMARY KEY, label VARCHAR(40) NOT NULL)`); await driver.executeSql(connectionId, `INSERT INTO \`${sourceDb}\`.items VALUES (1, 'owned test row')`)
    const schema = await inspectDatabase((sql, parameters) => driver.queryRows(connectionId, sql, parameters), sourceDb)
    const backup = await createBackupSqlWithOptions(schema, { includeStructure: true, includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: true, extendedInserts: true, charset: 'utf8mb4', errorPolicy: 'abort', includeDefiner: true, includeDrop: false, dropIfExists: false, includeUse: false, noAutoValueOnZero: true, lockTables: false, flushLogs: false }, async (table, offset, limit) => driver.queryRows(connectionId, `SELECT * FROM \`${sourceDb}\`.\`${table}\` LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(connectionId, targetDb)
    const restored = await restoreBackup(targetDb, targetDb, backup.sql, async (statement) => { await driver.executeSql(connectionId, statement) })
    expect(restored.errors).toEqual([]); expect(restored.executed).toBeGreaterThan(1)
    const rows = await driver.queryRows(connectionId, 'SELECT id, label FROM items')
    expect(rows).toEqual([{ id: 1, label: 'owned test row' }])
    const sameDatabaseDump = await createBackupSqlWithOptions(schema, { includeStructure: true, includeData: true, objectKinds: ['table'], includeRoutines: false, includeTriggers: false, includeEvents: false, singleTransaction: false, extendedInserts: true, charset: 'utf8mb4', errorPolicy: 'abort', includeDefiner: false, includeDrop: true, dropIfExists: true, includeUse: true, noAutoValueOnZero: false, lockTables: false, flushLogs: false }, async (table, offset, limit) => driver.queryRows(connectionId, `SELECT * FROM \`${sourceDb}\`.\`${table}\` LIMIT ${limit} OFFSET ${offset}`))
    await driver.setDatabase(connectionId, sourceDb)
    const sameDbRestore = await restoreBackup(sourceDb, sourceDb, sameDatabaseDump.sql, async (statement) => { await driver.executeSql(connectionId, statement) })
    expect(sameDbRestore.errors).toEqual([])
    expect(await driver.queryRows(connectionId, 'SELECT id, label FROM items')).toEqual([{ id: 1, label: 'owned test row' }])
  }, 30_000)

  it.skipIf(!dumpContainer && !localDumpBinary)('restores a real mysqldump and keeps splitter and session SQL modes aligned against an escaped-quote payload', async () => {
    const defaults = createDefaultConnection(`${prefix}_mode_connection`, 'Backup SQL mode integration')
    connectionId = await driver.connect({ ...defaults, advanced: { ...defaults.advanced, sqlMode: 'STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES' }, host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
    const isMariaDb = /mariadb/i.test(String((await driver.queryRows(connectionId, 'SELECT VERSION() AS version'))[0]?.version ?? ''))
    await driver.executeSql(connectionId, `DROP DATABASE IF EXISTS \`${sourceDb}\`; DROP DATABASE IF EXISTS \`${targetDb}\`; DROP DATABASE IF EXISTS \`${victimDb}\``)
    await driver.executeSql(connectionId, `CREATE DATABASE \`${sourceDb}\`; CREATE DATABASE \`${targetDb}\`; CREATE DATABASE \`${victimDb}\``)
    await driver.executeSql(connectionId, `CREATE TABLE \`${sourceDb}\`.items (id INT PRIMARY KEY, label TEXT NOT NULL, raw_data BLOB NOT NULL); CREATE TABLE \`${targetDb}\`.items (id INT PRIMARY KEY, label TEXT NOT NULL, raw_data BLOB NOT NULL); CREATE TABLE \`${victimDb}\`.secrets (id INT PRIMARY KEY)`)
    const label = `O'Brien "double quote" \\ backslash`
    const rawData = Buffer.from([0, 0x27, 0x22, 0x5c, 0x00])
    await driver.executeParameterized(connectionId, `INSERT INTO \`${sourceDb}\`.items VALUES (1, ?, ?)`, [label, rawData])
    const password = process.env.MYSQL_PASSWORD ?? 'integration-only'
    const dump = dumpContainer
      ? execFileSync('docker', ['exec', '-e', `MYSQL_PWD=${password}`, dumpContainer, isMariaDb ? 'mariadb-dump' : 'mysqldump', '--host=127.0.0.1', '--port=3306', '--user=root', '--compact', '--no-create-info', '--skip-add-locks', '--skip-triggers', '--hex-blob', sourceDb, 'items'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })
      : execFileSync(localDumpBinary!, [...(localDumpBinary === 'mysqldump' ? ['--column-statistics=0'] : []), '--host=127.0.0.1', '--port', String(process.env.MYSQL_PORT ?? 33067), '--user=root', '--compact', '--no-create-info', '--skip-add-locks', '--skip-triggers', '--hex-blob', sourceDb, 'items'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, MYSQL_PWD: password } })
    const script = dump.toString('utf8').replaceAll(`\`${sourceDb}\`.`, '')
    expect(script).toContain("O\\'Brien")
    expect(script).toContain('double quote')
    expect(script).toContain('0x0027225C00')
    await driver.setDatabase(connectionId, targetDb)
    const initialMode = await driver.executeSql(connectionId, 'SELECT @@SESSION.sql_mode AS sqlMode')
    expect(String(initialMode[0]?.rows[0]?.sqlMode)).toContain('NO_BACKSLASH_ESCAPES')
    const report = await driver.withSplitterCompatibleSqlMode(connectionId, async (execute) => {
      const effectiveMode = await execute('SELECT @@SESSION.sql_mode AS sqlMode')
      expect(String(effectiveMode[0]?.rows[0]?.sqlMode)).not.toContain('NO_BACKSLASH_ESCAPES')
      return restoreBackup(targetDb, targetDb, script, async (statement) => { await execute(statement) })
    })
    expect(report.errors).toEqual([])
    expect(await driver.queryRows(connectionId, `SELECT label, HEX(raw_data) AS bytes FROM \`${targetDb}\`.items`)).toEqual([{ label, bytes: '0027225C00' }])
    const malicious = `INSERT INTO \`${targetDb}\`.items (id, label, raw_data) VALUES (2, 'x\\'); DROP TABLE \`${victimDb}\`.secrets; --', X'00');`
    await expect(driver.withSplitterCompatibleSqlMode(connectionId, (execute) => restoreBackup(targetDb, targetDb, malicious, async (statement) => execute(statement)))).resolves.toMatchObject({ errors: [], executed: 1 })
    expect((await driver.queryRows(connectionId, `SELECT label FROM \`${targetDb}\`.items WHERE id = 2`))[0]?.label).toContain('DROP TABLE')
    expect((await driver.queryRows(connectionId, `SELECT COUNT(*) AS total FROM \`${victimDb}\`.secrets`))[0]?.total).toBe(0)
  }, 30_000)
})
