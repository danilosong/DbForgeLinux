/* global process, console, setTimeout, localStorage, document */
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const projectRoot = process.cwd()
const evidenceDirectory = join(projectRoot, '..', 'document', 'evidence', 'ui', '01-shell')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-dock-layout-'))
const packagedElectronPath = join(projectRoot, 'dist', 'linux-unpacked', 'tuxsql')
const electronPath = existsSync(packagedElectronPath) ? packagedElectronPath : join(projectRoot, 'node_modules', 'electron', 'dist', 'electron')
const directions = ['top', 'bottom', 'left', 'right']
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
      XDG_CONFIG_HOME: join(dataRoot, 'config'),
      XDG_CACHE_HOME: join(dataRoot, 'cache'),
      XDG_DATA_HOME: join(dataRoot, 'data'),
      XDG_STATE_HOME: join(dataRoot, 'state'),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
}

async function stopApplication(app) {
  const child = app.process()
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 15_000))])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}

async function chooseTheme(page, theme) {
  await page.locator('.menu-row summary').filter({ hasText: /^(View|Exibir)$/ }).click()
  const label = theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
  await page.getByRole('button', { name: label }).click()
  await page.locator('.workbench').waitFor()
}

async function openTasksDock(page) {
  await page.locator('.menu-row summary').filter({ hasText: /^(View|Exibir)$/ }).click()
  await page.locator('.menu-popup .menu-action').filter({ hasText: /^(Tasks|Recent Tasks|Tarefas|Tarefas recentes)$/ }).click()
  await page.locator('.right-dock').waitFor({ state: 'visible' })
}

async function closeTasksDock(page) {
  const close = page.locator('.right-dock > header button').last()
  await close.click()
  await page.locator('.right-dock').waitFor({ state: 'detached' })
}

async function dragDockTo(page, direction, screenshotName) {
  const header = page.locator('.right-dock > header')
  const bounds = await header.boundingBox()
  if (!bounds) throw new Error('Dock panel header is not visible.')
  const start = { x: bounds.x + Math.min(90, bounds.width / 2), y: bounds.y + bounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 18, start.y + 14, { steps: 2 })
  const guides = page.locator('.dock-guides')
  await guides.waitFor({ state: 'visible' })
  for (const side of directions) await page.getByRole('button', { name: `Dock ${side}` }).waitFor({ state: 'visible' })
  if (screenshotName) await page.screenshot({ path: join(evidenceDirectory, screenshotName) })
  const target = page.locator(`[data-dock-direction="${direction}"]`)
  const targetBounds = await target.boundingBox()
  if (!targetBounds) throw new Error(`Dock guide for ${direction} has no visible bounds.`)
  const point = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 }
  await page.mouse.move(point.x, point.y, { steps: 5 })
  const hoveredDirection = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-dock-direction]')?.getAttribute('data-dock-direction'), point)
  if (hoveredDirection !== direction) throw new Error(`Dragging over ${direction} guide resolved to ${String(hoveredDirection)}.`)
  await page.mouse.up()
  await page.locator(`.right-dock.dock-${direction}`).waitFor({ state: 'visible' })
  const stored = await page.evaluate(() => localStorage.getItem('tuxsql.panelDockDirection'))
  if (stored !== direction) throw new Error(`Dock direction ${direction} was not persisted; got ${String(stored)}.`)
}

try {
  await mkdir(evidenceDirectory, { recursive: true })
  application = await launchApplication()
  const page = await application.firstWindow()
  await page.locator('.workbench').waitFor({ timeout: 30_000 })
  await page.setViewportSize({ width: 1440, height: 960 })

  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme)
    await openTasksDock(page)
    for (const direction of directions) {
      await dragDockTo(page, direction, `docking-guides-${direction}-${theme}.png`)
      await page.screenshot({ path: join(evidenceDirectory, `docking-${direction}-${theme}.png`) })
      await closeTasksDock(page)
      await openTasksDock(page)
      await page.locator(`.right-dock.dock-${direction}`).waitFor({ state: 'visible' })
      const persisted = await page.evaluate(() => localStorage.getItem('tuxsql.panelDockDirection'))
      if (persisted !== direction) throw new Error(`Reopening the dock lost the ${direction} position in ${theme} mode.`)
    }
    await page.locator('.right-dock.dock-right').waitFor({ state: 'visible' })
    const persistedAfterReopen = await page.evaluate(() => localStorage.getItem('tuxsql.panelDockDirection'))
    if (persistedAfterReopen !== 'right') throw new Error(`The final right docking position did not survive reopening in ${theme} mode.`)
    await page.screenshot({ path: join(evidenceDirectory, `docking-persisted-right-${theme}.png`) })
    await closeTasksDock(page)
  }
  await stopApplication(application)
  application = await launchApplication()
  const relaunchedPage = await application.firstWindow()
  await relaunchedPage.locator('.workbench').waitFor({ timeout: 30_000 })
  await chooseTheme(relaunchedPage, 'dark')
  await openTasksDock(relaunchedPage)
  await relaunchedPage.locator('.right-dock.dock-right').waitFor({ state: 'visible' })
  const persistedAfterAppRestart = await relaunchedPage.evaluate(() => localStorage.getItem('tuxsql.panelDockDirection'))
  if (persistedAfterAppRestart !== 'right') throw new Error(`The final right docking position did not survive an app restart.`)
  await relaunchedPage.screenshot({ path: join(evidenceDirectory, 'docking-persisted-after-restart-dark.png') })
  console.log(`Docking screenshots and four direction drag checks saved in ${evidenceDirectory}`)
} finally {
  if (application) await stopApplication(application)
  await rm(dataRoot, { recursive: true, force: true })
}
