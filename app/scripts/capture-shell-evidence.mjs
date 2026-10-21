/* global document */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { _electron as electron } from 'playwright'

const projectRoot = process.cwd()
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-ui-evidence-'))
const sqlFile = join(dataRoot, 'cli-open.sql')
const output = join(projectRoot, '..', 'document', 'evidence', 'ui', 'linux-open-sql.png')
let application
function descendantsOf(rootPid) {
  const children = new Map()
  for (const row of execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n')) {
    const [pidText, parentText] = row.trim().split(/\s+/)
    const pid = Number(pidText); const parent = Number(parentText)
    if (Number.isInteger(pid) && Number.isInteger(parent)) children.set(parent, [...(children.get(parent) ?? []), pid])
  }
  const found = new Set(); const pending = [rootPid]
  while (pending.length) for (const child of children.get(pending.pop()) ?? []) if (!found.has(child)) { found.add(child); pending.push(child) }
  return [...found]
}
function isAlive(pid) { try { process.kill(pid, 0); return true } catch { return false } }
try {
  await writeFile(sqlFile, '-- opened by file argument\nSELECT 1 AS linux_open_test;\n', { mode: 0o600 })
  application = await electron.launch({
    executablePath: join(projectRoot, 'dist', 'linux-unpacked', 'tuxsql'),
    args: [`--user-data-dir=${join(dataRoot, 'profile')}`, pathToFileURL(sqlFile).href],
    timeout: 60_000,
    env: { ...process.env, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TUXSQL_LINUX_BACKEND: 'x11', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  const page = await application.firstWindow()
  await page.locator('.monaco-editor').waitFor({ state: 'visible', timeout: 30_000 })
  await mkdir(join(projectRoot, '..', 'document', 'evidence', 'ui'), { recursive: true })
  const evidenceDirectory = join(projectRoot, '..', 'document', 'evidence', 'ui')
  const viewMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^View$/ }) })
  for (const theme of ['Light', 'Dark']) {
    await viewMenu.evaluate((element) => { element.open = true })
    const themeAction = viewMenu.getByRole('button', { name: new RegExp(`Theme: ${theme}|Tema: ${theme === 'Light' ? 'Claro' : 'Escuro'}`) })
    await themeAction.click()
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value.toLowerCase(), theme)
    await page.screenshot({ path: join(evidenceDirectory, `shell-${theme.toLowerCase()}.png`) })
  }
  await viewMenu.evaluate((element) => { element.open = true })
  await viewMenu.getByRole('button', { name: /Theme: Light|Tema: Claro/ }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await page.screenshot({ path: join(evidenceDirectory, 'shell.png') })
  await page.screenshot({ path: output, fullPage: false })
  process.stdout.write(`Saved ${output}\n`)
} finally {
  if (application) {
    const child = application.process()
    const descendants = descendantsOf(child.pid)
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    for (const pid of descendants) try { process.kill(pid, 'SIGTERM') } catch { /* Already exited with the main Electron process. */ }
    while (descendants.some(isAlive)) await delay(25)
  }
  await rm(dataRoot, { recursive: true, force: true })
}
