import { describe, expect, it } from 'vitest'
import { SplashProgressModel, splashPhases } from '../../src/modules/startup/splashProgress.js'

describe('startup splash progress', () => {
  it('uses measured phase weights that add up to one hundred', () => {
    expect(splashPhases.reduce((total, phase) => total + phase.weight, 0)).toBe(100)
  })

  it('is monotone when phases arrive out of order or repeat', () => {
    const progress = new SplashProgressModel()
    const values = [progress.advance('starting').percent, progress.advance('interface').percent, progress.advance('vault').percent, progress.advance('editor').percent, progress.advance('editor').percent]
    expect(values).toEqual([0, 45, 45, 65, 65])
    expect(values).toEqual([...values].sort((left, right) => left - right))
  })

  it('closes at one hundred percent when the safety timeout expires', () => {
    const progress = new SplashProgressModel()
    progress.advance('interface')
    expect(progress.complete('timeout')).toEqual({ phase: 'ready', percent: 100, completed: 'timeout' })
    expect(progress.advance('starting')).toEqual({ phase: 'ready', percent: 100, completed: 'timeout' })
  })
})
