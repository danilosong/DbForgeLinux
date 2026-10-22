/* global process, console, setTimeout, clearTimeout, performance */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const executablePath = process.env.TUXSQL_ELECTRON_PATH
if (!executablePath?.startsWith('/')) throw new Error('Set TUXSQL_ELECTRON_PATH to the explicit packaged Linux executable path.')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-startup-trace-'))
const sqlPath = join(dataRoot, 'startup-probe.sql')
await writeFile(sqlPath, 'SELECT 1 AS startup_probe;\n', { mode: 0o600 })
const tracePath = join(dataRoot, 'config', 'tuxsql', 'startup-trace.jsonl')
const results = []

function parseTrace(contents) { return contents.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) }

async function launch(label) {
  const startedAt = performance.now()
  await rm(tracePath, { force: true })
  const app = spawn(executablePath, ['--disable-gpu', sqlPath], {
    stdio: 'ignore',
    env: {
      ...process.env,
      LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', LANGUAGE: 'en',
      XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'),
      TUXSQL_LINUX_BACKEND: 'x11', TUXSQL_STARTUP_TRACE: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  let trace = []
  let timeout
  try {
    const deadline = performance.now() + 90_000
    while (performance.now() < deadline) {
      try { trace = parseTrace(await readFile(tracePath, 'utf8')) } catch { /* the app has not created its private trace yet */ }
      const stages = new Set(trace.map((item) => item.stage))
      if (stages.has('renderer-editor-interactive') && stages.has('renderer-vault-status-loaded') && stages.has('updater-startup-check-start')) break
      if (app.exitCode !== null || app.signalCode !== null) throw new Error(`Packaged app exited early during ${label}: ${app.exitCode ?? app.signalCode}`)
      await new Promise((resolve) => { timeout = setTimeout(resolve, 100) })
    }
    if (!trace.some((item) => item.stage === 'renderer-editor-interactive')) throw new Error(`Timed out waiting for the SQL editor during ${label}: ${JSON.stringify(trace)}`)
    await new Promise((resolve) => { timeout = setTimeout(resolve, 250) })
  } finally {
    if (timeout) clearTimeout(timeout)
    if (app.exitCode === null && app.signalCode === null) {
      const exited = new Promise((resolve) => app.once('exit', resolve))
      app.kill('SIGTERM')
      let killTimer
      await Promise.race([exited, new Promise((resolve) => { killTimer = setTimeout(resolve, 10_000) })])
      if (app.exitCode === null && app.signalCode === null) { app.kill('SIGKILL'); await exited }
      if (killTimer) clearTimeout(killTimer)
    }
  }
  trace = parseTrace(await readFile(tracePath, 'utf8'))
  const editorReadyMs = trace.find((item) => item.stage === 'renderer-editor-interactive')?.elapsedMs
  const traceMode = (await stat(tracePath)).mode & 0o777
  const row = { run: label, splashEnabled: process.env.TUXSQL_NO_SPLASH !== '1', launchToEditorMs: editorReadyMs, traceMode: traceMode.toString(8).padStart(4, '0'), traceObservedForMs: Math.round(performance.now() - startedAt), marks: trace }
  results.push(row)
  console.log(JSON.stringify(row))
}

try {
  await launch('cold')
  await launch('warm')
  console.log(JSON.stringify({ summary: results.map(({ run, launchToEditorMs, traceObservedForMs, marks }) => ({ run, launchToEditorMs, traceObservedForMs, marks })) }, null, 2))
} finally { await rm(dataRoot, { recursive: true, force: true }) }
