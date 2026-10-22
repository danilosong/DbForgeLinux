interface SplashProgressPayload { percent: number; label: string; version: string; kicker: string; visible: boolean; fadeOut: boolean }

const stage = document.getElementById('stage')!
const kicker = document.getElementById('brand-kicker')!
const percentage = document.getElementById('percentage')!
const progress = document.getElementById('progress')!
const fill = document.getElementById('progress-fill')!
const version = document.getElementById('version')!
const query = new URLSearchParams(window.location.search)
const previewMode = ['10', '60', '100'].includes(query.get('preview') ?? '')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let realFloor = 0
let visibleAt: number | undefined
let animationFrame = 0
let animationStartPercent = 0

function setProgress(value: number): void {
  const bounded = Math.max(Number(progress.getAttribute('aria-valuenow')) || 0, Math.min(100, Math.max(0, value)))
  percentage.textContent = `${Math.floor(bounded)}%`
  progress.setAttribute('aria-valuenow', String(Math.floor(bounded)))
  progress.setAttribute('aria-valuetext', `${stage.textContent}, ${Math.floor(bounded)}%`)
  document.documentElement.style.setProperty('--progress', `${bounded}%`)
}

function animateProgress(now: number): void {
  if (visibleAt === undefined || previewMode || reducedMotion) return
  const elapsed = Math.max(0, now - visibleAt)
  const t = Math.min(1, elapsed / 2450)
  const eased = 1 - (1 - t) ** 2.4
  const interpolated = animationStartPercent + (96 - animationStartPercent) * eased
  setProgress(Math.max(realFloor, interpolated))
  if (t < 1) animationFrame = requestAnimationFrame(animateProgress)
}

function applyProgress(payload: SplashProgressPayload): void {
  realFloor = Math.max(realFloor, Math.min(100, Math.max(0, payload.percent)))
  stage.textContent = payload.label
  kicker.textContent = payload.kicker
  version.textContent = payload.version
  if (payload.visible && visibleAt === undefined) {
    visibleAt = performance.now()
    animationStartPercent = realFloor
    animationFrame = requestAnimationFrame(animateProgress)
  }
  setProgress(realFloor)
  fill.setAttribute('aria-hidden', 'true')
  if (payload.fadeOut) {
    cancelAnimationFrame(animationFrame)
    document.documentElement.classList.add('fade-out')
  }
}

;(window as Window & { tuxsqlSplash: { onProgress(callback: (payload: SplashProgressPayload) => void): () => void } }).tuxsqlSplash.onProgress(applyProgress)
