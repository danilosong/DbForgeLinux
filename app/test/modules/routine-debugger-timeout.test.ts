import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleDebugSessionTimeout } from '../../src/modules/routine-debugger/sessionTimeout.js'

describe('routine debugger session timeout', () => {
  afterEach(() => vi.useRealTimers())

  it('fires at the configured limit and can be cleared when execution completes', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const clear = scheduleDebugSessionTimeout(45, onTimeout)
    vi.advanceTimersByTime(44_999)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTimeout).toHaveBeenCalledOnce()
    clear()

    const cancelled = vi.fn()
    scheduleDebugSessionTimeout(30, cancelled)()
    vi.advanceTimersByTime(30_000)
    expect(cancelled).not.toHaveBeenCalled()
  })

  it('rejects limits outside the settings range', () => {
    expect(() => scheduleDebugSessionTimeout(0, () => undefined)).toThrow('between 1 and 3600')
    expect(() => scheduleDebugSessionTimeout(3601, () => undefined)).toThrow('between 1 and 3600')
  })
})
