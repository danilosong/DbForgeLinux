import { describe, expect, it } from 'vitest'
import { SplashProgressModel, SplashTimingModel, splashPhases, splashTiming } from '../../src/modules/startup/splashProgress.js'

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

  it('holds a ready splash for three seconds from its first visible paint, including the 100% hold and fade', () => {
    const timing = new SplashTimingModel()
    timing.startVisible(100)
    const plan = timing.readyPlan(900)
    expect(plan).toEqual({ completeAt: 2550, fadeAt: 2850, closeAt: 3100 })
    expect(plan.closeAt - 100).toBe(splashTiming.minimumVisibleMs)
    expect(plan.fadeAt - plan.completeAt).toBe(splashTiming.readyHoldMs)
    expect(plan.closeAt - plan.fadeAt).toBe(splashTiming.fadeOutMs)
  })

  it('does not add a three-second minimum when the user skips the splash', () => {
    const timing = new SplashTimingModel()
    timing.startVisible(100)
    expect(timing.skipCloseAt(900)).toBe(900 + splashTiming.fadeOutMs)
    expect(timing.visibleDuration(900)).toBe(800)
  })

  it('starts the completion hold immediately if startup becomes ready after the minimum window', () => {
    const timing = new SplashTimingModel()
    timing.startVisible(100)
    expect(timing.readyPlan(3200)).toEqual({ completeAt: 3200, fadeAt: 3500, closeAt: 3750 })
  })
})
