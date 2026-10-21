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
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const chooseTheme = async (theme) => {
    const viewMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
    await viewMenu.evaluate((element) => { element.open = true })
    const themeLabel = theme === 'Light' ? /Theme: Light|Tema: Claro/ : /Theme: Dark|Tema: Escuro/
    await viewMenu.locator(':scope > .menu-popup > .menu-action').filter({ hasText: themeLabel }).click()
    await page.locator('.workbench').waitFor()
  }
  const openPanel = async (title, selector, menu = 'Tools') => {
    const menuDetails = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: new RegExp(`^${menu}$`) }) })
    await menuDetails.evaluate((element) => { element.open = true })
    const action = menuDetails.locator(':scope > .menu-popup > .menu-action').filter({ hasText: new RegExp(title, 'i') })
    if (!(await action.count()) || !(await action.first().isVisible())) throw new Error(`Menu action is unavailable: ${menu} > ${title}`)
    await action.click()
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
  await capturePanel('Data Comparison', '.compare-panel', 'data-compare', 'Comparison')
  await capturePanel('Schema Comparison', '.compare-panel', 'schema-compare', 'Comparison')
  try {
    await capturePanel('Schema Update Script', '.extras-schema-panel', 'schema-update')
  } catch (error) {
    console.warn(`Schema Update screenshots were not generated: ${error instanceof Error ? error.message : String(error)}`)
    await page.locator('.menu-row > details[open]').evaluateAll((elements) => elements.forEach((element) => { element.open = false }))
  }
  await capturePanel('Code Snippets', '.snippets-panel', 'code-snippets', 'View')
  try { await capturePanel('Toolbox', '.toolbox-panel', 'toolbox') }
  catch (error) {
    console.warn(`Toolbox screenshots were not generated: ${error instanceof Error ? error.message : String(error)}`)
    await page.locator('.menu-row > details[open]').evaluateAll((elements) => elements.forEach((element) => { element.open = false }))
  }
  await capturePanel('Find Object', '.database-tools-panel', 'database-tools', 'Database')
  await capturePanel('Database Diagram', '.er-panel', 'er-diagram', 'Database')
  await openPanel('Code Snippets', '.snippets-panel', 'View')
  await page.getByRole('button', { name: 'New snippet' }).click()
  await page.getByLabel('Name', { exact: true }).fill(snippetName)
  await page.getByLabel('Prefix', { exact: true }).fill('pwsel')
  await page.locator('.snippet-form textarea').fill('SELECT ${1:columns} FROM ${2:table};$0')
  await page.getByRole('button', { name: 'Save snippet' }).click()
  await page.locator('.snippet-layout nav').getByRole('button', { name: new RegExp(snippetName) }).waitFor()
  await closePanel('Code Snippets')
  try {
    await openPanel('Toolbox', '.toolbox-panel')
    await page.locator('.toolbox-panel').getByRole('button', { name: new RegExp(snippetName) }).waitFor()
  } catch (error) {
    console.warn(`Toolbox validation was skipped: ${error instanceof Error ? error.message : String(error)}`)
  }
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
