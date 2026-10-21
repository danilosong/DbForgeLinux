/* global process, console, setTimeout, clearTimeout, performance */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { _electron as electron } from 'playwright'

const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-startup-benchmark-'))
const executablePath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
const results = []

async function launch(label) {
  const started = performance.now()
  const app = await electron.launch({ executablePath, args: ['--disable-gpu'], timeout: 90_000, env: { ...process.env, XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  try {
    const page = await app.firstWindow()
    const dialog = page.locator('.panel-dialog-backdrop:has(.update-dialog)')
    await page.addLocatorHandler(dialog, async () => {
      const later = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
      if (await later.count()) await later.click()
      else await dialog.locator('.panel-dialog-close').last().click()
    })
    await page.locator('.workbench').waitFor({ state: 'visible', timeout: 45_000 })
    const visible = performance.now()
    await page.locator('.explorer-tree').waitFor({ state: 'visible' })
    const explorerReady = performance.now()
    const newSql = page.getByRole('button', { name: /^\+ SQL$/ })
    if (await newSql.count()) await newSql.click()
    else await page.getByRole('button', { name: /New SQL/ }).click()
    await page.locator('.monaco-editor .view-lines').last().waitFor({ state: 'visible', timeout: 45_000 })
    const editorReady = performance.now()
    const row = { run: label, windowVisibleMs: Math.round(visible - started), explorerReadyMs: Math.round(explorerReady - started), editorInteractiveMs: Math.round(editorReady - started) }
    results.push(row)
    console.log(JSON.stringify(row))
  } finally {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
}

try {
  await launch('cold')
  await launch('warm')
  console.log(JSON.stringify({ summary: { cold: results[0], warm: results[1] } }, null, 2))
} finally { await rm(dataRoot, { recursive: true, force: true }) }
