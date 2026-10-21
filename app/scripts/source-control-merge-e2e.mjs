/* global process, window, document, console */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const executablePath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
const temporary = await mkdtemp(join(tmpdir(), 'tuxsql-source-control-e2e-'))
const repository = join(temporary, 'repo')
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
await mkdir(join(repository, '.git'), { recursive: true })
await mkdir(evidence, { recursive: true })
let app
try {
  app = await electron.launch({
    executablePath,
    args: ['--disable-gpu'],
    cwd: process.cwd(),
    timeout: 60_000,
    env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(temporary, 'config'), XDG_CACHE_HOME: join(temporary, 'cache'), XDG_DATA_HOME: join(temporary, 'data'), XDG_STATE_HOME: join(temporary, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  const page = await app.firstWindow()
  await page.waitForFunction(() => window.performance.getEntriesByName('tuxsql:first-paint-settled', 'mark').length > 0, null, { timeout: 20_000 })
  const update = page.locator('.panel-dialog-backdrop:has(.update-dialog)')
  if (await update.count()) await update.getByRole('button', { name: /Later|Depois/ }).click().catch(() => update.locator('.panel-dialog-close').click())
  await app.evaluate(({ ipcMain }, root) => {
    ipcMain.__sourceControlRepo = root
    ipcMain.__conflictResolved = false
    ipcMain.__savedConflictResult = ''
    ipcMain.removeHandler('source-control:choose-repository')
    ipcMain.handle('source-control:choose-repository', () => root)
    ipcMain.removeHandler('source-control:has-remote'); ipcMain.handle('source-control:has-remote', () => false)
    ipcMain.removeHandler('source-control:branches'); ipcMain.handle('source-control:branches', () => [{ name: 'main', current: true, remote: false }, { name: 'feature', current: false, remote: false }])
    ipcMain.removeHandler('source-control:log'); ipcMain.handle('source-control:log', () => [])
    ipcMain.removeHandler('source-control:commit-diff'); ipcMain.handle('source-control:commit-diff', (_event, _repo, hash) => `commit ${hash.slice(0, 8)} diff`)
    ipcMain.removeHandler('source-control:status'); ipcMain.handle('source-control:status', () => ({ root, branch: 'main', ahead: 0, behind: 0, conflicted: !ipcMain.__conflictResolved, changes: ipcMain.__conflictResolved ? [] : [{ path: 'tables/orders.sql', state: 'conflicted', staged: false }] }))
    ipcMain.removeHandler('source-control:graph'); ipcMain.handle('source-control:graph', () => [
      { hash: 'c3'.repeat(20), parents: ['b2'.repeat(20), 'b1'.repeat(20)], author: 'Smoke User', email: 'smoke@example.test', date: '2026-10-21T10:03:00Z', message: 'Merge feature branch', refs: ['HEAD -> main'] },
      { hash: 'b2'.repeat(20), parents: ['a0'.repeat(20)], author: 'Smoke User', email: 'smoke@example.test', date: '2026-10-21T10:02:00Z', message: 'Feature change', refs: ['feature'] },
      { hash: 'b1'.repeat(20), parents: ['a0'.repeat(20)], author: 'Smoke User', email: 'smoke@example.test', date: '2026-10-21T10:01:00Z', message: 'Main change', refs: [] },
      { hash: 'a0'.repeat(20), parents: [], author: 'Smoke User', email: 'smoke@example.test', date: '2026-10-21T10:00:00Z', message: 'Base schema', refs: [] }
    ])
    ipcMain.removeHandler('source-control:conflict-read'); ipcMain.handle('source-control:conflict-read', (_event, _repo, file) => ({ path: file, base: 'value=base\n', ours: 'value=ours\n', theirs: 'value=theirs\n', result: 'before\n<<<<<<< HEAD\nvalue=ours\n=======\nvalue=theirs\n>>>>>>> feature\nafter\n' }))
    ipcMain.removeHandler('source-control:conflict-save'); ipcMain.handle('source-control:conflict-save', (_event, _repo, _file, contents) => { ipcMain.__savedConflictResult = contents })
    ipcMain.removeHandler('source-control:conflict-resolve'); ipcMain.handle('source-control:conflict-resolve', () => { ipcMain.__conflictResolved = true })
  }, repository)

  await page.locator('.menu-row summary').filter({ hasText: /^View$/ }).click()
  await page.getByRole('button', { name: 'Source Control Manager', exact: true }).click()
  const panel = page.locator('.source-control-panel').filter({ has: page.locator('.sc-tabs') })
  await panel.waitFor()
  await panel.locator('.sc-heading button').last().click()
  await panel.getByRole('button', { name: /Conflicts \(1\)/ }).waitFor()
  await panel.getByRole('button', { name: /Conflicts \(1\)/ }).click()
  await panel.locator('.sc-conflict-block').waitFor()
  await panel.locator('.sc-conflict-block').getByRole('button', { name: 'Use Theirs' }).click()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await panel.screenshot({ path: join(evidence, `source-control-conflict-${theme}.png`) })
  }
  await panel.getByRole('button', { name: 'Save resolution' }).click()
  try { await panel.locator('.sc-conflict-editor>header').getByText('Saved', { exact: true }).waitFor({ timeout: 5_000 }) }
  catch { const state = await app.evaluate(({ ipcMain }) => ipcMain.__savedConflictResult); throw new Error(`Conflict save did not complete. Handler result: ${state}; UI: ${await panel.innerText()}`) }
  await panel.getByRole('button', { name: 'Mark resolved' }).click()
  const resolution = await app.evaluate(({ ipcMain }) => ({ contents: ipcMain.__savedConflictResult, resolved: ipcMain.__conflictResolved }))
  if (!resolution.contents.includes('value=theirs') || !resolution.resolved) throw new Error('Conflict block was not saved and marked resolved.')
  await panel.getByRole('button', { name: 'History', exact: true }).click()
  await panel.locator('.sc-commit-dag').waitFor()
  if (await panel.locator('.sc-graph-commit').count() !== 4) throw new Error('Commit DAG did not render its merge and branch commits.')
  await panel.locator('.sc-graph-commit').first().click()
  await panel.locator('.sc-history .sc-diff').filter({ hasText: 'commit c3c3c3c3 diff' }).waitFor()
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
    await panel.screenshot({ path: join(evidence, `source-control-dag-${theme}.png`) })
  }
  console.log('Source Control merge E2E passed: conflict block selection/save/resolve and branch commit DAG in light/dark themes.')
} finally {
  if (app) await app.close().catch(() => undefined)
  await rm(temporary, { recursive: true, force: true })
}
