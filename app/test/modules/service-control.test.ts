import { describe, expect, it } from 'vitest'
import { controlMysqlService, parseMysqlServiceInventory } from '../../src/modules/service-control/index.js'

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
    await expect(controlMysqlService('mysql.service; touch /tmp/pwned', 'start')).rejects.toThrow('Unidade systemd MySQL inválida')
  })
})
