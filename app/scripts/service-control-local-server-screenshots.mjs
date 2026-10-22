/* global process, console, setTimeout, clearTimeout, document, HTMLButtonElement, window, CustomEvent */
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { _electron as electron } from 'playwright'

const run = promisify(execFile)
const root = process.cwd()
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-linux-services-ui-'))
const fixtureBin = join(dataRoot, 'fixture-bin')
const evidence = join(root, '..', 'document', 'evidence', 'ui')
const profile = join(dataRoot, 'config')
let app
let createdContainerId
let createdContainerName
let dockerAvailable = false
try {
  const preexisting = await run('docker', ['ps', '-a', '--filter', 'label=io.tuxsql.disposable=true', '--format', '{{.ID}}\t{{.Names}}'])
  if (preexisting.stdout.trim()) throw new Error('Disposable-container label already has entries; refusing to alter existing containers.')
  dockerAvailable = true
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
try {
  await mkdir(fixtureBin, { recursive: true })
  await mkdir(evidence, { recursive: true })
  const mockSystemctl = `#!/bin/sh\ncase "$1" in\n  list-unit-files) printf '%s\\n' 'mysql.service enabled enabled' ;;\n  list-units) printf '%s\\n' 'mysql.service loaded active running MySQL Database Server (fixture)' ;;\n  *) exit 1 ;;\nesac\n`
  const systemctlPath = join(fixtureBin, 'systemctl')
  await writeFile(systemctlPath, mockSystemctl, { encoding: 'utf8', mode: 0o700, flag: 'wx' })
  await chmod(systemctlPath, 0o700)
  app = await electron.launch({ executablePath: join(root, 'dist', 'linux-unpacked', 'tuxsql'), args: [root, '--lang=en-US'], env: { ...process.env, PATH: `${fixtureBin}:${process.env.PATH ?? ''}`, LANGUAGE: 'en', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } })
  const page = await app.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.locator('.workbench').waitFor()
  const later = page.getByRole('button', { name: /^(Later|Depois)$/ })
  if (await later.count()) await later.click().catch(() => undefined)
  const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
  if (await startupClose.count()) await startupClose.click().catch(() => undefined)
  const chooseTheme = async (theme) => page.locator('html').evaluate((element, value) => { element.dataset.theme = value }, theme)

  await page.locator('summary').filter({ hasText: 'Database' }).click()
  await page.getByRole('button', { name: 'Service Control' }).click()
  const servicePanel = page.locator('.service-control-panel').first()
  await servicePanel.waitFor()
  await page.waitForFunction(() => document.querySelector('.service-control-panel tbody tr')?.textContent?.includes('mysql.service'))
  await servicePanel.evaluate((element) => {
    const marker = document.createElement('span')
    marker.textContent = 'Fixture service data'
    marker.setAttribute('aria-label', 'Fixture service data')
    marker.style.cssText = 'float:right;font-size:12px;color:#7b5d12;background:#fff2c6;padding:3px 8px;border-radius:4px'
    element.prepend(marker)
  })
  for (const [theme, suffix] of [['light', 'light'], ['dark', 'dark']]) {
    await chooseTheme(theme)
    await servicePanel.screenshot({ path: join(evidence, `service-control-${suffix}.png`) })
  }
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.getByTitle('New Connection (Ctrl+Shift+N)').click()
  const connectionDialog = page.getByRole('dialog', { name: 'Database Connection Properties' })
  await connectionDialog.waitFor()
  await connectionDialog.getByRole('button', { name: 'Embedded', exact: true }).click()
  await connectionDialog.locator('.embedded-disabled').waitFor()
  for (const [theme, suffix] of [['light', 'light'], ['dark', 'dark']]) {
    await chooseTheme(theme)
    await connectionDialog.screenshot({ path: join(evidence, `connection-embedded-${suffix}.png`) })
  }
  await connectionDialog.getByRole('button', { name: 'Cancel' }).click()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tuxsql:open-local-server')))
  const localPanel = page.locator('.local-server-panel')
  await localPanel.waitFor()
  await page.waitForFunction(() => {
    const button = document.querySelector('.local-server-panel .service-control-toolbar button')
    return button instanceof HTMLButtonElement && !button.disabled
  })
  if (!dockerAvailable) throw new Error('Docker is unavailable; a real disposable-server capture cannot be made.')
  await localPanel.getByRole('button', { name: 'Create server', exact: true }).click()
  const card = localPanel.locator('.local-server-card')
  await card.waitFor({ timeout: 240_000 })
  await page.waitForFunction(() => {
    const cardText = document.querySelector('.local-server-card')?.textContent ?? ''
    return /running/i.test(cardText) && /127\.0\.0\.1:\d+/.test(cardText)
  }, null, { timeout: 240_000 })
  createdContainerName = (await card.locator('strong').innerText()).trim()
  const list = await run('docker', ['ps', '-a', '--filter', 'label=io.tuxsql.disposable=true', '--format', '{{.ID}}\t{{.Names}}'])
  const owned = list.stdout.trim().split(/\r?\n/).map(line => line.split('\t')).find(([, name]) => name === createdContainerName)
  if (!owned?.[0]) throw new Error('Created disposable container is missing from Docker inventory.')
  createdContainerId = owned[0]
  for (const [theme, suffix] of [['light', 'light'], ['dark', 'dark']]) {
    await chooseTheme(theme)
    await localPanel.screenshot({ path: join(evidence, `local-server-${suffix}.png`) })
  }
  console.log('Captured Embedded dialog, Service Control with explicit fixture data, and a running Docker server in light and dark themes.')
} finally {
  if (app && createdContainerId) {
    try {
      const page = await app.firstWindow()
      const dialog = page.waitForEvent('dialog').then(async prompt => { await prompt.accept(`REMOVE ${createdContainerName}`) })
      await page.locator('.local-server-panel').getByRole('button', { name: 'Remove container and volume', exact: true }).click()
      await dialog
    } catch {
      await run('docker', ['rm', '--force', '--volumes', createdContainerId]).catch(() => undefined)
    }
  } else if (createdContainerId) {
    await run('docker', ['rm', '--force', '--volumes', createdContainerId]).catch(() => undefined)
  }
  if (app) {
    const child = app.process()
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      let timer
      try { await Promise.race([exited, new Promise(resolve => { timer = setTimeout(resolve, 30_000) })]); if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited } }
      finally { if (timer) clearTimeout(timer) }
    }
  }
  if (dockerAvailable) {
    let remaining = await run('docker', ['ps', '-a', '--filter', 'label=io.tuxsql.disposable=true', '--format', '{{.ID}}\t{{.Names}}'])
    for (const [id] of remaining.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => line.split('\t'))) {
      if (id === createdContainerId) await run('docker', ['rm', '--force', '--volumes', id]).catch(() => undefined)
    }
    remaining = await run('docker', ['ps', '-a', '--filter', 'label=io.tuxsql.disposable=true', '--format', '{{.ID}}\t{{.Names}}'])
    if (remaining.stdout.trim()) {
      console.error(`Disposable containers remain after cleanup: ${remaining.stdout.trim()}`)
      process.exitCode = 1
    } else console.log('Confirmed `docker ps -a --filter label=io.tuxsql.disposable=true` is empty after cleanup.')
  }
  await rm(dataRoot, { recursive: true, force: true })
}
