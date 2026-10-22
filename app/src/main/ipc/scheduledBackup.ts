import { chmod, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ConnectionsStore } from '../connections/ConnectionsStore.js'
import type { MysqlDriver } from '../db/MysqlDriver.js'
import type { DriverConnectionConfig } from '../db/DbDriver.js'
import { inspectDatabase } from '../../modules/schema/index.js'
import { createBackupSql } from '../../modules/database-tools/backup.js'
import { BackupScheduleRunStateStore, BackupScheduleStore, cronMatches, scheduledBackupPath } from '../../modules/database-tools/scheduler.js'

export async function runScheduledBackup(input: {
  connectionStore: ConnectionsStore
  userDataDir: string
  driver: MysqlDriver
  resolveConnectionConfig: (record: import('../../shared/contracts.js').ConnectionRecord) => Promise<DriverConnectionConfig>
}, scheduleId: string, now = new Date()): Promise<void> {
  const schedules = new BackupScheduleStore(join(input.userDataDir, 'backup-schedules.json'))
  const runState = new BackupScheduleRunStateStore(join(input.userDataDir, 'backup-schedule-runs.json'))
  const schedule = (await schedules.list()).find((item) => item.id === scheduleId)
  if (!schedule || !schedule.enabled) return
  if (!cronMatches(schedule.cron, now)) return
  const record = (await input.connectionStore.list()).find((item) => item.id === schedule.connectionId)
  let connectionId: string | undefined
  try {
    if (!record) throw new Error('Scheduled backup connection is unavailable.')
    connectionId = await input.driver.connect(await input.resolveConnectionConfig(record))
    await input.driver.setDatabase(connectionId, schedule.database)
    const schema = await inspectDatabase((sql, parameters) => input.driver!.queryRows(connectionId!, sql, parameters), schedule.database)
    const backup = await createBackupSql(schema, true, async (table, offset, limit) => input.driver.queryRows(connectionId!, `SELECT * FROM \`${schedule.database.replaceAll('`', '``')}\`.\`${table.replaceAll('`', '``')}\` LIMIT ${limit} OFFSET ${offset}`))
    const outputDirectory = resolve(schedule.directory)
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
    const destination = scheduledBackupPath(outputDirectory, schedule.database, now)
    await writeFile(destination, backup.sql, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await chmod(destination, 0o600)
    const prefix = `${schedule.database.replace(/[^A-Za-z0-9_.-]/g, '_')}-`
    const files = (await readdir(outputDirectory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.sql'))
    const ordered = await Promise.all(files.map(async (entry) => ({ path: join(outputDirectory, entry.name), mtime: (await stat(join(outputDirectory, entry.name))).mtimeMs })))
    ordered.sort((a, b) => b.mtime - a.mtime)
    const { unlink } = await import('node:fs/promises')
    await Promise.all(ordered.slice(schedule.retention).map((item) => unlink(item.path)))
    await input.driver.disconnect(connectionId)
    connectionId = undefined
    await runState.record(schedule.id, 'success', now)
    process.stdout.write(`TuxSQL backup schedule completed: ${schedule.id}\n`)
  } catch (error) {
    if (connectionId) await input.driver.disconnect(connectionId).catch(() => undefined)
    await runState.record(schedule.id, 'failure', now)
    throw error
  }
}
