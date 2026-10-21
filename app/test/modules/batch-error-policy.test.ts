import { describe, expect, it } from 'vitest'
import { decideBatchError } from '../../src/modules/editor/batchErrorPolicy.js'

describe('SQL batch error decisions', () => {
  it('stops, continues once, or suppresses later dialogs according to the selected action', () => {
    expect(decideBatchError('stop')).toEqual({ continueBatch: false, ignoreFutureErrors: false })
    expect(decideBatchError('continue')).toEqual({ continueBatch: true, ignoreFutureErrors: false })
    expect(decideBatchError('ignore-all')).toEqual({ continueBatch: true, ignoreFutureErrors: true })
  })
})
