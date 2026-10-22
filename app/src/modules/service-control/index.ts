import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { requiredActionConfirmation, type MysqlService, type MysqlServiceAction, type ServiceActionResult, type ServiceState } from '../../shared/contracts/service-control.js'

const execFile = promisify(execFileCallback)
const MYSQL_UNIT = /^(?:mysql|mysqld|mariadb)\.service$/
export type CommandResult = { stdout: string; stderr: string }
export type CommandRunner = (file: string, args: string[], options?: { timeout?: number; maxBuffer?: number }) => Promise<CommandResult>

const nativeRunner: CommandRunner = async (file, args, options = {}) => execFile(file, args, { encoding: 'utf8', timeout: options.timeout ?? 10_000, maxBuffer: options.maxBuffer ?? 1024 * 1024 })

export function createServiceController(run: CommandRunner = nativeRunner, platform = process.platform) {
  function requireLinux(): void { if (platform !== 'linux') throw new Error('serviceControl.error.platformUnavailable') }
  async function systemctl(args: string[]): Promise<CommandResult> {
    try { return await run('systemctl', args) }
    catch (error) {
      const message = errorText(error)
      if (/ENOENT|not found/i.test(message)) throw new Error('serviceControl.error.systemctlUnavailable', { cause: error })
      if (/not been booted with systemd|failed to connect to bus|no such file or directory.*system bus/i.test(message)) throw new Error('serviceControl.error.systemdInactive', { cause: error })
      throw new Error('serviceControl.error.systemCommandFailed', { cause: error })
    }
  }
  async function list(): Promise<MysqlService[]> {
    requireLinux()
    const [unitFiles, running] = await Promise.all([
      systemctl(['list-unit-files', '--type=service', '--no-legend', '--no-pager']),
      systemctl(['list-units', '--type=service', '--all', '--no-legend', '--no-pager'])
    ])
    return parseMysqlServiceInventory(unitFiles.stdout, running.stdout)
  }
  async function control(unit: string, action: MysqlServiceAction, confirmation: string): Promise<ServiceActionResult> {
    requireLinux()
    if (!MYSQL_UNIT.test(unit)) throw new Error('serviceControl.error.unitInvalid')
    if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) throw new Error('serviceControl.error.actionInvalid')
    if (confirmation !== requiredActionConfirmation(action, unit)) throw new Error('serviceControl.error.confirmationMismatch')
    const args = ['systemctl', action, unit]
    try {
      await run('pkexec', args, { timeout: 120_000 })
      const service = (await list()).find((item) => item.unit === unit) ?? { unit, state: 'unknown', enabled: null, description: unit }
      return { service, command: `pkexec ${args.join(' ')}`, authorizationRequired: false }
    } catch (error) {
      const message = errorText(error)
      if (/authentication is required|interactive authentication required|not authorized|authorization failed/i.test(message)) return { service: { unit, state: 'unknown', enabled: null, description: unit }, command: `pkexec ${args.join(' ')}`, authorizationRequired: true }
      if (/ENOENT|not found/i.test(message)) throw new Error('serviceControl.error.pkexecUnavailable', { cause: error })
      throw new Error('serviceControl.error.serviceActionFailed', { cause: error })
    }
  }
  async function logs(unit: string): Promise<string> {
    requireLinux()
    if (!MYSQL_UNIT.test(unit)) throw new Error('serviceControl.error.unitInvalid')
      const result = await run('journalctl', ['--unit', unit, '--lines', '100', '--no-pager', '--output', 'short-iso'], { timeout: 10_000, maxBuffer: 1024 * 1024 })
    return result.stdout
  }
  return { list, control, logs }
}

export const { list: listMysqlServices, control: controlMysqlService, logs: readMysqlServiceLogs } = createServiceController()

export function parseMysqlServiceInventory(unitFilesText: string, runningText: string): MysqlService[] {
  const units = new Map<string, MysqlService>()
  for (const line of unitFilesText.split(/\r?\n/)) {
    const match = /^([^\s]+\.service)\s+([^\s]+)/.exec(line.trim())
    if (!match || !MYSQL_UNIT.test(match[1]!)) continue
    units.set(match[1]!, { unit: match[1]!, state: 'unknown', enabled: match[2] === 'enabled' ? true : match[2] === 'disabled' ? false : null, description: match[1]! })
  }
  for (const line of runningText.split(/\r?\n/)) {
    const match = /^([^\s]+\.service)\s+\S+\s+(active|inactive|failed|activating|deactivating)\s+\S+\s*(.*)$/.exec(line.trim())
    if (!match || !MYSQL_UNIT.test(match[1]!)) continue
    const current = units.get(match[1]!) ?? { unit: match[1]!, state: 'unknown' as ServiceState, enabled: null, description: match[1]! }
    current.state = normalizeState(match[2]!)
    current.description = match[3] || current.description
    units.set(match[1]!, current)
  }
  return [...units.values()].sort((left, right) => left.unit.localeCompare(right.unit))
}
function normalizeState(value: string): ServiceState { return value === 'active' ? 'active' : value === 'failed' ? 'failed' : value === 'inactive' ? 'inactive' : 'unknown' }
function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()) return error.stderr.trim()
  return error instanceof Error ? error.message : 'Falha ao consultar serviços do sistema.'
}
