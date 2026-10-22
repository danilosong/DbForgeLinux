import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateCron } from './cron.js'
export { cronMatches, nextCronRun, validateCron } from './cron.js'

export type BackupScheduleBackend = 'systemd' | 'cron'
export interface BackupScheduleRunState { scheduleId: string; status: 'success' | 'failure'; lastRunAt: string }
export interface BackupSchedule {
  id: string
  connectionId: string
  database: string
  directory: string
  cron: string
  retention: number
  enabled: boolean
  backend?: BackupScheduleBackend
  lastRun?: BackupScheduleRunState
}
export interface ListedBackupSchedule extends Omit<BackupSchedule, 'backend'> { nextRunAt: string | null; backend: BackupScheduleBackend | null }
export type ScheduleCommandRunner = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>
export function validateBackupSchedule(value: Partial<BackupSchedule>): Omit<BackupSchedule, 'id'> {
  if (!value.connectionId?.trim() || value.connectionId.length > 128 || !value.database?.trim() || value.database.length > 128 || value.database.includes('\0') || !value.directory || !isAbsolute(value.directory) || value.directory.includes('\0')) throw new Error('Choose a connection, database and absolute backup folder.')
  if (!Number.isInteger(value.retention) || value.retention! < 1 || value.retention! > 1000) throw new Error('Retention must be between 1 and 1000 backups.')
  return { connectionId: value.connectionId.trim(), database: value.database.trim(), directory: value.directory, cron: validateCron(value.cron ?? ''), retention: value.retention!, enabled: value.enabled === true, ...(value.backend === 'systemd' || value.backend === 'cron' ? { backend: value.backend } : {}) }
}

export class BackupScheduleStore {
  constructor(readonly filePath: string) {}
  async list(): Promise<BackupSchedule[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!Array.isArray(value)) throw new Error('Backup schedules are invalid.')
      return value.filter((item): item is BackupSchedule => Boolean(item && typeof item === 'object' && /^[a-f\d-]{36}$/i.test((item as BackupSchedule).id) && typeof (item as BackupSchedule).connectionId === 'string' && typeof (item as BackupSchedule).database === 'string' && typeof (item as BackupSchedule).directory === 'string' && typeof (item as BackupSchedule).cron === 'string' && Number.isInteger((item as BackupSchedule).retention) && typeof (item as BackupSchedule).enabled === 'boolean'))
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async save(value: Partial<BackupSchedule>): Promise<BackupSchedule> {
    const data = validateBackupSchedule(value); const items = await this.list(); const current = value.id ? items.find((item) => item.id === value.id) : undefined
    if (value.id && !current) throw new Error('Backup schedule not found.')
    const saved: BackupSchedule = { ...data, id: current?.id ?? randomUUID() }
    await this.write([...items.filter((item) => item.id !== saved.id), saved]); return saved
  }
  async delete(id: string): Promise<void> { await this.write((await this.list()).filter((item) => item.id !== id)) }
  async update(item: BackupSchedule): Promise<void> { await this.write((await this.list()).map((current) => current.id === item.id ? item : current)) }
  private async write(items: BackupSchedule[]): Promise<void> { await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 }); const temp = `${this.filePath}.${randomUUID()}.tmp`; await writeFile(temp, `${JSON.stringify(items, null, 2)}\n`, { mode: 0o600 }); await rename(temp, this.filePath); await chmod(this.filePath, 0o600) }
}

export class BackupScheduleRunStateStore {
  constructor(readonly filePath: string) {}
  async list(): Promise<BackupScheduleRunState[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!Array.isArray(value)) throw new Error('Backup run state is invalid.')
      return value.filter((item): item is BackupScheduleRunState => Boolean(item && typeof item === 'object' && /^[a-f\d-]{36}$/i.test((item as BackupScheduleRunState).scheduleId) && ['success', 'failure'].includes((item as BackupScheduleRunState).status) && typeof (item as BackupScheduleRunState).lastRunAt === 'string' && !Number.isNaN(Date.parse((item as BackupScheduleRunState).lastRunAt))))
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async record(scheduleId: string, status: BackupScheduleRunState['status'], at = new Date()): Promise<BackupScheduleRunState> {
    safeScheduleId(scheduleId)
    const result = { scheduleId, status, lastRunAt: at.toISOString() }
    const records = await this.list()
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify([...records.filter((item) => item.scheduleId !== scheduleId), result], null, 2)}\n`, { mode: 0o600 })
    await rename(temporaryPath, this.filePath)
    await chmod(this.filePath, 0o600)
    return result
  }
  async failures(): Promise<BackupScheduleRunState[]> { return (await this.list()).filter((item) => item.status === 'failure') }
}

const systemdEscape = (value: string): string => `"${value.replaceAll('%', '%%').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\t', '\\t')}"`
const shellEscape = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
const safeScheduleId = (id: string): string => { if (!/^[a-f\d-]{36}$/i.test(id)) throw new Error('Invalid backup schedule ID.'); return id }
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function systemdWeekdays(field: string): string | null {
  if (field === '*') return '*'
  const output: string[] = []
  for (const unit of field.split(',')) {
    const [range, stepText] = unit.split('/'); const step = stepText ? Number(stepText) : 1
    if (range === '*') {
      if (step === 1) return '*'
      for (let day = 0; day < 7; day += step) output.push(weekdays[day]!)
      continue
    }
    const [start, end = start] = range!.split('-').map(Number)
    if (start === 0 && end === 7 && step === 1) return '*'
    if (end < start || end > 7 || start < 0) return null
    const first = weekdays[start === 7 ? 0 : start]!
    const last = weekdays[end === 7 ? 0 : end]!
    output.push(start === end ? first : `${first}..${last}${step > 1 ? `/${step}` : ''}`)
  }
  return output.join(',')
}
export function cronToSystemdCalendar(expression: string): string[] | null {
  const [minute, hour, day, month, weekday] = validateCron(expression).split(' ')
  const systemWeekday = systemdWeekdays(weekday!)
  if (!systemWeekday) return null
  const time = `${hour}:${minute}:00`
  const date = `*-${month}-${day}`
  if (day !== '*' && weekday !== '*') return [`${date} ${time}`, `${systemWeekday} *-${month}-* ${time}`]
  return [systemWeekday === '*' ? `${date} ${time}` : `${systemWeekday} ${date} ${time}`]
}

/**
 * Sandboxing for the backup user unit, each line verified with the packaged Electron binary on
 * Ubuntu 26.04 (real backup over TCP + keyring bus). Mount-namespace options (ProtectHome,
 * ProtectSystem, PrivateTmp) are silently ignored by user managers where unprivileged user
 * namespaces are restricted; SystemCallFilter=@system-service intermittently kills the GPU
 * process, MemoryDenyWriteExecute breaks the V8 JIT and RestrictNamespaces breaks the Chromium
 * sandbox. Full table: document/security-linux-hardening.md.
 */
const backupServiceHardening = ['NoNewPrivileges=yes', 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK', 'LockPersonality=yes', 'RestrictRealtime=yes', 'RestrictSUIDSGID=yes', 'SystemCallArchitectures=native', 'UMask=0077'].map((line) => `${line}\n`).join('')

export interface BackupScheduleBackendOptions {
  homeDirectory: string
  executablePath: string
  appPath?: string
  runner?: ScheduleCommandRunner
  temporaryDirectory?: string
}

export class BackupScheduleBackendManager {
  private readonly userUnitDirectory: string
  private readonly runner: ScheduleCommandRunner
  private readonly temporaryDirectory: string
  constructor(private readonly options: BackupScheduleBackendOptions) {
    this.userUnitDirectory = join(options.homeDirectory, '.config', 'systemd', 'user')
    this.temporaryDirectory = options.temporaryDirectory ?? tmpdir()
    this.runner = options.runner ?? ((file, args) => new Promise((resolve, reject) => {
      import('node:child_process').then(({ execFile }) => execFile(file, args, { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })))
    }))
  }

  async install(schedule: BackupSchedule): Promise<BackupScheduleBackend> {
    safeScheduleId(schedule.id); const cron = validateCron(schedule.cron)
    if (await this.systemdAvailable() && cronToSystemdCalendar(cron)) {
      await this.removeCron(schedule.id)
      await this.importSessionBusEnvironment()
      await this.installSystemd(schedule, cron)
      return 'systemd'
    }
    await this.removeSystemd(schedule.id)
    await this.installCron(schedule, cron)
    return 'cron'
  }

  async pause(schedule: BackupSchedule): Promise<void> {
    if (schedule.backend === 'systemd') await this.removeSystemd(schedule.id)
    else if (schedule.backend === 'cron') await this.removeCron(schedule.id)
    else { await this.removeSystemd(schedule.id); await this.removeCron(schedule.id) }
  }
  async remove(id: string, backend?: BackupScheduleBackend): Promise<void> {
    safeScheduleId(id)
    if (backend === 'systemd') await this.removeSystemd(id)
    else if (backend === 'cron') await this.removeCron(id)
    else { await this.removeSystemd(id); await this.removeCron(id) }
  }

  private async systemdAvailable(): Promise<boolean> {
    try { await this.runner('systemctl', ['--user', 'show-environment']); return true } catch { return false }
  }
  private async importSessionBusEnvironment(): Promise<void> {
    if (!process.env.DBUS_SESSION_BUS_ADDRESS) return
    try { await this.runner('systemctl', ['--user', 'import-environment', 'DBUS_SESSION_BUS_ADDRESS']) }
    catch (error) { throw new Error('Could not make the active user session bus available to the backup timer.', { cause: error }) }
  }
  private unitBase(id: string): string { return `tuxsql-backup-${safeScheduleId(id)}` }
  private async installSystemd(schedule: BackupSchedule, cron: string): Promise<void> {
    const base = this.unitBase(schedule.id); await mkdir(this.userUnitDirectory, { recursive: true, mode: 0o700 })
    const executable = [this.options.executablePath, ...(this.options.appPath ? [this.options.appPath] : []), '--no-sandbox', '--run-backup-schedule', schedule.id].map(systemdEscape).join(' ')
    const service = `[Unit]\nDescription=TuxSQL scheduled backup for ${schedule.id}\n\n[Service]\nType=oneshot\nExecStart=${executable}\nStandardOutput=journal\nStandardError=journal\n${backupServiceHardening}`
    const calendars = cronToSystemdCalendar(cron)
    if (!calendars) throw new Error('This schedule requires cron because systemd cannot represent its weekday range.')
    const timer = `[Unit]\nDescription=TuxSQL scheduled backup timer for ${schedule.id}\n\n[Timer]\n${calendars.map((calendar) => `OnCalendar=${calendar}`).join('\n')}\nPersistent=true\nUnit=${base}.service\n\n[Install]\nWantedBy=timers.target\n`
    await writeFile(join(this.userUnitDirectory, `${base}.service`), service, { mode: 0o600 }); await chmod(join(this.userUnitDirectory, `${base}.service`), 0o600)
    await writeFile(join(this.userUnitDirectory, `${base}.timer`), timer, { mode: 0o600 }); await chmod(join(this.userUnitDirectory, `${base}.timer`), 0o600)
    await this.runner('systemctl', ['--user', 'daemon-reload'])
    await this.runner('systemctl', ['--user', 'enable', '--now', `${base}.timer`])
    void cron
  }
  private async removeSystemd(id: string): Promise<void> {
    const base = this.unitBase(id)
    try { await this.runner('systemctl', ['--user', 'disable', '--now', `${base}.timer`]) } catch { /* A missing or inactive unit needs no action. */ }
    await Promise.all([unlink(join(this.userUnitDirectory, `${base}.timer`)).catch(() => undefined), unlink(join(this.userUnitDirectory, `${base}.service`)).catch(() => undefined)])
    try { await this.runner('systemctl', ['--user', 'daemon-reload']) } catch { /* The daemon may be unavailable during cleanup. */ }
  }
  private async currentCrontab(): Promise<string> {
    try { return (await this.runner('crontab', ['-l'])).stdout.replace(/\s+$/, '') } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') throw new Error('No user scheduler is available: install systemd user timers or cron.', { cause: error })
      if (/no crontab/i.test(String((error as Error & { stderr?: string }).stderr ?? (error as Error).message))) return ''
      throw new Error('Could not read the current user crontab.', { cause: error })
    }
  }
  private async writeCrontab(contents: string): Promise<void> {
    const path = join(this.temporaryDirectory, `tuxsql-crontab-${randomUUID()}`)
    await mkdir(this.temporaryDirectory, { recursive: true }); await writeFile(path, contents ? `${contents}\n` : '', { mode: 0o600 })
    try { await this.runner('crontab', [path]) } catch (error) { throw new Error('Could not update the user crontab.', { cause: error }) } finally { await unlink(path).catch(() => undefined) }
  }
  private async removeCron(id: string): Promise<void> {
    const marker = `# TUXSQL_BACKUP:${safeScheduleId(id)}`
    try { const lines = (await this.currentCrontab()).split('\n'); const remaining = lines.filter((line) => !line.trimEnd().endsWith(marker)); if (remaining.length !== lines.length) await this.writeCrontab(remaining.join('\n').replace(/\n+$/, '')) } catch (error) { if (!String((error as Error).message).includes('No user scheduler')) throw error }
  }
  private async installCron(schedule: BackupSchedule, cron: string): Promise<void> {
    const old = (await this.currentCrontab()).split('\n').filter((line) => !line.trimEnd().endsWith(`# TUXSQL_BACKUP:${schedule.id}`))
    const args = [this.options.executablePath, ...(this.options.appPath ? [this.options.appPath] : []), '--run-backup-schedule', schedule.id].map(shellEscape).join(' ')
    await this.writeCrontab([...old, `${cron} ${args} # TUXSQL_BACKUP:${schedule.id}`].filter(Boolean).join('\n'))
  }
}

export function scheduledBackupPath(directory: string, database: string, date: Date): string { const safe = database.replace(/[^A-Za-z0-9_.-]/g, '_'); return join(directory, `${safe}-${date.toISOString().replace(/[:.]/g, '-')}.sql`) }
/** True only for names scheduledBackupPath produces, so retention never touches other files in a shared folder. */
export function isScheduledBackupFileName(name: string, database: string): boolean { const safe = database.replace(/[^A-Za-z0-9_.-]/g, '_'); return name.startsWith(`${safe}-`) && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sql$/.test(name.slice(safe.length + 1)) }
