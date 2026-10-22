import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createWindowWebPreferences, registerDevToolsShortcutGuard, shouldEnableDevTools, isDevToolsShortcut } from '../../main/windowOptionsPolicy.js'

const nodeRequire = createRequire(resolve(process.cwd(), 'package.json'))
const chromeCandidates = [process.env.TUXSQL_CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter((candidate): candidate is string => Boolean(candidate))
const embeddedWindowPolicy = `
const shouldEnableDevTools = (${shouldEnableDevTools.toString()})
const createWindowWebPreferences = (${createWindowWebPreferences.toString()})
const isDevToolsShortcut = (${isDevToolsShortcut.toString()})
const registerDevToolsShortcutGuard = (${registerDevToolsShortcutGuard.toString()})
`
const electronPrinterBootstrap = `
${embeddedWindowPolicy}
const { app, BrowserWindow } = require('electron')
const { pathToFileURL } = require('node:url')
const { writeFile } = require('node:fs/promises')
const [htmlPath, pdfPath] = process.argv.slice(2)
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const webPreferences = createWindowWebPreferences({}, { isPackaged: app.isPackaged, devToolsOverride: process.env.TUXSQL_DEVTOOLS })
  const window = new BrowserWindow({ show: false, webPreferences })
  registerDevToolsShortcutGuard(window.webContents, { isPackaged: app.isPackaged, devToolsOverride: process.env.TUXSQL_DEVTOOLS })
  try {
    await window.loadURL(pathToFileURL(htmlPath).href)
    await writeFile(pdfPath, await window.webContents.printToPDF({ printBackground: true, pageSize: 'A4' }))
  } finally { window.destroy(); app.quit() }
}).catch((error) => { process.stderr.write(String(error) + '\\n'); app.exit(1) })
`

export async function printDocumentationPdfHeadless(html: string): Promise<Buffer> {
  if (typeof html !== 'string' || html.length > 100 * 1024 * 1024) throw new Error('The HTML document exceeds the safe PDF printing size limit.')
  let chromeExecutable: string | undefined
  for (const candidate of chromeCandidates) {
    try { await access(candidate); chromeExecutable = candidate; break } catch { /* Tenta o próximo Chromium instalado. */ }
  }
  let electronExecutable: string | undefined
  if (!chromeExecutable) {
    try {
      const packagedPath: unknown = nodeRequire('electron')
      if (typeof packagedPath === 'string') electronExecutable = packagedPath
    } catch { /* Electron pode não estar instalado no ambiente da CLI. */ }
  }
  if (!chromeExecutable && !electronExecutable) throw new Error('Install Chromium/Chrome or Electron to generate a CLI PDF (or set TUXSQL_CHROME_PATH).')
  const tempDirectory = await mkdtemp(resolve(tmpdir(), 'tuxsql-documenter-pdf-'))
  const htmlPath = resolve(tempDirectory, 'document.html')
  const pdfPath = resolve(tempDirectory, 'document.pdf')
  const helperPath = resolve(tempDirectory, 'electron-print.cjs')
  try {
    await writeFile(htmlPath, html, { encoding: 'utf8', mode: 0o600 })
    if (electronExecutable) await writeFile(helperPath, electronPrinterBootstrap, { encoding: 'utf8', mode: 0o600 })
    await new Promise<void>((resolvePromise, reject) => {
      const executable = chromeExecutable ?? electronExecutable as string
      const args = chromeExecutable
        ? ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`]
        : ['--headless', '--no-sandbox', '--disable-gpu', helperPath, htmlPath, pdfPath]
      const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
      let errorOutput = ''
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('PDF rendering exceeded 120 seconds.')) }, 120_000)
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { errorOutput = (errorOutput + chunk).slice(-8000) })
      child.once('error', (error) => { clearTimeout(timeout); reject(error) })
      child.once('exit', (code, signal) => {
        clearTimeout(timeout)
        if (code === 0) resolvePromise()
        else reject(new Error(`PDF rendering failed (exit ${code ?? signal ?? 'unknown'}): ${errorOutput.trim()}`))
      })
    })
    const pdf = await readFile(pdfPath)
    if (pdf.length < 8 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('The headless renderer did not return a valid PDF file.')
    return pdf
  } finally { await rm(tempDirectory, { recursive: true, force: true }) }
}
