/* global process, console, setTimeout, clearTimeout */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const appPath = join(process.cwd(), 'dist', 'linux-unpacked', existsSync(join(process.cwd(), 'dist', 'linux-unpacked', 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
const dataRoot = await mkdtemp(join(tmpdir(), 'dbforge-compare-options-'))
const evidence = join(process.cwd(), '..', 'document', 'evidence', 'ui')
let app
try {
  await mkdir(evidence, { recursive: true })
  app = await electron.launch({ executablePath: appPath, args: [], env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  const theme = async (name) => {
    await page.locator('summary').filter({ hasText: 'View' }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: name }).last().click()
  }
  const open = async (menu, item, selector) => {
    await page.locator('summary').filter({ hasText: menu }).click()
    await page.locator('.menu-popup .menu-action').filter({ hasText: item }).click()
    await page.locator(selector).waitFor()
  }
  for (const [themeName, suffix] of [['Light', 'light'], ['Dark', 'dark']]) {
    await theme(themeName)
    await open('Comparison', 'New Data Comparison', '.compare-panel')
    await page.screenshot({ path: join(evidence, `data-compare-source-${suffix}.png`) })
    await page.getByRole('button', { name: /2\. Options/ }).click()
    await page.screenshot({ path: join(evidence, `data-compare-options-${suffix}.png`) })
    await page.getByRole('button', { name: /3\. Mapping/ }).click()
    await page.screenshot({ path: join(evidence, `data-compare-mapping-${suffix}.png`) })
    await open('Tools', 'Options', '.options-panel')
    await page.screenshot({ path: join(evidence, `options-general-${suffix}.png`) })
    await page.locator('.options-sidebar .options-tree-group').filter({ hasText: 'Query Builder' }).getByRole('button', { name: 'General' }).click()
    await page.screenshot({ path: join(evidence, `options-query-builder-${suffix}.png`) })
    await page.locator('.options-sidebar .options-tree-group').filter({ hasText: 'Data Comparison' }).getByRole('button', { name: 'General' }).click()
    await page.screenshot({ path: join(evidence, `options-data-comparison-${suffix}.png`) })
    await page.locator('.panel-dialog-close').click()
  }
  console.log(`Data Compare and Options screenshots saved in ${evidence}`)
} finally {
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  await rm(dataRoot, { recursive: true, force: true })
}
