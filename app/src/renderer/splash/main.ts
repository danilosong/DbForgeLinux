interface SplashProgressPayload { percent: number; label: string; version: string; kicker: string }

const stage = document.getElementById('stage')!
const kicker = document.getElementById('brand-kicker')!
const percentage = document.getElementById('percentage')!
const progress = document.getElementById('progress')!
const fill = document.getElementById('progress-fill')!
const version = document.getElementById('version')!
function applyProgress(payload: SplashProgressPayload): void {
  const value = Math.max(Number(progress.getAttribute('aria-valuenow')) || 0, Math.min(100, Math.max(0, payload.percent)))
  stage.textContent = payload.label
  kicker.textContent = payload.kicker
  percentage.textContent = `${value}%`
  version.textContent = payload.version
  progress.setAttribute('aria-valuenow', String(value))
  progress.setAttribute('aria-valuetext', `${payload.label}, ${value}%`)
  document.documentElement.style.setProperty('--progress', `${value}%`)
  fill.setAttribute('aria-hidden', 'true')
}

;(window as Window & { tuxsqlSplash: { onProgress(callback: (payload: SplashProgressPayload) => void): () => void } }).tuxsqlSplash.onProgress(applyProgress)
