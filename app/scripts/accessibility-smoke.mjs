/* global process, console, setTimeout, clearTimeout, window, document */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-a11y-'))
const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js')
let app
const issues = []
try {
  app = await electron.launch({ executablePath: appPath, args: ['--disable-gpu'], env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  page.on('dialog', (dialog) => dialog.dismiss())
  await page.addInitScript({ path: axePath })
  await page.reload()
  await page.locator('.document-tabs').waitFor()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const close = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await close.count()) await close.click().catch(() => undefined)

  async function scan(label) {
    const results = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
    for (const violation of results.violations) {
      issues.push({ label, id: violation.id, impact: violation.impact, count: violation.nodes.length, description: violation.help, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })
      console.log(`${label}: ${violation.id} (${violation.impact}) ${violation.help} · ${violation.nodes.map((node) => `${node.target.join(',')} ${node.failureSummary ?? ''}`).join('; ')}`)
    }
    console.log(`${label}: ${results.violations.length} axe violations`)
  }
  async function openPanel(menu, action) {
    const menuDetails = page.locator('nav.menu-row details').filter({ has: page.locator('summary').filter({ hasText: menu }) }).first()
    await menuDetails.locator(':scope > summary').click()
    await menuDetails.getByRole('button', { name: new RegExp(action) }).first().click()
    await page.locator('.tool-document .tool-panel').first().waitFor()
    await page.waitForTimeout(100)
    await scan(`${menu} / ${action}`)
    const dialogClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
    if (await dialogClose.count()) await dialogClose.click()
  }

  await scan('Start Page')
  await page.keyboard.press('Control+n')
  await page.locator('.monaco-editor').waitFor()
  await scan('SQL Editor')
  await openPanel('View', 'Query Builder')
  await openPanel('Comparison', 'Schema Comparison')
  await openPanel('Comparison', 'Data Comparison')
  await openPanel('Database', 'Security Manager')
  await openPanel('Tools', 'Options')
  const viewMenu = page.locator('nav.menu-row details').filter({ has: page.locator('summary').filter({ hasText: 'View' }) }).first()
  await viewMenu.locator(':scope > summary').click()
  await viewMenu.getByRole('button', { name: 'Tasks' }).click()
  const tasksDock = page.locator('.right-dock .tasks-panel')
  await tasksDock.waitFor()
  await page.evaluate(() => window.dbforge.recordRecentTask({ kind: 'backup', title: 'Keyboard backup task', detail: 'a11y fixture' }))
  await tasksDock.getByRole('button', { name: /Refresh/ }).click()
  await tasksDock.getByText('Keyboard backup task').waitFor()
  await scan('View / Tasks')
  const refreshTasks = tasksDock.getByRole('button', { name: /Refresh/ })
  await refreshTasks.focus()
  await page.keyboard.press('Tab')
  if (await page.locator(':focus').count() !== 1) throw new Error('Tasks Explorer keyboard focus left the document.')
  await tasksDock.getByRole('button', { name: 'Reopen' }).click()
  const toolsPanel = page.locator('.database-tools-panel')
  await toolsPanel.waitFor()
  await page.locator('.backup-wizard').waitFor()
  await page.waitForTimeout(100)
  await scan('Database / Backup wizard')
  const wizardButtons = page.locator('.backup-wizard button:enabled')
  if (await wizardButtons.count() < 3) throw new Error('Backup wizard does not expose its keyboard controls.')
  await wizardButtons.first().focus()
  await page.keyboard.press('Tab')
  if (!(await page.locator('.backup-wizard :focus').count())) throw new Error('Keyboard focus escaped the Backup wizard.')
  if (issues.length) {
    console.error(JSON.stringify(issues, null, 2))
    process.exitCode = 1
  }
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
