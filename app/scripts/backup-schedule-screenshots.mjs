/* global process, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-backup-schedule-ui-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', '19-utilities-backup')
let app
try {
  await mkdir(evidence, { recursive: true })
  const profile = join(dataRoot, 'config', 'tuxsql')
  const scheduleId = '01234567-89ab-4cde-8fab-0123456789ab'
  await mkdir(profile, { recursive: true, mode: 0o700 })
  await writeFile(join(profile, 'backup-schedules.json'), `${JSON.stringify([{ id: scheduleId, connectionId: 'fedcba98-7654-4321-8abc-fedcba987654', database: 'sample_backup', directory: dataRoot, cron: '0 2 * * *', retention: 7, enabled: true, backend: 'systemd' }])}\n`, { mode: 0o600 })
  await writeFile(join(profile, 'backup-schedule-runs.json'), `${JSON.stringify([{ scheduleId, status: 'failure', lastRunAt: new Date().toISOString() }])}\n`, { mode: 0o600 })
  app = await electron.launch({ executablePath: appPath, args: ['--no-sandbox'], env: { ...process.env, HOME: dataRoot, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), TUXSQL_NO_DEV_LINK: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await page.locator('summary').filter({ hasText: 'Database' }).click()
  await page.locator('.menu-popup .menu-action').filter({ hasText: /Find Object/i }).last().click()
  await page.locator('.database-tools-panel').waitFor()
  await page.locator('.database-tools-tabs button').filter({ hasText: 'Backup/Restore' }).click()
  await page.locator('.backup-wizard-steps').getByRole('button', { name: 'Scheduled backups' }).click()
  await page.locator('.backup-schedule-page').waitFor()
  await page.setViewportSize({ width: 1440, height: 1200 })
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      await page.locator('summary').filter({ hasText: 'View' }).click()
      await page.getByRole('button', { name: theme === 'light' ? /Theme: Light|Tema: Claro/ : /Theme: Dark|Tema: Escuro/ }).click()
    }
    await page.screenshot({ path: join(evidence, `backup-schedule-${theme}.png`), fullPage: true })
  }
  console.log(`Backup schedule screenshots saved in ${evidence}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
