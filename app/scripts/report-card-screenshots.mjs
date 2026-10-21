/* global process, console, setTimeout, clearTimeout, document */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import mysql from 'mysql2/promise'
import { _electron as electron } from 'playwright'
import { mysqlTestPrefix } from './mysql-test-prefix.mjs'

const prefix = mysqlTestPrefix('report_card_ui')
const table = `${prefix}_sales`
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-report-card-'))
const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 33067), user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASSWORD ?? 'integration-only' })
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const repeats = Number(process.env.REPORT_CARD_REPEAT ?? 10)
let app
let phase = 'database setup'
const pageErrors = []
try {
  await admin.query(`CREATE DATABASE \`${prefix}\``)
  await admin.query(`CREATE TABLE \`${prefix}\`.\`${table}\` (id INT PRIMARY KEY, region VARCHAR(40), amount DECIMAL(10,2))`)
  await admin.query(`INSERT INTO \`${prefix}\`.\`${table}\` VALUES (1,'North',18.5),(2,'South',22),(3,'West',14.25)`)
  const executablePath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
  app = await electron.launch({ executablePath, args: ['--disable-gpu'], timeout: 90_000, env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addLocatorHandler(page.locator('.panel-dialog-backdrop:has(.update-dialog)'), async () => {
    const later = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
    if (await later.count()) await later.click()
    else await page.locator('.panel-dialog-backdrop:has(.update-dialog) .panel-dialog-close').last().click()
  })
  await page.locator('.workbench').waitFor({ state: 'visible', timeout: 30_000 })
  const updaterLater = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
  if (await updaterLater.count()) await updaterLater.click()

  phase = 'connect disposable database'
  await page.getByRole('button', { name: 'New Connection' }).last().click()
  await page.getByLabel('Connection name').fill('Disposable Report Card')
  await page.getByLabel('Host').fill(process.env.MYSQL_HOST ?? '127.0.0.1')
  await page.getByLabel('Port').fill(process.env.MYSQL_PORT ?? '33067')
  await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.MYSQL_PASSWORD ?? 'integration-only')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.locator('#connection-database').selectOption(prefix, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
  await page.locator('.node-name').filter({ hasText: 'Disposable Report Card' }).waitFor({ state: 'visible' })
  await page.locator('select[aria-label="Ativa conexão"]').selectOption({ label: 'Disposable Report Card' })
  const themeMenu = page.locator('summary').filter({ hasText: 'View' })
  const selectTheme = async (theme) => {
    const button = page.getByRole('button', { name: `Theme: ${theme}`, exact: true })
    if (await button.isVisible()) return
    await themeMenu.click()
    await page.getByRole('button', { name: `Theme: ${theme}`, exact: true }).click()
    await page.waitForFunction((expected) => document.documentElement.getAttribute('data-theme') === expected.toLowerCase(), theme)
  }
  const captureThemePair = async (fileBase) => {
    for (const theme of ['Light', 'Dark']) {
      await selectTheme(theme)
      await page.screenshot({ path: join(evidence, `${fileBase}-${theme.toLowerCase()}.png`) })
    }
  }
  await mkdir(evidence, { recursive: true })

  phase = 'execute SQL and render result grid'
  await page.keyboard.press('Control+n')
  const editor = page.locator('.monaco-editor').last()
  await editor.waitFor({ state: 'visible' })
  await editor.locator('.view-lines').last().click({ position: { x: 280, y: 10 } })
  await page.keyboard.insertText(`SELECT id, region, amount FROM \`${table}\` ORDER BY id;`)
  await page.locator('summary').filter({ hasText: 'SQL' }).click()
  await page.getByRole('button', { name: /^Execute F5$/ }).click()
  const grid = page.getByTestId('result-grid').last()
  await grid.waitFor({ state: 'visible', timeout: 30_000 })
  await grid.locator('.result-grid tbody tr:not(.grid-spacer) td').filter({ hasText: 'North' }).waitFor({ state: 'visible', timeout: 30_000 })
  await grid.getByRole('button', { name: 'Card View' }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="grid-card-view"]')?.getAttribute('data-state') === 'ready' && document.querySelector('[data-testid="grid-card-record"]')?.textContent?.includes('North'), null, { timeout: 10_000 })
  for (const theme of ['Light', 'Dark']) {
    await selectTheme(theme)
    await page.waitForFunction(() => document.querySelector('[data-testid="grid-card-view"]')?.getAttribute('data-state') === 'ready' && document.querySelector('[data-testid="grid-card-record"]')?.textContent?.includes('North'))
    await page.screenshot({ path: join(evidence, `grid-card-view-${theme.toLowerCase()}.png`) })
  }
  await grid.getByRole('button', { name: 'Table View' }).click()
  for (let iteration = 1; iteration < repeats; iteration += 1) {
    phase = `card view render cycle ${iteration + 1}/${repeats}`
    await grid.getByRole('button', { name: 'Card View' }).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="grid-card-view"]')?.getAttribute('data-state') === 'ready' && document.querySelector('[data-testid="grid-card-record"]')?.textContent?.includes('North'))
    await grid.getByRole('button', { name: 'Table View' }).click()
  }

  phase = 'open report designer and pivot panel'
  await page.locator('summary').filter({ hasText: 'Database' }).click()
  await page.locator('.menu-popup .menu-action').filter({ hasText: 'Report Designer' }).click()
  const designer = page.getByTestId('report-designer')
  await designer.waitFor({ state: 'visible' })
  await designer.locator('.rp-designer-side textarea').fill(`SELECT id, region, amount FROM \`${table}\``)
  await designer.getByRole('button', { name: 'Load data' }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="report-designer"]')?.getAttribute('data-state') === 'ready' && document.querySelector('[data-testid="report-designer"]')?.getAttribute('aria-busy') === 'false', null, { timeout: 20_000 })
  await designer.getByTestId('report-band-pageHeader').waitFor({ state: 'visible' })
  await designer.locator('.rp-field').filter({ hasText: 'region' }).dragTo(designer.getByTestId('report-band-pageHeader'))
  await designer.getByTestId('report-page-preview').waitFor({ state: 'visible' })
  await captureThemePair('report-designer')
  await designer.getByRole('button', { name: 'Close designer' }).click()
  await designer.waitFor({ state: 'detached' })
  const panel = page.getByTestId('report-pivot-panel')
  await panel.waitFor({ state: 'visible' })

  for (let iteration = 0; iteration < repeats; iteration += 1) {
    phase = `report/pivot/card render cycle ${iteration + 1}/${repeats}`
    await panel.getByRole('button', { name: 'Load query fields' }).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="report-query-state"]')?.getAttribute('data-state') === 'ready' && document.querySelector('[data-testid="report-pivot-panel"]')?.getAttribute('aria-busy') === 'false', null, { timeout: 20_000 })
    await panel.getByLabel('Zone for region').selectOption('rows')
    await panel.getByLabel('Zone for id').selectOption('none')
    await panel.getByLabel('Zone for amount').selectOption('values')
    await panel.getByLabel('Aggregation for amount').selectOption('sum')
    await panel.getByRole('button', { name: 'Build Pivot Table' }).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="pivot-grid"] tbody tr') !== null && document.querySelector('[data-testid="report-pivot-panel"]')?.getAttribute('aria-busy') === 'false', null, { timeout: 20_000 })

    await panel.getByRole('button', { name: 'Report Designer' }).click()
    await designer.waitFor({ state: 'visible' })
    await designer.getByTestId('report-band-pageHeader').waitFor({ state: 'visible' })
    await designer.locator('.rp-field').first().dragTo(designer.getByTestId('report-band-pageHeader'))
    await designer.getByTestId('report-page-preview').waitFor({ state: 'visible' })
    await designer.getByRole('button', { name: 'Close designer' }).click()
    await designer.waitFor({ state: 'detached' })

    await panel.getByRole('button', { name: 'Show Chart' }).click()
    const chart = page.getByTestId('pivot-chart')
    await chart.waitFor({ state: 'visible' })
    await chart.locator('svg[role="img"]').waitFor({ state: 'visible' })
    await page.waitForFunction(() => { const svg = document.querySelector('[data-testid="pivot-chart"] svg'); const box = svg?.getBoundingClientRect(); return Boolean(svg && box && box.width > 0 && box.height > 0 && svg.querySelectorAll('rect, path, polyline, circle').length > 0) })
    if (iteration === 0) await captureThemePair('pivot-chart')
    await panel.getByLabel('Zone for region').selectOption('none')
    await panel.getByLabel('Zone for id').selectOption('rows')
    await chart.locator('svg text').filter({ hasText: 'id: 1' }).waitFor({ state: 'visible', timeout: 20_000 })
    await panel.getByRole('button', { name: 'Hide Chart' }).click()
    await chart.waitFor({ state: 'detached' })

  }
  if (pageErrors.length) throw new Error(`Renderer errors: ${pageErrors.join(' | ')}`)
  console.log(`Passed ${repeats} consecutive report designer, pivot chart and card view cycles; screenshots saved in ${evidence}`)
} catch (error) {
  console.error(`Failure during ${phase}: ${error instanceof Error ? error.stack : String(error)}`)
  if (app) {
    try { await app.firstWindow().then((page) => page.screenshot({ path: join(tmpdir(), 'dbforge-report-card-failure.png') })) } catch { /* capture is best effort */ }
  }
  throw error
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
  await admin.query(`DROP DATABASE IF EXISTS \`${prefix}\``)
  await admin.end()
  await rm(dataRoot, { recursive: true, force: true })
}
