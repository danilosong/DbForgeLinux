import { chmodSync, openSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { StartupRendererMilestone } from '../shared/contracts/api.js'

const enabled = process.env.TUXSQL_STARTUP_TRACE === '1'
const processStarted = performance.now()
let traceFile: number | undefined
const pending: Array<{ stage: string; elapsedMs: number }> = []

function writeRecord(record: { stage: string; elapsedMs: number }): void {
  if (traceFile === undefined) { pending.push(record); return }
  try { writeSync(traceFile, `${JSON.stringify(record)}\n`) } catch { /* tracing must not affect app startup */ }
}

export function markStartup(stage: string): void {
  if (!enabled) return
  writeRecord({ stage, elapsedMs: Math.round((performance.now() - processStarted) * 10) / 10 })
}

export function initializeStartupTrace(userDataDir: string): void {
  if (!enabled || traceFile !== undefined) return
  try {
    traceFile = openSync(join(userDataDir, 'startup-trace.jsonl'), 'a', 0o600)
    chmodSync(join(userDataDir, 'startup-trace.jsonl'), 0o600)
    for (const record of pending.splice(0)) writeRecord(record)
  } catch { traceFile = undefined }
}

export function isStartupTraceEnabled(): boolean { return enabled }

export function isStartupRendererMilestone(value: unknown): value is StartupRendererMilestone {
  return value === 'renderer-bundle-loaded' || value === 'renderer-i18n-initialized' || value === 'renderer-i18n-settings-loaded' || value === 'renderer-settings-loaded'
    || value === 'renderer-vault-status-start' || value === 'renderer-vault-status-loaded' || value === 'renderer-updater-status-loaded'
    || value === 'renderer-first-paint' || value === 'renderer-app-interactive' || value === 'renderer-editor-interactive'
}

markStartup('main-process-entry')
