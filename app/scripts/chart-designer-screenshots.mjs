/* global process, console, document, getComputedStyle, localStorage, performance */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const projectRoot = process.cwd()
const evidenceDirectory = join(projectRoot, '..', 'document', 'evidence', 'ui', '21-chart-designer')
const electronPath = join(projectRoot, 'dist', 'linux-unpacked', 'tuxsql')
await mkdir(evidenceDirectory, { recursive: true })

function assertNoRawTranslationKeys(label, text) {
  const matches = text.match(/\b[a-z]+\.[a-zA-Z.]+\b/g) ?? []
  if (matches.length) throw new Error(`${label} contains untranslated keys: ${matches.join(', ')}`)
}

async function assertThemeActive(page, theme) {
  const actual = await page.evaluate(() => {
    const root = document.documentElement
    const background = getComputedStyle(root).backgroundColor
    const channels = background.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) throw new Error(`Cannot read app background color: ${background}`)
    const linear = channels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return {
      mode: localStorage.getItem('tuxsql.theme'),
      theme: root.dataset.theme,
      background,
      luminance: 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    }
  })
  const luminanceValid = theme === 'dark' ? actual.luminance < 0.3 : actual.luminance > 0.7
  if (actual.mode !== theme || actual.theme !== theme || !luminanceValid) {
    throw new Error(`Expected ${theme} UI theme; got mode=${actual.mode}, data-theme=${actual.theme}, background=${actual.background}, luminance=${actual.luminance.toFixed(3)}`)
  }
}

async function chooseTheme(page, theme) {
  await page.locator('.menu-row summary').filter({ hasText: /^(View|Exibir)$/ }).click()
  await page.getByRole('button', { name: theme === 'light' ? /^(Theme: Light|Tema: Claro)$/ : /^(Theme: Dark|Tema: Escuro)$/ }).click()
  await page.waitForFunction((expectedTheme) => localStorage.getItem('tuxsql.theme') === expectedTheme && document.documentElement.dataset.theme === expectedTheme, theme)
  await assertThemeActive(page, theme)
}

async function launchAndConnect(theme) {
  const dataRoot = await mkdtemp(join(tmpdir(), 'tuxsql-chart-designer-'))
  let application
  try {
    application = await electron.launch({
      executablePath: electronPath,
      args: [],
      cwd: projectRoot,
      timeout: 90_000,
      env: {
        ...process.env,
        LANGUAGE: 'en',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        TUXSQL_LINUX_BACKEND: 'x11',
        TUXSQL_NO_DEV_LINK: '1',
        XDG_CONFIG_HOME: join(dataRoot, 'config'),
        XDG_CACHE_HOME: join(dataRoot, 'cache'),
        XDG_DATA_HOME: join(dataRoot, 'data'),
        XDG_STATE_HOME: join(dataRoot, 'state'),
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    })
    const page = await application.firstWindow()
    await page.waitForFunction(() => performance.getEntriesByName('tuxsql:first-paint-settled', 'mark').length > 0, null, { timeout: 20_000 })
    page.on('dialog', (dialog) => dialog.accept())
    const later = page.getByRole('button', { name: /^(Later|Depois)$/ }).last()
    if (await later.count()) await later.click().catch(() => undefined)
    const startupClose = page.locator('.panel-dialog-backdrop .panel-dialog-close')
    if (await startupClose.count()) await startupClose.click().catch(() => undefined)

    await page.getByRole('button', { name: 'New Connection' }).last().click()
    await page.getByLabel('Connection name').fill(`Chart Designer ${theme}`)
    await page.getByLabel('Host').fill('127.0.0.1')
    await page.getByLabel('Port').fill('33067')
    await page.getByLabel('User').fill(process.env.MYSQL_USER ?? 'root')
    await page.getByLabel('Password', { exact: true }).fill(process.env.MYSQL_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? 'integration-only')
    await page.getByRole('button', { name: 'Test Connection' }).click()
    await page.getByText(/Successfully connected\. Server version:/).waitFor({ timeout: 20_000 })
    const databaseSelect = page.locator('.form-grid .form-field').filter({ has: page.getByText('Database', { exact: true }) }).locator('select')
    if (await databaseSelect.count()) await databaseSelect.selectOption('information_schema')
    await page.getByRole('button', { name: 'Connect', exact: true }).click()
    await page.getByRole('heading', { name: 'Database Connection Properties' }).waitFor({ state: 'detached', timeout: 30_000 })
    await chooseTheme(page, theme)
    return { application, page, dataRoot }
  } catch (error) {
    if (application) await application.close().catch(() => undefined)
    await rm(dataRoot, { recursive: true, force: true })
    throw error
  }
}

for (const theme of ['light', 'dark']) {
  const { application, page, dataRoot } = await launchAndConnect(theme)
  try {
    const fileMenu = page.locator('.menu-row > details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^(File|Arquivo)$/ }) })
    await fileMenu.locator(':scope > summary').click()
    await fileMenu.getByRole('button', { name: /New SQL|Nova consulta/ }).click()
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.insertText("SELECT 'Jan' AS month, 42 AS sales, 'North' AS segment UNION ALL SELECT 'Feb', 55, 'South' UNION ALL SELECT 'Mar', 38, 'West' UNION ALL SELECT 'Apr', 71, 'North'")
    await page.locator('.sql-context-toolbar').getByRole('button', { name: /Execute|Executar/ }).click()
    const resultGrid = page.locator('.grid-result table.result-grid')
    await resultGrid.locator('tbody tr').nth(3).waitFor({ timeout: 20_000 })
    await page.getByText('Jan', { exact: true }).waitFor()

    const assertBarsTranslated = async () => {
      const text = await page.locator('.app-menubar, .app-toolbar, .sql-context-toolbar, .grid-result').allInnerTexts()
      assertNoRawTranslationKeys('Application and result-grid bars', text.join('\n'))
    }
    await assertBarsTranslated()

    const openDesignerFromRealGrid = async () => {
      await resultGrid.getByRole('cell', { name: 'Jan', exact: true }).click({ button: 'right' })
      const menu = page.locator('.grid-context-menu')
      await menu.waitFor()
      await menu.evaluate((element) => { element.style.top = '48px'; element.style.left = '48px' })
      await menu.locator('details > summary').filter({ hasText: /^(Send to|Enviar para)$/ }).click()
      await menu.getByRole('button', { name: /Chart Designer|Designer de gráficos/ }).click()
      await page.getByTestId('chart-designer-modal').waitFor()
    }

    await openDesignerFromRealGrid()
    await assertBarsTranslated()
    await assertThemeActive(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `${theme}-empty.png`) })

    await page.locator('.chart-add-wrap > button').click()
    await page.getByRole('menuitem', { name: /Series…|Série…/ }).click()
    await page.getByRole('dialog', { name: /Series Gallery|Galeria de séries/ }).waitFor()
    await assertBarsTranslated()
    await assertThemeActive(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `${theme}-gallery.png`) })

    await page.getByRole('button', { name: 'Bar', exact: true }).last().click()
    await page.getByRole('tab', { name: 'Data' }).click()
    await assertBarsTranslated()
    await assertThemeActive(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `${theme}-series-data.png`) })

    await page.getByRole('tab', { name: 'Properties' }).click()
    await page.getByRole('searchbox', { name: 'Search properties' }).fill('Visible')
    await assertBarsTranslated()
    await assertThemeActive(page, theme)
    await page.screenshot({ path: join(evidenceDirectory, `${theme}-series-properties.png`) })
    await page.getByRole('button', { name: /Cancel|Cancelar/ }).last().click()

    await openDesignerFromRealGrid()
    await page.getByText(/There are no visible series in the chart|Não há séries visíveis no gráfico/).waitFor()
    await page.locator('.chart-add-wrap > button').click()
    await page.getByRole('menuitem', { name: /Series…|Série…/ }).click()
    await page.getByRole('button', { name: 'Bar', exact: true }).last().click()
    await page.getByRole('button', { name: /^OK$/ }).click()
    await page.getByRole('status').filter({ hasText: /Chart configuration saved to this result|A configuração do gráfico foi salva neste resultado/ }).waitFor()
    console.log(`Captured real Chart Designer flow (${theme}); SQL was SELECT-only.`)
  } finally {
    const child = application.process()
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await application.close().catch(() => undefined)
    await rm(dataRoot, { recursive: true, force: true })
  }
}

console.log(`Chart Designer evidence captured from the real TuxSQL app: ${evidenceDirectory}`)
