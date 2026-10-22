/* global process, console, setTimeout, clearTimeout, window, CustomEvent */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import mysql from 'mysql2/promise'
import { mysqlTestPrefix, mysqlTestUser } from './mysql-test-prefix.mjs'

const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-result-limit-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui', 'sql-execution-limit')
const database = mysqlTestPrefix('result_limit_ui')
const user = mysqlTestUser('result_limit_ui')
const admin = await mysql.createConnection({ host: '127.0.0.1', port: 33067, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only' })
let app
try {
  await mkdir(join(dataRoot, 'config', 'tuxsql'), { recursive: true })
  await writeFile(join(dataRoot, 'config', 'tuxsql', 'dev-link.json'), JSON.stringify({ repoPath: join(process.cwd(), '..') }), { mode: 0o600 })
  await admin.query(`CREATE DATABASE \`${database}\``)
  await admin.query(`CREATE USER '${user}'@'%' IDENTIFIED BY ''`)
  await admin.query(`GRANT SELECT ON \`${database}\`.* TO '${user}'@'%'`)
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql'), args: [join(process.cwd(), 'out', 'main', 'index.js')], cwd: process.cwd(), env: { ...process.env, HOME: dataRoot, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  app.process().stderr?.on('data', (chunk) => console.log('Electron:', String(chunk).trim()))
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  await page.locator('.workbench').waitFor()
  await page.getByRole('complementary').getByRole('button', { name: 'New Connection' }).click()
  await page.getByLabel('Connection name').fill('Result limit evidence')
  await page.getByLabel('Host').fill('127.0.0.1')
  await page.getByLabel('Port').fill('33067')
  await page.getByLabel('User').fill(user)
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await page.getByText(/Successfully connected/).waitFor()
  await page.getByLabel('Database', { exact: true }).selectOption(database)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached' })

  const resultLimit = 1000
  const savedLimit = await page.evaluate(async (limit) => {
    const { settings } = await window.tuxsql.loadSettings()
    const saved = await window.tuxsql.saveSettings({ ...settings, execution: { ...settings.execution, resultRowLimit: limit } })
    window.dispatchEvent(new CustomEvent('tuxsql:settings-changed', { detail: saved }))
    return saved.execution.resultRowLimit
  }, resultLimit)
  console.log('Saved result-row limit:', savedLimit)

  await page.keyboard.press('Control+n')
  const editor = page.locator('.monaco-editor')
  await editor.waitFor()
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.insertText('WITH digits AS (SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) SELECT a.d + b.d * 10 + c.d * 100 + d.d * 1000 + e.d * 10000 + f.d * 100000 AS n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e CROSS JOIN digits f WHERE a.d + b.d * 10 + c.d * 100 + d.d * 1000 + e.d * 10000 + f.d * 100000 < 200000')
  await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute/ }).click()
  await page.waitForTimeout(1000)
  console.log('Grid notice:', await page.locator('.grid-truncated-notice').innerText().catch(() => 'not present'))
  await page.locator('.grid-truncated-notice').filter({ hasText: new RegExp(`Showing first ${resultLimit} rows|Exibindo as primeiras ${resultLimit} linhas`) }).waitFor({ timeout: 60000 })
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      const view = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
      await view.evaluate((element) => { element.open = true })
      await view.getByRole('button', { name: theme === 'light' ? /^Theme: Light$/ : /^Theme: Dark$/ }).click()
    }
    await page.screenshot({ path: join(evidence, `result-truncated-${theme}.png`) })
  }
  console.log(`Execution limit screenshots saved under ${evidence}.`)
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
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => undefined)
  await admin.query(`DROP USER IF EXISTS '${user}'@'%'`).catch(() => undefined)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
