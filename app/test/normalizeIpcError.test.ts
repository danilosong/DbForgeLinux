import { describe, expect, it } from 'vitest'
import { normalizeApiRejections, normalizeIpcError } from '../src/shared/normalizeIpcError.js'

describe('IPC error normalization', () => {
  it('strips Electron invoke prefix and optional Error marker while preserving useful MySQL error text', () => {
    const reason = new Error("Error invoking remote method 'db:test': Error: 1045: MySQL rejected credentials")
    Object.assign(reason, { code: 'ER_ACCESS_DENIED_ERROR' })
    const result = normalizeIpcError(reason)

    expect(result).toBeInstanceOf(Error)
    expect(result).toMatchObject({ message: '1045: MySQL rejected credentials', code: 'ER_ACCESS_DENIED_ERROR' })
  })

  it('strips the IPC prefix when Electron omits the Error marker and leaves ordinary errors unchanged', () => {
    expect(normalizeIpcError(new Error("Error invoking remote method 'object:apply': Could not apply DDL"))).toMatchObject({
      message: 'Could not apply DDL'
    })
    const ordinary = new Error('A local validation error')
    expect(normalizeIpcError(ordinary)).toBe(ordinary)
  })

  it('normalizes rejected API calls centrally without changing successful results', async () => {
    const api = normalizeApiRejections({
      fail: async () => { throw new Error("Error invoking remote method 'db:test': Error: 1045: rejected") },
      succeed: async () => 'ok'
    })

    await expect(api.fail()).rejects.toMatchObject({ message: '1045: rejected' })
    await expect(api.succeed()).resolves.toBe('ok')
  })
})
