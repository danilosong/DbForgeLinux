import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { BackupScheduleBackendManager, BackupScheduleRunStateStore, BackupScheduleStore, cronToSystemdCalendar, nextCronRun, validateBackupSchedule, validateCron, type ScheduleCommandRunner } from '../../src/modules/database-tools/scheduler.js'
import { runScheduledBackup } from '../../src/main/ipc/scheduledBackup.js'

const baseSchedule = (directory: string) => ({ connectionId: 'connection-a', database: 'sample', directory, cron: '0 2 * * *', retention: 7, enabled: true })
const uuid = '01234567-89ab-4cde-8fab-0123456789ab'

describe('Linux scheduled backups', () => {
  it('validates schedules and calculates the next local cron occurrence', () => {
    expect(validateCron('*/15 2 * * 1-5')).toBe('*/15 2 * * 1-5')
    expect(cronToSystemdCalendar('0 2 * * 1-5')).toEqual(['Mon..Fri *-*-* 2:0:00'])
    expect(cronToSystemdCalendar('0 2 1 * 1')).toEqual(['*-*-1 2:0:00', 'Mon *-*-* 2:0:00'])
    expect(() => cronToSystemdCalendar('0 2 * * 5-1')).toThrow(/out of range/)
    expect(() => validateCron('0 25 * * *')).toThrow(/out of range/)
    expect(() => validateBackupSchedule({ ...baseSchedule('/tmp/backup'), directory: 'relative' })).toThrow(/absolute backup folder/)
    const after = new Date(2026, 4, 4, 1, 59, 30)
    expect(nextCronRun('0 2 * * *', after)?.getTime()).toBe(new Date(2026, 4, 4, 2, 0, 0).getTime())
  })

  it('persists only schedule settings in a private atomic file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-schedule-store-'))
    try {
      const store = new BackupScheduleStore(join(root, 'profile', 'schedules.json'))
      const schedule = await store.save(baseSchedule('/tmp/backup'))
      const saved = await readFile(join(root, 'profile', 'schedules.json'), 'utf8')
      expect(schedule.id).toMatch(/^[a-f\d-]{36}$/i)
      expect(saved).not.toMatch(/password|secret|credential/i)
      expect((await stat(join(root, 'profile', 'schedules.json'))).mode & 0o777).toBe(0o600)
      await store.update({ ...schedule, enabled: false })
      expect((await store.list())[0]?.enabled).toBe(false)
      await store.delete(schedule.id)
      expect(await store.list()).toEqual([])
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('stores only the last success or failure timestamp in a private state file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-schedule-state-'))
    try {
      const file = join(root, 'profile', 'backup-schedule-runs.json')
      const store = new BackupScheduleRunStateStore(file)
      await store.record(uuid, 'failure', new Date('2026-05-04T02:00:00.000Z'))
      expect(await store.failures()).toEqual([{ scheduleId: uuid, status: 'failure', lastRunAt: '2026-05-04T02:00:00.000Z' }])
      await store.record(uuid, 'success', new Date('2026-05-04T02:01:00.000Z'))
      expect(await store.failures()).toEqual([])
      expect(await store.list()).toEqual([{ scheduleId: uuid, status: 'success', lastRunAt: '2026-05-04T02:01:00.000Z' }])
      expect((await stat(file)).mode & 0o777).toBe(0o600)
      expect(await readFile(file, 'utf8')).not.toMatch(/password|secret|credential|resolved-from-vault/i)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('writes a per-schedule systemd user service and timer without embedding credentials', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-systemd-schedule-')); const calls: Array<{ file: string; args: string[] }> = []
    const runner: ScheduleCommandRunner = async (file, args) => { calls.push({ file, args }); return { stdout: '', stderr: '' } }
    try {
      const manager = new BackupScheduleBackendManager({ homeDirectory: root, executablePath: '/opt/TuxSQL/bin/tuxsql app', appPath: "/opt/TuxSQL app/'resources", runner })
      expect(await manager.install({ ...baseSchedule('/tmp/backup'), id: uuid })).toBe('systemd')
      const unitDirectory = join(root, '.config', 'systemd', 'user')
      const names = await readdir(unitDirectory)
      expect(names.sort()).toEqual([`tuxsql-backup-${uuid}.service`, `tuxsql-backup-${uuid}.timer`].sort())
      const service = await readFile(join(unitDirectory, `tuxsql-backup-${uuid}.service`), 'utf8')
      const timer = await readFile(join(unitDirectory, `tuxsql-backup-${uuid}.timer`), 'utf8')
      expect(service).toContain('--run-backup-schedule')
      expect(service).toContain('--no-sandbox')
      expect(service).toContain(uuid)
      expect(service).toContain('StandardOutput=journal')
      expect(service).toContain('StandardError=journal')
      expect(service).not.toMatch(/password|secret|credential/i)
      expect(timer).toContain('Persistent=true')
      expect(timer).toContain('OnCalendar=*-*-* 2:0:00')
      expect(calls).toContainEqual({ file: 'systemctl', args: ['--user', 'enable', '--now', `tuxsql-backup-${uuid}.timer`] })
      await manager.pause({ ...baseSchedule('/tmp/backup'), id: uuid, backend: 'systemd' })
      expect(await readdir(unitDirectory)).toEqual([])
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('uses a marked user crontab entry when systemd user control is unavailable and removes only its own marker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-cron-schedule-')); const calls: string[][] = []; let crontab = 'MAILTO=local\n# keep this comment'
    const runner: ScheduleCommandRunner = async (file, args) => {
      calls.push([file, ...args])
      if (file === 'systemctl') throw Object.assign(new Error('No user bus'), { code: 'ECONNREFUSED' })
      if (args[0] === '-l') return { stdout: crontab, stderr: '' }
      crontab = await readFile(args[0]!, 'utf8')
      return { stdout: '', stderr: '' }
    }
    try {
      const manager = new BackupScheduleBackendManager({ homeDirectory: root, executablePath: "/opt/TuxSQL app/bin", appPath: '/opt/TuxSQL app/resources', runner, temporaryDirectory: root })
      expect(await manager.install({ ...baseSchedule('/tmp/backup'), id: uuid })).toBe('cron')
      expect(crontab).toContain('MAILTO=local')
      expect(crontab).toContain('# keep this comment')
      expect(crontab).toContain(`0 2 * * * '/opt/TuxSQL app/bin' '/opt/TuxSQL app/resources' '--run-backup-schedule' '${uuid}' # TUXSQL_BACKUP:${uuid}`)
      expect(calls.some((call) => call[0] === 'sh')).toBe(false)
      await manager.pause({ ...baseSchedule('/tmp/backup'), id: uuid, backend: 'cron' })
      expect(crontab).not.toContain('TUXSQL_BACKUP')
      expect(crontab).toContain('# keep this comment')
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('refuses to save an active schedule when neither user scheduler is available', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-no-scheduler-'))
    const runner: ScheduleCommandRunner = async (file) => { throw Object.assign(new Error(`${file} is missing`), { code: 'ENOENT' }) }
    try {
      const manager = new BackupScheduleBackendManager({ homeDirectory: root, executablePath: '/usr/bin/tuxsql', runner, temporaryDirectory: root })
      await expect(manager.install({ ...baseSchedule('/tmp/backup'), id: uuid })).rejects.toThrow(/No user scheduler is available/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('runs a due backup through the saved connection reference and writes a private SQL file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-scheduled-run-')); const output = join(root, 'backups')
    const store = new BackupScheduleStore(join(root, 'profile', 'backup-schedules.json'))
    const now = new Date(2026, 4, 4, 2, 0, 0)
    const schedule = await store.save({ ...baseSchedule(output), backend: 'systemd' })
    const calls: string[] = []
    const driver = {
      connect: async (config: { user: string; password?: string }) => { calls.push(`connect:${config.user}:${config.password ?? ''}`); return 'managed-connection' },
      setDatabase: async () => undefined,
      queryRows: async (_connectionId: string, sql: string) => sql.includes('information_schema.SCHEMATA') ? [{ charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }] : [],
      disconnect: async () => { calls.push('disconnect') },
    }
    const stdout: string[] = []; const write = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array) => { stdout.push(String(chunk)); return true }) as typeof process.stdout.write
    try {
      await runScheduledBackup({
        connectionStore: { list: async () => [{ id: 'connection-a', name: 'example', user: 'db-user' }] } as never,
        userDataDir: join(root, 'profile'),
        driver: driver as never,
        resolveConnectionConfig: async () => ({ user: 'db-user', password: 'resolved-from-vault' }) as never,
      }, schedule.id, now)
    } finally { process.stdout.write = write }
    try {
      expect(calls).toContain('connect:db-user:resolved-from-vault')
      expect(calls).toContain('disconnect')
      expect(stdout.join('')).toContain(schedule.id)
      expect(stdout.join('')).not.toContain('resolved-from-vault')
      expect(await new BackupScheduleRunStateStore(join(root, 'profile', 'backup-schedule-runs.json')).list()).toEqual([{ scheduleId: schedule.id, status: 'success', lastRunAt: now.toISOString() }])
      const [file] = await readdir(output)
      expect(file).toMatch(/^sample-.*\.sql$/)
      expect((await stat(join(output, file!))).mode & 0o777).toBe(0o600)
      expect(await readFile(join(output, file!), 'utf8')).toContain('-- TuxSQL database backup')
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('records a failed run when the saved connection is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-scheduled-run-failure-'))
    const userDataDir = join(root, 'profile')
    const now = new Date(2026, 4, 4, 2, 0, 0)
    const schedule = await new BackupScheduleStore(join(userDataDir, 'backup-schedules.json')).save({ ...baseSchedule(join(root, 'backups')), cron: `${now.getMinutes()} ${now.getHours()} * * *` })
    try {
      await expect(runScheduledBackup({ connectionStore: { list: async () => [] } as never, userDataDir, driver: {} as never, resolveConnectionConfig: async () => ({} as never) }, schedule.id, now)).rejects.toThrow('Scheduled backup connection is unavailable.')
      expect(await new BackupScheduleRunStateStore(join(userDataDir, 'backup-schedule-runs.json')).failures()).toEqual([{ scheduleId: schedule.id, status: 'failure', lastRunAt: now.toISOString() }])
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
