import { describe, expect, it } from 'vitest'
import { enMessages, ptBrCatalog } from '../../src/renderer/src/i18n/specMessages.js'

describe('routine debugger labels', () => {
  it('keeps each debugger action label separate from its shortcut', () => {
    expect(enMessages['debug.start']).toBe('Start Debugging')
    expect(enMessages['debug.continue']).toBe('Continue')
    expect(enMessages['debug.stepInto']).toBe('Step Into')
    expect(enMessages['debug.stepOver']).toBe('Step Over')
    expect(enMessages['debug.stepOut']).toBe('Step Out')
    expect(enMessages['debug.runToCursor']).toBe('Run To Cursor')
    expect(enMessages['debug.stop']).toBe('Stop')
    expect(enMessages['debug.restart']).toBe('Restart')
    expect(enMessages['panel.routine.debugger.m05e69aef47']).toBe('Alt+F9')
    expect(enMessages['panel.routine.debugger.mf6fdabfc77']).toBe('F11')
    expect(enMessages['panel.routine.debugger.m2d2c66604f']).toBe('F10')
    expect(enMessages['panel.routine.debugger.mae1126029d']).toBe('Shift+F11')
  })

  it('provides separate Portuguese debugger action labels', () => {
    expect(ptBrCatalog['debug.start']).toBe('Iniciar depuração')
    expect(ptBrCatalog['debug.continue']).toBe('Continuar')
    expect(ptBrCatalog['debug.stop']).toBe('Parar')
    expect(ptBrCatalog['debug.stepInto']).toBe('Entrar')
    expect(ptBrCatalog['debug.stepOver']).toBe('Avançar')
    expect(ptBrCatalog['debug.stepOut']).toBe('Sair')
    expect(ptBrCatalog['debug.restart']).toBe('Reiniciar')
  })
})
