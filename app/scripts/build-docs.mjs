/* global process, console, URL, Buffer */
import { execFileSync } from 'node:child_process'
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { marked } from 'marked'

const appRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(appRoot, '..')
const buildRoot = resolve(appRoot, 'build-resources')
const docsRoot = resolve(buildRoot, 'docs')
export const languageCopy = {
  en: { title: 'TuxSQL Documentation', home: 'Documentation', search: 'Search documentation', nav: 'On this page', license: 'License and third-party notices', contents: 'Contents', chromium: 'Open Electron and Chromium notices', chromiumHint: 'Chromium notices are installed beside the TuxSQL executable when provided by Electron.' },
  'pt-BR': { title: 'Documentação do TuxSQL', home: 'Documentação', search: 'Buscar na documentação', nav: 'Nesta página', license: 'Licença e avisos de terceiros', contents: 'Conteúdo', chromium: 'Abrir avisos do Electron e Chromium', chromiumHint: 'Os avisos do Chromium são instalados ao lado do executável do TuxSQL quando fornecidos pelo Electron.' }
}
const allowTags = new Set('a abbr b blockquote br caption code del details div em h1 h2 h3 h4 h5 h6 hr i img li ol p pre s samp small span strong sub summary sup table tbody td th thead tr ul'.split(' '))
const allowAttrs = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  ol: new Set(['start']),
  td: new Set(['align']), th: new Set(['align']),
  code: new Set(['class'])
}
const forbiddenScheme = /^(?:javascript|data|vbscript|file|blob):/i

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|#39|#x[0-9a-f]+|#\d+);/gi, (entity) => {
    const lower = entity.toLowerCase()
    if (lower === '&amp;') return '&'
    if (lower === '&lt;') return '<'
    if (lower === '&gt;') return '>'
    if (lower === '&quot;') return '"'
    if (lower === '&#39;') return "'"
    const hex = /^&#x([0-9a-f]+);$/i.exec(entity)
    const dec = /^&#(\d+);$/.exec(entity)
    const point = hex ? Number.parseInt(hex[1], 16) : dec ? Number.parseInt(dec[1], 10) : NaN
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  })
}

function normalizeDestination(raw, sourceFile, lang, isImage = false) {
  const value = decodeEntities(String(raw ?? '').trim())
  if (!value || forbiddenScheme.test(value) || [...value].some((character) => (character.codePointAt(0) ?? 0) < 0x21)) return ''
  if (/^https:/i.test(value)) {
    if (isImage) return ''
    try {
      const external = new URL(value)
      if (!external.hostname || external.username || external.password) return ''
      return external.href
    } catch { return '' }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return ''
  if (isImage && value.startsWith('data:')) return ''
  const [pathPart, suffix = ''] = value.split(/(?=[?#])/, 2)
  if (!pathPart) return suffix
  const target = pathPart.endsWith('.md') ? `${pathPart.slice(0, -3)}.html` : pathPart
  const resolved = resolve(dirname(sourceFile), target)
  const docSourceRoot = resolve(repositoryRoot, 'document/user-guide/preview', lang)
  const fallbackRoot = resolve(repositoryRoot, 'document/user-guide')
  const allowedRoot = sourceFile.startsWith(`${docSourceRoot}${sep}`) ? docSourceRoot : fallbackRoot
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${sep}`)) return ''
  const relativeTarget = relative(allowedRoot, resolved).split(sep).join('/')
  return `${relativeTarget}${suffix}`
}

function sanitizeHtml(markdownHtml, sourceFile, lang) {
  const safe = []
  const tags = /<\/?([a-zA-Z][\w-]*)([^<>]*)>/g
  let cursor = 0
  for (const match of markdownHtml.matchAll(tags)) {
    const index = match.index ?? 0
    safe.push(markdownHtml.slice(cursor, index))
    cursor = index + match[0].length
    const tag = match[1].toLowerCase()
    if (!allowTags.has(tag)) continue
    const closing = match[0].startsWith('</')
    const attrs = []
    const allowed = allowAttrs[tag] ?? new Set()
    const attrRegex = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    for (const attrMatch of match[2].matchAll(attrRegex)) {
      const attr = attrMatch[1].toLowerCase()
      if (!allowed.has(attr)) continue
      let value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''
      if (tag === 'a' && attr === 'href') {
        value = normalizeDestination(value, sourceFile, lang)
        if (!value) continue
        if (/^https:/i.test(value)) attrs.push('target="_blank"', 'rel="noopener noreferrer"')
      } else if (tag === 'img' && attr === 'src') {
        value = normalizeDestination(value, sourceFile, lang, true)
        if (!value) continue
      } else if (attr === 'class' && tag === 'code') {
        if (!/^language-[a-z0-9_-]{1,32}$/i.test(value)) continue
      } else if ((attr === 'width' || attr === 'height' || attr === 'start') && !/^\d{1,4}$/.test(value)) continue
      else if (attr === 'align' && !/^(?:left|right|center)$/i.test(value)) continue
      attrs.push(`${attr}="${escapeHtml(value)}"`)
    }
    if (closing) safe.push(`</${tag}>`)
    else safe.push(`<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`)
  }
  safe.push(markdownHtml.slice(cursor))
  return safe.join('')
}

function safeTitle(text, file) {
  const match = /^\s*#\s+(.+)$/m.exec(text)
  return match?.[1]?.trim() || basename(file, extname(file)).replaceAll('-', ' ')
}

function htmlShell({ lang, title, content, active, navItems }) {
  const strings = languageCopy[lang]
  const links = navItems.map((item) => `<a href="${escapeHtml(item.file)}"${item.file === active ? ' aria-current="page"' : ''}>${escapeHtml(item.title)}</a>`).join('\n')
  const csp = "default-src 'none'; style-src 'self'; img-src 'self' data:; script-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'"
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escapeHtml(title)} · TuxSQL</title><link rel="stylesheet" href="docs.css"><script src="docs.js" defer></script></head>
<body><header class="topbar"><a class="brand" href="index.html">TuxSQL</a><span>${escapeHtml(strings.home)}</span><input id="doc-search" type="search" placeholder="${escapeHtml(strings.search)}" aria-label="${escapeHtml(strings.search)}"></header>
<div class="layout"><aside class="sidebar" aria-label="${escapeHtml(strings.contents)}"><h2>${escapeHtml(strings.contents)}</h2><nav>${links}</nav></aside><main><article>${content}</article>${active === 'license.html' ? `<section class="license-extra"><h2>${escapeHtml(strings.chromium)}</h2><p>${escapeHtml(strings.chromiumHint)}</p><button id="chromium-license" type="button">${escapeHtml(strings.chromium)}</button><h2>Third-party notices</h2><pre>${escapeHtml(globalThis.__TUXSQL_NOTICES__ ?? '')}</pre></section>` : ''}</main></div></body></html>`
}

async function walkMarkdown(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) files.push(...await walkMarkdown(path))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(path)
  }
  return files.sort()
}

function loadLicenses() {
  return JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--json'], { cwd: appRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }))
}

function packageForModule(moduleId) {
  const cleanId = moduleId.replace(/^\0/, '').split('?')[0]
  if (!cleanId.includes(`${sep}node_modules${sep}`)) return undefined
  const nodeModulesRoot = resolve(appRoot, 'node_modules')
  let directory = dirname(cleanId)
  while (directory.startsWith(nodeModulesRoot)) {
    const packageFile = resolve(directory, 'package.json')
    if (existsSync(packageFile)) {
      try {
        const metadata = JSON.parse(readFileSync(packageFile, 'utf8'))
        if (typeof metadata.name === 'string' && typeof metadata.version === 'string') return { name: metadata.name, version: metadata.version }
      } catch { return undefined }
    }
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return undefined
}

function expandLicenseRows(groups) {
  return Object.entries(groups).flatMap(([spdx, rows]) => rows.flatMap((row) => row.versions.map((version, index) => ({
    ...row,
    versions: [version],
    paths: [row.paths[index] ?? row.paths[0]],
    spdx
  }))))
}

function collectLicenseEntries() {
  const licenseRows = expandLicenseRows(loadLicenses())
  const productionGroups = JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--json', '--prod'], { cwd: appRoot, encoding: 'utf8' }))
  const includedKeys = new Set(expandLicenseRows(productionGroups).map((row) => `${row.name}@${row.versions[0]}`))
  const electronVersion = JSON.parse(readFileSync(resolve(appRoot, 'node_modules/electron/package.json'), 'utf8')).version
  includedKeys.add(`electron@${electronVersion}`)
  const moduleInventoryPath = resolve(buildRoot, 'renderer-bundle-modules.json')
  if (existsSync(moduleInventoryPath)) {
    for (const modulePath of JSON.parse(readFileSync(moduleInventoryPath, 'utf8'))) {
      const modulePackage = packageForModule(modulePath)
      if (modulePackage) includedKeys.add(`${modulePackage.name}@${modulePackage.version}`)
    }
  }
  const byPackage = new Map()
  for (const row of licenseRows) {
    const key = `${row.name}@${row.versions?.[0] ?? 'unknown'}`
    if (includedKeys.has(key)) byPackage.set(key, row)
  }
  for (const key of includedKeys) {
    if (!byPackage.has(key)) throw new Error(`No license metadata found for packaged dependency ${key}`)
  }
  const entries = [...byPackage.values()].sort((a, b) => a.name.localeCompare(b.name) || a.versions[0].localeCompare(b.versions[0]))
  const unknown = entries.filter((entry) => !entry.spdx || /unknown|unlicensed/i.test(entry.spdx))
  const strongCopyleft = entries.filter((entry) => /\b(?:AGPL|GPL)(?:-|\b)/i.test(entry.spdx))
  if (unknown.length || strongCopyleft.length) throw new Error(`Unsafe or unknown bundled licenses: ${[...unknown, ...strongCopyleft].map((entry) => `${entry.name} (${entry.spdx})`).join(', ')}`)
  return entries
}

async function readLicenseText(entry) {
  const packagePath = entry.paths?.[0]
  if (!packagePath) return `License text was not available in the installed package. SPDX: ${entry.spdx}. URL: ${entry.homepage ?? 'not provided'}.`
  const files = await readdir(packagePath).catch(() => [])
  const candidates = files.filter((file) => /^(?:license|copying|notice)(?:[._-].*)?$/i.test(file)).sort((a, b) => (a.toLowerCase().startsWith('license') ? -1 : 1) - (b.toLowerCase().startsWith('license') ? -1 : 1))
  const content = []
  for (const candidate of candidates) {
    if (extname(candidate) && !/\.(?:txt|md|rst)$/i.test(candidate)) continue
    const text = await readFile(resolve(packagePath, candidate), 'utf8').catch(() => '')
    if (text.trim()) content.push(`${candidate}\n${text.trim()}`)
    if (/^apache-2\.0$/i.test(entry.spdx) && /^notice(?:[._-].*)?$/i.test(candidate)) continue
    if (content.length && !/^apache-2\.0$/i.test(entry.spdx)) break
  }
  if (!content.length && /^mit$/i.test(entry.spdx)) {
    const holder = entry.author || entry.name
    content.push(`Upstream package metadata declares MIT; no standalone license file was shipped.\n\nMIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`)
  }
  if (!content.length) throw new Error(`No license or copyright text found for ${entry.name} (${entry.spdx})`)
  return content.join('\n\n')
}

function readFontVersion(buffer) {
  if (buffer.toString('ascii', 0, 4) !== '\u0000\u0001\u0000\u0000' && buffer.toString('ascii', 0, 4) !== 'OTTO') return 'version unavailable'
  const tableCount = buffer.readUInt16BE(4)
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16
    if (buffer.toString('ascii', record, record + 4) !== 'name') continue
    const offset = buffer.readUInt32BE(record + 8)
    const count = buffer.readUInt16BE(offset + 2)
    const stringsOffset = buffer.readUInt16BE(offset + 4)
    for (let nameIndex = 0; nameIndex < count; nameIndex += 1) {
      const nameRecord = offset + 6 + nameIndex * 12
      if (buffer.readUInt16BE(nameRecord + 6) !== 5) continue
      const length = buffer.readUInt16BE(nameRecord + 8)
      const start = offset + stringsOffset + buffer.readUInt16BE(nameRecord + 10)
      const platform = buffer.readUInt16BE(nameRecord)
      const nameBytes = buffer.subarray(start, start + length)
      const value = (platform === 0 || platform === 3) && nameBytes.length % 2 === 0
        ? Buffer.from(nameBytes).swap16().toString('utf16le')
        : nameBytes.toString('latin1')
      if (value) return value.replace(/^Version\s+/i, '')
    }
  }
  return 'version unavailable'
}

async function packagedFontNotices() {
  const inventoryPath = resolve(buildRoot, 'renderer-bundle-assets.json')
  if (!existsSync(inventoryPath)) throw new Error('Renderer asset inventory is missing; run the production build before generating license notices.')
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'))
  const fontAssets = inventory.filter((asset) => /\.(?:ttf|otf|woff2?)$/i.test(asset.fileName))
  const monaco = collectLicenseEntries().find((entry) => entry.name === 'monaco-editor')
  const sections = ['Packaged fonts']
  for (const asset of fontAssets) {
    const baseName = basename(asset.fileName).toLowerCase()
    if (baseName.includes('rubik-spray-paint')) {
      const font = resolve(appRoot, 'src/renderer/splash/fonts/rubik-spray-paint.ttf')
      const notice = resolve(appRoot, 'src/renderer/splash/fonts/OFL-rubik-spray.txt')
      sections.push(`\n${asset.fileName}\nName: Rubik Spray Paint\nVersion: ${readFontVersion(await readFile(font))}\nSPDX: OFL-1.1\nURL: https://github.com/NaN-xyz/Rubik-Filtered\n${(await readFile(notice, 'utf8')).trim()}`)
    } else if (baseName.includes('sedgwick-ave-display')) {
      const font = resolve(appRoot, 'src/renderer/splash/fonts/sedgwick-ave-display.ttf')
      const notice = resolve(appRoot, 'src/renderer/splash/fonts/OFL-sedgwick.txt')
      sections.push(`\n${asset.fileName}\nName: Sedgwick Ave Display\nVersion: ${readFontVersion(await readFile(font))}\nSPDX: OFL-1.1\nURL: https://github.com/googlefonts/sedgwickave\n${(await readFile(notice, 'utf8')).trim()}`)
    } else if (baseName.includes('codicon')) {
      if (!monaco) throw new Error('Bundled Monaco codicon font has no package license entry.')
      sections.push(`\n${asset.fileName}\nName: Monaco codicon font\nVersion: ${monaco.versions?.[0] ?? 'unknown'}\nSPDX: ${monaco.spdx}\nURL: ${monaco.homepage ?? 'https://microsoft.github.io/monaco-editor/'}\nCovered by the monaco-editor notice above.`)
    } else if (baseName.includes('inter-')) {
      const notice = resolve(appRoot, 'src/renderer/src/ui/fonts/Inter-OFL.txt')
      sections.push(`\n${asset.fileName}\nName: Inter\nVersion: 20\nSPDX: OFL-1.1\nURL: https://github.com/rsms/inter\n${(await readFile(notice, 'utf8')).trim()}`)
    } else if (baseName.includes('jetbrainsmono-')) {
      const notice = resolve(appRoot, 'src/renderer/src/ui/fonts/JetBrainsMono-OFL.txt')
      sections.push(`\n${asset.fileName}\nName: JetBrains Mono\nVersion: 24\nSPDX: OFL-1.1\nURL: https://github.com/JetBrains/JetBrainsMono\n${(await readFile(notice, 'utf8')).trim()}`)
    } else {
      throw new Error(`No font license mapping for bundled asset ${asset.fileName}`)
    }
  }
  if (!fontAssets.some((asset) => basename(asset.fileName).toLowerCase().includes('rubik-spray-paint')) || !fontAssets.some((asset) => basename(asset.fileName).toLowerCase().includes('sedgwick-ave-display'))) {
    throw new Error('Expected splash typefaces are not present in the renderer package inventory.')
  }
  sections.push('\nInter and JetBrains Mono are system-font fallbacks only when the bundled faces cannot be loaded; both families are also bundled from the pinned WOFF2 files above.')
  return sections.join('\n')
}

async function generateNotices() {
  const entries = collectLicenseEntries()
  const sections = [`THIRD-PARTY NOTICES — TuxSQL\n\nThis file lists packages included in the renderer bundle or packaged runtime dependencies. Package notices are reproduced from the installed package license files.\n`]
  for (const entry of entries) {
    sections.push(`\n================================================================================\n${entry.name} ${entry.versions?.[0] ?? 'version unknown'}\nSPDX: ${entry.spdx}\nURL: ${entry.homepage ?? 'not provided'}\n${entry.author ? `Copyright/author: ${entry.author}\n` : ''}\n${await readLicenseText(entry)}`)
  }
  sections.push(`\n================================================================================\nElectron and Chromium\nElectron ${JSON.parse(await readFile(resolve(appRoot, 'node_modules/electron/package.json'), 'utf8')).version} is included. Its license file ships with the packaged Electron runtime. Chromium notices are provided by Electron in LICENSES.chromium.html beside the executable when available; use the License page link to open that file.\n`)
  sections.push(`\n================================================================================\n${await packagedFontNotices()}\n`)
  const notices = sections.join('\n')
  await writeFile(resolve(repositoryRoot, 'THIRD-PARTY-NOTICES.txt'), notices)
  await writeFile(resolve(buildRoot, 'THIRD-PARTY-NOTICES.txt'), notices)
  return notices
}

async function buildDocs({ sourceRoot = resolve(repositoryRoot, 'document/user-guide/preview'), outputRoot = docsRoot, noticesOverride, licenseFile = resolve(repositoryRoot, 'LICENSE') } = {}) {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })
  const notices = noticesOverride ?? await generateNotices()
  globalThis.__TUXSQL_NOTICES__ = notices
  const licenseText = (await readFile(licenseFile, 'utf8')).trim()
  const built = { en: [], 'pt-BR': [] }
  for (const lang of ['en', 'pt-BR']) {
    const source = resolve(sourceRoot, lang)
    const fallbackSource = existsSync(source) ? source : resolve(repositoryRoot, 'document/user-guide')
    const files = await walkMarkdown(fallbackSource)
    if (!files.length && lang === 'en') throw new Error(`No documentation Markdown files found in ${source}`)
    const destination = resolve(outputRoot, lang)
    await mkdir(destination, { recursive: true })
    const docs = []
    for (const file of files) {
      const markdown = await readFile(file, 'utf8')
      const relativeFile = relative(fallbackSource, file).split(sep).join('/')
      let outputName = relativeFile.replace(/\.md$/i, '.html')
      if (/^(?:index|license)\.html$/i.test(outputName)) outputName = `guide-${outputName}`
      const renderer = new marked.Renderer()
      renderer.html = (token) => escapeHtml(typeof token === 'string' ? token : token.text)
      const html = String(await marked.parse(markdown, { gfm: true, breaks: false, renderer }))
      const content = sanitizeHtml(html, file, lang)
      docs.push({ file: outputName, title: safeTitle(markdown, file), content })
    }
    const strings = languageCopy[lang]
    const navItems = [{ file: 'index.html', title: strings.home }, { file: 'license.html', title: strings.license }, ...docs.map(({ file, title }) => ({ file, title }))]
    for (const doc of docs) {
      const page = htmlShell({ lang, title: doc.title, content: doc.content, active: doc.file, navItems })
      const target = resolve(destination, doc.file)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, page)
      built[lang].push(target)
    }
    const indexContent = `<h1>${escapeHtml(strings.home)}</h1><p>${escapeHtml(lang === 'pt-BR' ? 'Guias disponíveis para uso sem conexão.' : 'Guides available for offline use.')}</p><ul>${docs.map((doc) => `<li><a href="${escapeHtml(doc.file)}">${escapeHtml(doc.title)}</a></li>`).join('')}</ul>`
    await writeFile(resolve(destination, 'index.html'), htmlShell({ lang, title: strings.title, content: indexContent, active: 'index.html', navItems }))
    const licenseHtml = `<h1>${escapeHtml(strings.license)}</h1><h2>${escapeHtml(lang === 'pt-BR' ? 'Licença MIT do TuxSQL' : 'TuxSQL MIT License')}</h2><pre>${escapeHtml(licenseText)}</pre>`
    await writeFile(resolve(destination, 'license.html'), htmlShell({ lang, title: strings.license, content: licenseHtml, active: 'license.html', navItems }))
  }
  for (const lang of ['en', 'pt-BR']) {
    const folder = resolve(outputRoot, lang)
    if (!existsSync(folder)) continue
    await writeFile(resolve(folder, 'docs.css'), css)
    await writeFile(resolve(folder, 'docs.js'), runtimeScript)
  }
  return built
}

const css = `:root{color-scheme:light;--color-canvas-app:#f1f5f9;--color-surface-base:#fff;--color-surface-raised:#f8fafc;--text-primary:#0f172a;--text-secondary:#334155;--color-accent:#0e7490;--border-default:#cbd5e1;--shadow-md:0 4px 6px #0002;--radius-md:8px;--space-2:8px;--space-4:16px;--space-8:32px;font-family:Inter,system-ui,sans-serif;background:var(--color-canvas-app,#f1f5f9);color:var(--text-primary,#0f172a)}:root[data-theme=dark]{color-scheme:dark;--color-canvas-app:#0b0f17;--color-surface-base:#131924;--color-surface-raised:#1a2234;--text-primary:#f8fafc;--text-secondary:#cbd5e1;--color-accent:#38bdf8;--border-default:#2a364f;--shadow-md:0 4px 6px #0008}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;--color-canvas-app:#0b0f17;--color-surface-base:#131924;--color-surface-raised:#1a2234;--text-primary:#f8fafc;--text-secondary:#cbd5e1;--color-accent:#38bdf8;--border-default:#2a364f}}*{box-sizing:border-box}body{margin:0;background:var(--color-canvas-app,#f1f5f9);color:var(--text-primary,#0f172a)}a{color:var(--color-accent,#0e7490)}.topbar{position:sticky;top:0;z-index:2;display:flex;gap:var(--space-4,16px);align-items:center;padding:var(--space-2,8px) var(--space-4,16px);background:var(--color-surface-raised,#f8fafc);border-bottom:1px solid var(--border-default,#cbd5e1)}.brand{font-weight:700;text-decoration:none}.topbar input{margin-left:auto;width:min(360px,50vw);padding:8px;border:1px solid var(--border-default,#cbd5e1);border-radius:var(--radius-md,8px);background:var(--color-surface-base,#fff);color:inherit}.layout{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);min-height:calc(100vh - 48px)}.sidebar{position:sticky;top:49px;height:calc(100vh - 49px);overflow:auto;padding:var(--space-4,16px);background:var(--color-surface-raised,#f8fafc);border-right:1px solid var(--border-default,#cbd5e1)}.sidebar h2{font-size:14px}.sidebar nav{display:grid;gap:5px}.sidebar nav a{padding:6px 8px;text-decoration:none;border-radius:var(--radius-md,8px);color:var(--text-secondary,#334155)}.sidebar nav a[aria-current=page]{background:var(--color-surface-base,#fff);color:var(--color-accent,#0e7490);font-weight:600}main{min-width:0;padding:clamp(20px,4vw,56px)}article,.license-extra{max-width:920px;margin:auto;line-height:1.65}article h1,article h2,article h3{line-height:1.2}pre{overflow:auto;padding:var(--space-4,16px);background:var(--color-surface-raised,#f8fafc);border:1px solid var(--border-default,#cbd5e1);border-radius:var(--radius-md,8px);white-space:pre-wrap}code{font-family:'JetBrains Mono','Fira Code',monospace;background:var(--color-surface-raised,#f8fafc);padding:2px 4px;border-radius:4px}pre code{padding:0}.license-extra{margin-top:28px}.license-extra button{padding:8px 12px;border:1px solid var(--border-default,#cbd5e1);border-radius:var(--radius-md,8px);background:var(--color-surface-raised,#f8fafc);color:inherit;cursor:pointer}.license-extra pre{max-height:520px}@media(max-width:760px){.layout{grid-template-columns:1fr}.sidebar{position:static;height:auto;max-height:240px;border-right:0;border-bottom:1px solid var(--border-default,#cbd5e1)}main{padding:20px}}`
const runtimeScript = `(()=>{const query=new URLSearchParams(location.search);const requested=query.get('theme');if(requested==='dark'||requested==='light')localStorage.setItem('tuxsql-doc-theme',requested);const stored=localStorage.getItem('tuxsql-doc-theme');if(stored==='light'||stored==='dark')document.documentElement.dataset.theme=stored;else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark';const search=document.getElementById('doc-search');search?.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();document.querySelectorAll('.sidebar nav a').forEach(a=>{a.hidden=!!q&&!a.textContent.toLowerCase().includes(q)})});document.getElementById('chromium-license')?.addEventListener('click',()=>window.open('tuxsql-internal://chromium-license','_blank'))})();`

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const built = await buildDocs()
  console.log(`Generated offline docs: en=${built.en.length} pages, pt-BR=${built['pt-BR'].length} pages`)
}

export { buildDocs, collectLicenseEntries, generateNotices, normalizeDestination, sanitizeHtml }
