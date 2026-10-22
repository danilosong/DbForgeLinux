/* global process, console, document, window */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const evidence = resolve(process.cwd(), '..', 'document', 'evidence', 'ui', '00-splash')
await mkdir(evidence, { recursive: true })
const executablePath = process.env.TUXSQL_ELECTRON_PATH ?? join(process.cwd(), 'dist', 'linux-unpacked', 'tuxsql')
const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-splash-preview-'))

async function capture(percent) {
  const app = await electron.launch({
    executablePath,
    args: [],
    env: { ...process.env, HOME: dataRoot, TUXSQL_NO_DEV_LINK: '1', TUXSQL_LINUX_BACKEND: 'x11', TUXSQL_SPLASH_PREVIEW: String(percent), XDG_CONFIG_HOME: join(dataRoot, 'config'), XDG_CACHE_HOME: join(dataRoot, 'cache'), XDG_DATA_HOME: join(dataRoot, 'data'), XDG_STATE_HOME: join(dataRoot, 'state') },
    timeout: 30_000
  })
  try {
    const page = await app.firstWindow()
    await page.locator('.splash').waitFor({ state: 'visible', timeout: 15_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const progress = await page.locator('#progress').getAttribute('aria-valuenow')
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
    if (progress !== String(percent) || dimensions.width !== 560 || dimensions.height !== 340) throw new Error(`Splash preview did not reach ${percent}% at 560x340 (value=${progress}, size=${dimensions.width}x${dimensions.height}).`)
    if (await page.evaluate(() => window.process !== undefined || window.require !== undefined)) throw new Error('Splash renderer unexpectedly exposes Node.js APIs.')
    await page.screenshot({ path: join(evidence, `splash-${percent}.png`) })
  } finally {
    await app.close()
  }
}

try {
  for (const percent of [10, 60, 100]) await capture(percent)
  console.log(`Captured splash previews in ${evidence}`)
} finally {
  await rm(dataRoot, { recursive: true, force: true })
}
