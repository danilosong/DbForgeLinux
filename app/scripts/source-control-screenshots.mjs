/* global process, console, setTimeout, clearTimeout */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright'

const execFileAsync = promisify(execFile)
const root = await mkdtemp(join(tmpdir(), 'dbforge-source-control-ui-'))
const project = join(root, 'project')
const evidenceDirectory = join(process.cwd(), '..', 'document', 'evidence', 'ui')
const unpacked = join(process.cwd(), 'dist', 'linux-unpacked')
const electronPath = join(unpacked, existsSync(join(unpacked, 'dbforgelinux')) ? 'dbforgelinux' : 'electron')
let app
try {
  await mkdir(join(project, 'tables'), { recursive: true })
  await writeFile(join(project, '.dbproj.json'), JSON.stringify({ version: 1, name: 'Inventory scripts', root: project, connections: [], files: ['tables/products.sql'], createdAt: new Date().toISOString() }, null, 2))
  await writeFile(join(project, 'tables/products.sql'), 'CREATE TABLE products (id INT PRIMARY KEY);\n')
  await execFileAsync('git', ['init', '-b', 'main', project], { shell: false })
  await execFileAsync('git', ['-C', project, 'config', 'user.name', 'Screenshot Test'], { shell: false })
  await execFileAsync('git', ['-C', project, 'config', 'user.email', 'screenshots@example.invalid'], { shell: false })
  await execFileAsync('git', ['-C', project, 'add', '--', 'tables/products.sql'], { shell: false })
  await execFileAsync('git', ['-C', project, 'commit', '-m', 'Initial script'], { shell: false })
  await writeFile(join(project, 'tables/products.sql'), 'CREATE TABLE products (id BIGINT PRIMARY KEY);\n')
  await writeFile(join(project, 'tables/recent_products.sql'), 'SELECT id FROM products;\n')
  await mkdir(evidenceDirectory, { recursive: true })
  app = await electron.launch({ executablePath: electronPath, args: [], cwd: process.cwd(), env: { ...process.env, XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_DATA_HOME: join(root, 'data'), XDG_STATE_HOME: join(root, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  await page.locator('.workbench').waitFor()
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, project)
  await page.locator('.menu-row summary').filter({ hasText: /^File$/ }).click()
  await page.getByRole('button', { name: /Open Project/ }).click()
  await page.locator('.sc-project-tree').waitFor()
  await page.locator('.project-explorer-dock').waitFor()
  const chooseTheme = async (theme) => {
    const label = theme === 'Light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/
    if (await page.locator('html').getAttribute('data-theme') !== theme.toLowerCase()) {
      await page.locator('.menu-row summary').filter({ hasText: /^View$/ }).click()
      await page.getByRole('button', { name: label }).click()
    }
  }
  for (const theme of ['Light', 'Dark']) {
    const suffix = theme.toLowerCase()
    await chooseTheme(theme)
    await page.locator('.project-explorer-dock').screenshot({ path: join(evidenceDirectory, `source-control-project-explorer-${suffix}.png`) })
    await page.locator('.menu-row summary').filter({ hasText: /^Database$/ }).click()
    await page.locator('.menu-row details[open] .menu-action').filter({ hasText: /Link Database to Source Control/ }).click()
    await page.locator('.sc-wizard').waitFor()
    await page.locator('.sc-wizard').screenshot({ path: join(evidenceDirectory, `source-control-link-wizard-${suffix}.png`) })
    await page.locator('.sc-wizard header button').click()
  }
  console.log(`Source Control screenshots saved in ${evidenceDirectory}`)
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
  await rm(root, { recursive: true, force: true })
}
