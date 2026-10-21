/* global process, console, setTimeout, clearTimeout */
/* global window */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')) ? 'tuxsql' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-extras-ui-'))
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const runPrefix = mysqlTestPrefix('extras_ui')
const snippetName = `${runPrefix}_snippet`
let app
try {
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    const themeLabel = theme === 'Light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
    await page.getByRole('button', { name: themeLabel }).click()
    await page.locator('.workbench').waitFor()
  }
  const openPanel = async (title, selector, menu = 'Tools') => {
    await page.locator('summary').filter({ hasText: menu }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: new RegExp(title, 'i') }).last().click()
    await page.locator(selector).waitFor()
  }
  const closePanel = async (title) => {
    const close = page.locator('.panel-dialog-close')
    if (await close.count()) await close.click()
    else if (title === 'Toolbox') await page.getByRole('button', { name: new RegExp(`Close ${title}`, 'i') }).click()
  }
  const capturePanel = async (title, selector, name, menu = 'Tools') => {
    await chooseTheme('Light')
    await openPanel(title, selector, menu)
    await page.screenshot({ path: join(evidenceDirectory, `${name}-light.png`) })
    await closePanel(title)
    await chooseTheme('Dark')
    await openPanel(title, selector, menu)
    await page.screenshot({ path: join(evidenceDirectory, `${name}-dark.png`) })
    await closePanel(title)
  }
  await page.evaluate(async ({ runPrefix }) => window.tuxsql.queueSchemaUpdate({ connectionId: `${runPrefix}_connection`, database: runPrefix, source: `Playwright ${runPrefix}`, script: `ALTER TABLE \`${runPrefix}_table\` ADD COLUMN \`nickname\` VARCHAR(80);` }), { runPrefix })
  await capturePanel('Data Compare', '.compare-panel', 'data-compare')
  await capturePanel('Schema Compare', '.compare-panel', 'schema-compare', 'Database')
  await capturePanel('Schema Update Script', '.extras-schema-panel', 'schema-update')
  await capturePanel('Code Snippets', '.snippets-panel', 'code-snippets')
  await capturePanel('Toolbox', '.toolbox-panel', 'toolbox')
  await capturePanel('Find Object / Invalid Objects', '.database-tools-panel', 'database-tools')
  await capturePanel('ER Diagram', '.er-panel', 'er-diagram')
  await openPanel('Code Snippets', '.snippets-panel')
  await page.getByRole('button', { name: 'New snippet' }).click()
  await page.getByLabel('Name', { exact: true }).fill(snippetName)
  await page.getByLabel('Prefix', { exact: true }).fill('pwsel')
  await page.locator('.snippet-form textarea').fill('SELECT ${1:columns} FROM ${2:table};$0')
  await page.getByRole('button', { name: 'Save snippet' }).click()
  await page.locator('.snippet-layout nav').getByRole('button', { name: new RegExp(snippetName) }).waitFor()
  await closePanel('Code Snippets')
  await openPanel('Toolbox', '.toolbox-panel')
  await page.locator('.toolbox-panel').getByRole('button', { name: new RegExp(snippetName) }).waitFor()
  await page.evaluate(async () => window.tuxsql.removeSchemaUpdates((await window.tuxsql.listSchemaUpdates()).map((item) => item.id)))
  console.log(`Extras screenshots saved in ${evidenceDirectory}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try {
        await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      } finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
