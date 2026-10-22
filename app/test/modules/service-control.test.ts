import { describe, expect, it, vi } from 'vitest'
import { createServiceController, parseMysqlServiceInventory } from '../../src/modules/service-control/index.js'
import { requiredActionConfirmation } from '../../src/shared/contracts/service-control.js'

describe('MySQL Service Control', () => {
  it('parses only MySQL/MariaDB units and their runtime state', () => {
    expect(parseMysqlServiceInventory(
      'mysql.service enabled enabled\nmariadb.service disabled disabled\nssh.service enabled enabled',
      'mysql.service loaded active running MySQL Server\nmariadb.service loaded inactive dead MariaDB Server'
    )).toEqual([
      { unit: 'mariadb.service', state: 'inactive', enabled: false, description: 'MariaDB Server' },
      { unit: 'mysql.service', state: 'active', enabled: true, description: 'MySQL Server' }
    ])
  })

  it('rejects invalid unit names before invoking systemctl', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }))
    const controller = createServiceController(run)
    await expect(controller.control('mysql.service; touch /tmp/pwned', 'start', 'START mysql.service; touch /tmp/pwned')).rejects.toThrow('serviceControl.error.unitInvalid')
    expect(run).not.toHaveBeenCalled()
  })

  it('sends privileged actions only to pkexec after exact typed confirmation', async () => {
    const calls: Array<[string, string[]]> = []
    const run = async (file: string, args: string[]) => { calls.push([file, args]); return { stdout: '', stderr: '' } }
    const controller = createServiceController(run)
    const phrase = requiredActionConfirmation('disable', 'mariadb.service')
    await expect(controller.control('mariadb.service', 'disable', 'disable mariadb.service')).rejects.toThrow('serviceControl.error.confirmationMismatch')
    await controller.control('mariadb.service', 'disable', phrase)
    expect(calls[0]).toEqual(['pkexec', ['systemctl', 'disable', 'mariadb.service']])
    expect(calls.some(([file, args]) => file === 'systemctl' && ['start', 'stop', 'restart', 'enable', 'disable'].includes(args[0] ?? ''))).toBe(false)
  })

  it('reads bounded recent logs and reports missing systemd clearly', async () => {
    const run = async (file: string) => {
      if (file === 'journalctl') return { stdout: 'recent event', stderr: '' }
      const error = Object.assign(new Error('Failed to connect to bus: Host is down'), { stderr: 'Failed to connect to bus: Host is down' })
      throw error
    }
    const controller = createServiceController(run)
    expect(await controller.logs('mysql.service')).toBe('recent event')
    expect(await controller.list().catch(error => error.message)).toBe('serviceControl.error.systemdInactive')
  })
})
