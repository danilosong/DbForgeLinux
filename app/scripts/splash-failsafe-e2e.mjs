/* global process, console, document, localStorage, setTimeout */
import { copyFile, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { _electron as electron } from 'playwright'

const executablePath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
const root = await mkdtemp(join(tmpdir(), 'tuxsql-splash-failsafe-'))
const configHome = join(root, 'config')
const appData = join(configHome, 'tuxsql')
const tracePath = join(appData, 'startup-trace.jsonl')
const evidenceDir = resolve(process.cwd(), '..', 'document', 'evidence', 'ui', '00-splash')
const baseEnv = {
  ...process.env,
  HOME: root,
  XDG_CONFIG_HOME: configHome,
  XDG_CACHE_HOME: join(root, 'cache'),
  XDG_DATA_HOME: join(root, 'data'),
  XDG_STATE_HOME: join(root, 'state'),
  TUXSQL_NO_DEV_LINK: '1',
  TUXSQL_LINUX_BACKEND: 'x11'
}
delete baseEnv.WAYLAND_DISPLAY
delete baseEnv.XDG_SESSION_TYPE

const connection = {
  id: 'saved-dev-mysql', name: 'Local Development MySQL', type: 'mysql', host: '127.0.0.1', port: 3306,
  user: 'tuxsql_dev', database: 'app_db', environment: 'dev', color: '#2e7d32',
  ssl: { mode: 'preferred', minVersion: 'auto' },
  ssh: { enabled: false, host: '', port: 22, user: '', authMethod: 'password', keyboardInteractive: false, remoteHost: '127.0.0.1', remotePort: 3306, keepAliveSeconds: 30 },
  http: { enabled: false, url: '', timeoutSeconds: 30, rejectUnauthorized: true, keepAlive: false, useBase64: false, useCredentials: false, useProxy: false },
  advanced: { connectionTimeoutSeconds: 15, commandTimeoutSeconds: 0, charset: 'utf8mb4', timeZone: 'SERVER', initCommands: '', keepAliveSeconds: 0, keepAliveEnabled: false, pingTimeoutSeconds: 240, detectCharacterSet: false, compression: false, multipleStatements: true, tinyInt1isBit: true, readOnly: false, autoReconnect: true, customParameters: [] }
}

async function seedProfile() {
  await mkdir(appData, { recursive: true })
  await writeFile(join(appData, 'settings.json'), JSON.stringify({
    schemaVersion: 2,
    environment: { restoreSession: true, showSplash: true, startup: 'last-workspace', showStartPage: false },
    appearance: { theme: 'dark' },
    language: { locale: 'pt-BR' },
    documents: { restoreSqlDocuments: true, restoreOtherDocuments: true }
  }))
  await writeFile(join(appData, 'connections.json'), JSON.stringify([connection]))

  // Seed persisted renderer storage through a normal packaged launch with splash explicitly skipped.
  const seedApp = await electron.launch({ executablePath, args: ['--no-splash'], env: baseEnv, timeout: 30_000 })
  try {
    const page = await seedApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      localStorage.setItem('tuxsql.documents', JSON.stringify([
        { id: 'start', label: 'Start Page', modified: false },
        { id: 'restored-sql-1', label: 'Daily report.sql', modified: true },
        { id: 'restored-sql-2', label: 'Migration check.sql', modified: false }
      ]))
      localStorage.setItem('tuxsql.selectedDocument', 'restored-sql-1')
      localStorage.setItem('tuxsql.sqlDrafts', JSON.stringify({ 'restored-sql-1': 'SELECT CURRENT_DATE;\n-- unsaved draft', 'restored-sql-2': 'SELECT 2;' }))
      localStorage.setItem('tuxsql.theme', 'dark')
    })
    await page.reload()
    await page.waitForFunction(() => document.documentElement.lang === 'pt-BR'
      && document.documentElement.dataset.theme === 'dark'
      && Array.from(document.querySelectorAll('[role="tab"]')).some((tab) => tab.getAttribute('aria-label')?.startsWith('Daily report.sql')))
  } finally {
    await seedApp.close()
  }
}

async function runCase(name, flags, maximumDurationMs, requiredStages = [], minimumDurationMs = 0) {
  try { await unlink(tracePath) } catch { /* a first run has no trace file */ }
  const env = { ...baseEnv, TUXSQL_STARTUP_TRACE: '1', ...flags }
  const child = spawn(executablePath, [], { env, detached: true, stdio: 'ignore' })
  const startedAt = Date.now()
  let rows = []
  try {
    while (Date.now() - startedAt < 12_000) {
      try { rows = (await readFile(tracePath, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) } catch { /* tracing starts after the app data path is prepared */ }
      if (rows.some((row) => row.stage === 'splash-closed')) break
      if (child.exitCode !== null) throw new Error(`${name}: packaged app exited with ${child.exitCode} before the splash closed`)
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 75))
    }
    const stage = (key) => rows.find((row) => row.stage === key)?.elapsedMs
    const shownAt = stage('splash-window-shown')
    const closedAt = stage('splash-closed')
    if (shownAt === undefined || closedAt === undefined) throw new Error(`${name}: missing splash shown/closed trace marks`)
    const visibleMs = closedAt - shownAt
    if (visibleMs < minimumDurationMs) throw new Error(`${name}: splash visible for ${visibleMs} ms, minimum is ${minimumDurationMs} ms`)
    if (visibleMs > maximumDurationMs) throw new Error(`${name}: splash visible for ${visibleMs} ms, ceiling is ${maximumDurationMs} ms`)
    for (const requiredStage of requiredStages) if (stage(requiredStage) === undefined) throw new Error(`${name}: missing expected trace stage ${requiredStage}`)
    const mainShownAt = stage('main-window-shown') ?? stage('main-window-failsafe-shown')
    if (mainShownAt === undefined) throw new Error(`${name}: main window did not become visible after the splash closed`)
    if (mainShownAt < closedAt) throw new Error(`${name}: main window became visible before splash closure`)
    if (stage('main-window-ready-to-show') === undefined) throw new Error(`${name}: main window never reached ready-to-show`)
    if (stage('test-suppressed-renderer-ready-milestone') === undefined) throw new Error(`${name}: test did not suppress the renderer ready milestone`)
    await mkdir(evidenceDir, { recursive: true })
    await copyFile(tracePath, join(evidenceDir, `${name}.jsonl`))
    console.log(`${name}: splash visible ${visibleMs.toFixed(1)} ms; main shown at ${mainShownAt.toFixed(1)} ms; stages=${rows.map((row) => row.stage).join(', ')}`)
  } finally {
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* process may have exited */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200))
  }
}

try {
  await seedProfile()
  await runCase('failsafe-ready-to-show-no-renderer-mark', { TUXSQL_TEST_MISSING_STARTUP_MILESTONE: '1' }, 3500, ['splash-main-window-ready-fallback'], 2900)
  await runCase('failsafe-absolute-deadline-no-ready-mark', { TUXSQL_TEST_MISSING_STARTUP_MILESTONE: '1', TUXSQL_TEST_DISABLE_MAIN_READY_SPLASH_FALLBACK: '1' }, 8000, ['splash-absolute-deadline', 'main-window-failsafe-shown'])
} finally {
  await rm(root, { recursive: true, force: true })
}
