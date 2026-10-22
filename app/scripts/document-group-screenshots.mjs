/* global process, console, localStorage, DragEvent, DataTransfer, setTimeout, document, getComputedStyle */
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const projectRoot = process.cwd()
const evidenceDirectory = join(projectRoot, '..', 'document', 'evidence', 'ui', '01-shell')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-document-groups-'))
const electronPath = join(projectRoot, 'dist', 'linux-unpacked', 'tuxsql')
const documents = [
  { id: 'start', label: 'Start Page', modified: false },
  { id: 'layout-sql-a', label: 'Orders.sql', modified: false, filePath: '/tmp/Orders.sql' },
  { id: 'layout-sql-b', label: 'Customers.sql', modified: false },
  { id: 'layout-query-builder', label: 'Query Builder', modified: false, panelId: 'query-builder' },
  { id: 'layout-er', label: 'ER Diagram', modified: false, panelId: 'schema-view' },
  { id: 'layout-compare', label: 'Schema Compare', modified: false, panelId: 'schema-compare' }
]
let application

async function launchApplication() {
  return electron.launch({
    executablePath: electronPath,
    args: [],
    cwd: projectRoot,
    timeout: 60_000,
    env: {
      ...process.env,
      TUXSQL_LINUX_BACKEND: 'x11',
      TUXSQL_NO_DEV_LINK: '1',
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
}

async function seedDocuments(page) {
  await page.addInitScript(({ docs }) => {
    localStorage.setItem('tuxsql.documents', JSON.stringify(docs))
    localStorage.setItem('tuxsql.selectedDocument', 'layout-sql-b')
    localStorage.setItem('tuxsql.sqlDrafts', JSON.stringify({ 'layout-sql-a': 'SELECT 1;', 'layout-sql-b': 'SELECT 2;' }))
    localStorage.removeItem('tuxsql.documentLayout')
  }, { docs: documents })
  await page.reload()
  await page.locator('.document-tab').filter({ hasText: 'Orders.sql' }).waitFor()
}

async function chooseTheme(page, theme) {
  await page.locator('.menu-row summary').filter({ hasText: /^(View|Exibir)$/ }).click()
  const label = theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
  await page.getByRole('button', { name: label }).click()
  await page.locator('.workbench').waitFor()
  await page.waitForFunction((expectedTheme) => {
    const root = document.documentElement
    return localStorage.getItem('tuxsql.theme') === expectedTheme && root.dataset.theme === expectedTheme
  }, theme)
}

async function assertThemeActive(page, theme) {
  const result = await page.evaluate(() => {
    const root = document.documentElement
    const background = getComputedStyle(root).backgroundColor
    const channels = background.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) throw new Error(`Cannot read app background color: ${background}`)
    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return { mode: localStorage.getItem('tuxsql.theme'), theme: root.dataset.theme, background, luminance }
  })
  const thresholdPassed = theme === 'dark' ? result.luminance < 0.3 : result.luminance > 0.7
  if (result.mode !== theme || result.theme !== theme || !thresholdPassed) {
    throw new Error(`Expected ${theme} theme before capture; found mode=${result.mode}, data-theme=${result.theme}, background=${result.background}, luminance=${result.luminance.toFixed(3)}`)
  }
}

async function dragDocumentAndShowGuides(page, direction, theme) {
  await assertThemeActive(page, theme)
  const tab = page.locator('.document-tab').filter({ hasText: 'Orders.sql' })
  const tabBounds = await tab.boundingBox()
  if (!tabBounds) throw new Error('Source document tab is not visible.')
  await page.mouse.move(tabBounds.x + tabBounds.width / 2, tabBounds.y + tabBounds.height / 2)
  await page.mouse.down()
  const guides = page.locator('.document-drop-guides')
  await guides.waitFor({ state: 'visible', timeout: 4_000 })
  for (const side of ['top', 'bottom', 'left', 'right', 'center']) {
    if (!(await page.locator(`[data-document-dock-direction="${side}"]`).isVisible())) throw new Error(`Missing ${side} document docking guide.`)
  }
  const button = page.locator(`[data-document-dock-direction="${direction}"]`)
  await button.evaluate((element) => element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })))
  await button.waitFor({ state: 'visible' })
  await page.locator(`[data-document-dock-direction="${direction}"].active`).waitFor({ state: 'visible' })
  const screenshotName = `document-docking-guides-${direction}-${theme}.png`
  await page.screenshot({ path: join(evidenceDirectory, screenshotName) })
  await button.evaluate((element) => element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })))
  await page.mouse.up()
  if (direction === 'center') await page.locator('.document-split-pane').waitFor({ state: 'detached' })
  else await page.locator('.document-split-pane').waitFor({ state: 'visible' })
  await page.waitForFunction(() => Boolean(localStorage.getItem('tuxsql.documentLayout')))
  const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('tuxsql.documentLayout') || 'null'))
  if (!layout?.root) throw new Error(`Dropping ${direction} did not persist the document layout.`)
}

async function closeApplication(app) {
  const child = app.process()
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 15_000))])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}

try {
  await mkdir(evidenceDirectory, { recursive: true })
  application = await launchApplication()
  const page = await application.firstWindow()
  page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') console.error(`renderer console: ${message.text()}`) })
  await page.locator('.workbench').waitFor({ timeout: 30_000 })
  await page.setViewportSize({ width: 1440, height: 960 })
  await seedDocuments(page)
  for (const theme of ['light', 'dark']) {
    for (const direction of ['top', 'bottom', 'left', 'right']) {
      await seedDocuments(page)
      await chooseTheme(page, theme)
      await dragDocumentAndShowGuides(page, direction, theme)
    }
  }
  console.log(`Document docking screenshots saved in ${evidenceDirectory}`)
} finally {
  if (application) await closeApplication(application)
  await rm(dataRoot, { recursive: true, force: true })
}
