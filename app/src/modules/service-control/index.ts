import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import type { MysqlService, MysqlServiceAction, ServiceActionResult, ServiceState } from '../../shared/contracts/service-control.js'

const execFile = promisify(execFileCallback)
const MYSQL_UNIT = /^(?:mysql|mysqld|mariadb)(?:@[^\s]+)?\.service$/

export async function listMysqlServices(): Promise<MysqlService[]> {
  requireLinux()
  const [unitFiles, running] = await Promise.all([
    runSystemctl(['list-unit-files', '--type=service', '--no-legend', '--no-pager']),
    runSystemctl(['list-units', '--type=service', '--all', '--no-legend', '--no-pager'])
  ])
  return parseMysqlServiceInventory(unitFiles.stdout, running.stdout)
}

export function parseMysqlServiceInventory(unitFilesText: string, runningText: string): MysqlService[] {
  const units = new Map<string, MysqlService>()
  for (const line of unitFilesText.split(/\r?\n/)) {
    const match = /^([^\s]+\.service)\s+([^\s]+)/.exec(line.trim())
    if (!match || !MYSQL_UNIT.test(match[1])) continue
    units.set(match[1], { unit: match[1], state: 'unknown', enabled: match[2] === 'enabled' ? true : match[2] === 'disabled' ? false : null, description: match[1] })
  }
  for (const line of runningText.split(/\r?\n/)) {
    const match = /^([^\s]+\.service)\s+\S+\s+(active|inactive|failed|activating|deactivating)\s+\S+\s*(.*)$/.exec(line.trim())
    if (!match || !MYSQL_UNIT.test(match[1])) continue
    const current = units.get(match[1]) ?? { unit: match[1], state: 'unknown' as ServiceState, enabled: null, description: match[1] }
    current.state = normalizeState(match[2])
    current.description = match[3] || current.description
    units.set(match[1], current)
  }
  return [...units.values()].sort((left, right) => left.unit.localeCompare(right.unit))
}

export async function controlMysqlService(unit: string, action: MysqlServiceAction): Promise<ServiceActionResult> {
  requireLinux()
  if (!MYSQL_UNIT.test(unit)) throw new Error('Unidade systemd MySQL inválida.')
  if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) throw new Error('Ação de serviço inválida.')
  const command = `systemctl ${action} ${unit}`
  try {
    await runSystemctl([action, unit])
    const service = (await listMysqlServices()).find((item) => item.unit === unit) ?? { unit, state: 'unknown', enabled: null, description: unit }
    return { service, command, authorizationRequired: false }
  } catch (error) {
    const message = errorText(error)
    if (/authentication is required|interactive authentication required|permission denied|not authorized|access denied/i.test(message)) {
      return { service: { unit, state: 'unknown', enabled: null, description: unit }, command, authorizationRequired: true }
    }
    throw new Error(message || `systemctl ${action} ${unit} falhou.`, { cause: error })
  }
}

function normalizeState(value: string): ServiceState {
  if (value === 'active') return 'active'
  if (value === 'failed') return 'failed'
  if (value === 'inactive') return 'inactive'
  return 'unknown'
}

function requireLinux(): void {
  if (process.platform !== 'linux') throw new Error('Service Control está disponível somente em Linux com systemd.')
}

async function runSystemctl(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try { return await execFile('systemctl', args, { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 }) }
  catch (error) {
    const message = errorText(error)
    if (/ENOENT/.test(message)) throw new Error('systemctl não está instalado ou este Linux não usa systemd.', { cause: error })
    throw new Error(message, { cause: error })
  }
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()) return error.stderr.trim()
  return error instanceof Error ? error.message : 'Falha ao consultar systemd.'
}
