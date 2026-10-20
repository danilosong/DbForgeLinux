import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'

export interface BackupSchedule { id: string; connectionId: string; database: string; directory: string; cron: string; retention: number; enabled: boolean; lastRunMinute?: string }
const fields = [{ min: 0, max: 59 }, { min: 0, max: 23 }, { min: 1, max: 31 }, { min: 1, max: 12 }, { min: 0, max: 7 }]
export function validateCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error('Cron must have five fields: minute hour day month weekday.')
  parts.forEach((field, index) => {
    if (!/^(?:\*|\*\/\d+|\d+(?:-\d+)?)(?:,\d+(?:-\d+)?)*$/.test(field)) throw new Error(`Invalid cron field: ${field}`)
    for (const unit of field.split(',')) {
      const [range, stepText] = unit.split('/')
      const [first, last = first] = range === '*' ? [fields[index]!.min, fields[index]!.max] : range!.split('-').map(Number)
      if (!Number.isInteger(first) || !Number.isInteger(last) || first < fields[index]!.min || last > fields[index]!.max || last < first) throw new Error(`Cron field is out of range: ${field}`)
      if (stepText && (!Number.isInteger(Number(stepText)) || Number(stepText) < 1 || Number(stepText) > fields[index]!.max - fields[index]!.min + 1)) throw new Error('Cron step must be a positive value within its field range.')
    }
  })
  return parts.join(' ')
}
export function cronMatches(expression: string, date: Date): boolean {
  const values = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()]
  const parts = validateCron(expression).split(' ')
  const matches = (field: string, index: number): boolean => field.split(',').some((unit) => {
    const [range, stepText] = unit.split('/'); const step = stepText ? Number(stepText) : 1
    const [start, end = start] = range === '*' ? [fields[index]!.min, fields[index]!.max] : range!.split('-').map(Number)
    const candidates = index === 4 && values[index] === 0 ? [0, 7] : [values[index]!]
    return candidates.some((value) => value >= start! && value <= end! && (value - start!) % step === 0)
  })
  const dayOfMonthWildcard = parts[2] === '*'; const dayOfWeekWildcard = parts[4] === '*'
  const calendarMatches = dayOfMonthWildcard || dayOfWeekWildcard
    ? matches(parts[2]!, 2) && matches(parts[4]!, 4)
    : matches(parts[2]!, 2) || matches(parts[4]!, 4)
  return matches(parts[0]!, 0) && matches(parts[1]!, 1) && calendarMatches && matches(parts[3]!, 3)
}
export function validateBackupSchedule(value: Partial<BackupSchedule>): Omit<BackupSchedule, 'id'> {
  if (!value.connectionId?.trim() || !value.database?.trim() || !value.directory || !isAbsolute(value.directory) || value.directory.includes('\0')) throw new Error('Choose a connection, database and absolute backup folder.')
  if (!Number.isInteger(value.retention) || value.retention! < 1 || value.retention! > 1000) throw new Error('Retention must be between 1 and 1000 backups.')
  return { connectionId: value.connectionId.trim(), database: value.database.trim(), directory: value.directory, cron: validateCron(value.cron ?? ''), retention: value.retention!, enabled: value.enabled === true, lastRunMinute: value.lastRunMinute }
}
export class BackupScheduleStore {
  constructor(readonly filePath: string) {}
  async list(): Promise<BackupSchedule[]> { try { const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8')); if (!Array.isArray(value)) throw new Error('Backup schedules are invalid.'); return value.filter((item): item is BackupSchedule => Boolean(item && typeof item === 'object' && typeof (item as BackupSchedule).id === 'string' && typeof (item as BackupSchedule).connectionId === 'string' && typeof (item as BackupSchedule).database === 'string' && typeof (item as BackupSchedule).directory === 'string' && typeof (item as BackupSchedule).cron === 'string' && Number.isInteger((item as BackupSchedule).retention) && typeof (item as BackupSchedule).enabled === 'boolean')) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error } }
  async save(value: Partial<BackupSchedule>): Promise<BackupSchedule> { const data = validateBackupSchedule(value); const items = await this.list(); const current = value.id ? items.find((item) => item.id === value.id) : undefined; if (value.id && !current) throw new Error('Backup schedule not found.'); const saved: BackupSchedule = { ...data, id: current?.id ?? randomUUID() }; await this.write([...items.filter((item) => item.id !== saved.id), saved]); return saved }
  async delete(id: string): Promise<void> { const items = await this.list(); await this.write(items.filter((item) => item.id !== id)) }
  async update(item: BackupSchedule): Promise<void> { await this.write((await this.list()).map((current) => current.id === item.id ? item : current)) }
  private async write(items: BackupSchedule[]): Promise<void> { await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 }); const temp = `${this.filePath}.${randomUUID()}.tmp`; await writeFile(temp, `${JSON.stringify(items, null, 2)}\n`, { mode: 0o600 }); await rename(temp, this.filePath) }
}
export function scheduledBackupPath(directory: string, database: string, date: Date): string { const safe = database.replace(/[^A-Za-z0-9_.-]/g, '_'); return join(directory, `${safe}-${date.toISOString().replace(/[:.]/g, '-')}.sql`) }
