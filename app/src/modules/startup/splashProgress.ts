export const splashPhases = [
  { id: 'starting', weight: 18, en: 'Starting TuxSQL' },
  { id: 'vault', weight: 12, en: 'Opening secure vault' },
  { id: 'settings', weight: 15, en: 'Loading settings' },
  { id: 'interface', weight: 20, en: 'Starting interface' },
  { id: 'editor', weight: 30, en: 'Loading editor' },
  { id: 'ready', weight: 5, en: 'Ready' }
] as const

export type SplashPhase = (typeof splashPhases)[number]['id']
export type SplashCompletionReason = 'ready' | 'timeout' | 'error'

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
