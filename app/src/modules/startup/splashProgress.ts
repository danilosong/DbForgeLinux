export const splashPhases = [
  { id: 'starting', weight: 18, en: 'Starting TuxSQL' },
  { id: 'vault', weight: 12, en: 'Opening secure vault' },
  { id: 'settings', weight: 15, en: 'Loading settings' },
  { id: 'interface', weight: 20, en: 'Starting interface' },
  { id: 'editor', weight: 30, en: 'Loading editor' },
  { id: 'ready', weight: 5, en: 'Ready' }
] as const

export type SplashPhase = (typeof splashPhases)[number]['id']
export type SplashCompletionReason = 'ready' | 'timeout' | 'error' | 'skip'

export const splashTiming = {
  minimumVisibleMs: 3000,
  readyHoldMs: 300,
  fadeOutMs: 250,
  maximumVisibleMs: 8000
} as const

export interface SplashReadyPlan {
  completeAt: number
  fadeAt: number
  closeAt: number
  holdMs: number
  fadeOutMs: number
}

export class SplashTimingModel {
  private visibleAt: number | undefined

  startVisible(at: number): void {
    if (this.visibleAt === undefined) this.visibleAt = at
  }

  readyPlan(now: number): SplashReadyPlan {
    const visibleAt = this.visibleAt ?? now
    const hardDeadline = visibleAt + splashTiming.maximumVisibleMs
    const minimumCompleteAt = visibleAt + splashTiming.minimumVisibleMs - splashTiming.readyHoldMs - splashTiming.fadeOutMs
    const completeAt = Math.max(now, minimumCompleteAt)
    const normalCloseAt = completeAt + splashTiming.readyHoldMs + splashTiming.fadeOutMs
    if (normalCloseAt <= hardDeadline) {
      const fadeAt = completeAt + splashTiming.readyHoldMs
      return { completeAt, fadeAt, closeAt: normalCloseAt, holdMs: splashTiming.readyHoldMs, fadeOutMs: splashTiming.fadeOutMs }
    }

    const remainingMs = Math.max(0, hardDeadline - now)
    const holdMs = Math.min(splashTiming.readyHoldMs, remainingMs)
    const fadeOutMs = Math.min(splashTiming.fadeOutMs, remainingMs - holdMs)
    const fadeAt = now + holdMs
    return { completeAt: now, fadeAt, closeAt: fadeAt + fadeOutMs, holdMs, fadeOutMs }
  }

  hardDeadlineAt(): number {
    return (this.visibleAt ?? 0) + splashTiming.maximumVisibleMs
  }

  skipCloseAt(now: number): number {
    return now + splashTiming.fadeOutMs
  }

  visibleDuration(now: number): number {
    return this.visibleAt === undefined ? 0 : Math.max(0, now - this.visibleAt)
  }
}

export interface SplashProgressSnapshot {
  phase: SplashPhase
  percent: number
  completed?: SplashCompletionReason
}

export class SplashProgressModel {
  private phaseIndex = 0
  private percent = 0
  private completion: SplashCompletionReason | undefined

  advance(phase: SplashPhase): SplashProgressSnapshot {
    if (this.completion) return this.snapshot()
    const nextIndex = splashPhases.findIndex((item) => item.id === phase)
    if (nextIndex < this.phaseIndex) return this.snapshot()
    this.phaseIndex = nextIndex
    const completedWeight = splashPhases.slice(0, nextIndex).reduce((total, item) => total + item.weight, 0)
    this.percent = Math.max(this.percent, completedWeight)
    return this.snapshot()
  }

  complete(reason: SplashCompletionReason = 'ready'): SplashProgressSnapshot {
    this.completion = reason
    this.phaseIndex = splashPhases.length - 1
    this.percent = 100
    return this.snapshot()
  }

  snapshot(): SplashProgressSnapshot {
    return { phase: splashPhases[this.phaseIndex]!.id, percent: this.percent, ...(this.completion ? { completed: this.completion } : {}) }
  }
}
