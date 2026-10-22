import { describe, expect, it } from 'vitest'
import { enMessages, ptBrCatalog } from '../../src/renderer/src/i18n/specMessages.js'

const keys = [
  'serviceControl.summary',
  'serviceControl.empty',
  'serviceControl.confirmCanceled',
  'serviceControl.error.systemctlUnavailable',
  'serviceControl.error.systemdInactive',
  'localServer.engineAvailable',
  'localServer.engineUnavailable',
  'localServer.error.engineUnavailable',
  'localServer.error.passwordExpired'
]

describe('Service Control and local server translations', () => {
  it('provides English strings for system and engine status messages', () => {
    for (const key of keys) expect(enMessages[key], key).toBeTruthy()
    expect(enMessages['serviceControl.summary']).toContain('systemd')
    expect(enMessages['serviceControl.empty']).toBe('No MySQL or MariaDB services were detected.')
    expect(enMessages['localServer.engineAvailable']).toContain('{0}')
  })

  it('provides distinct Brazilian Portuguese translations for the same messages', () => {
    for (const key of keys) expect(ptBrCatalog[key], key).toBeTruthy()
    expect(ptBrCatalog['serviceControl.summary']).toContain('Gerencie')
    expect(ptBrCatalog['serviceControl.empty']).toContain('Nenhum serviço')
    expect(ptBrCatalog['localServer.engineAvailable']).toContain('{0}')
  })
})
