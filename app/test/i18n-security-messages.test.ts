import { describe, expect, it } from 'vitest'
import { enMessages, ptBrCatalog } from '../src/renderer/src/i18n/specMessages.js'
import { enSecurityMessages, ptBrModulesSecurity } from '../src/renderer/src/i18n/ptBrModulesSecurity.js'
import { translateMessage } from '../src/renderer/src/i18n/translateMessage.js'

describe('security review messages', () => {
  it('translates main-process errors with their variable parts', () => {
    expect(translateMessage('Type the database name shop to generate data on a Production connection.', ptBrCatalog)).toBe('Digite o nome do banco de dados shop para gerar dados em uma conexão de Produção.')
    expect(translateMessage('Type the variable name max_connections to confirm this server-wide change.', ptBrCatalog)).toBe('Digite o nome da variável max_connections para confirmar esta alteração em todo o servidor.')
  })

  it('registers every key in both catalogs, with real text', () => {
    for (const key of Object.keys(ptBrModulesSecurity)) expect(ptBrCatalog[key], key).toBe(ptBrModulesSecurity[key])
    for (const [key, text] of Object.entries(enSecurityMessages)) {
      expect(enMessages[key]).toBe(text)
      expect(text).not.toBe(key)
      expect(ptBrModulesSecurity[key], key).toBeTruthy()
    }
  })
})
