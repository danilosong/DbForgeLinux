/* global process */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDocs, collectLicenseEntries, generateNotices, languageCopy } from '../scripts/build-docs.mjs'
import { ptBrModulesDocs } from '../src/renderer/src/i18n/ptBrModulesDocs.ts'

let scratch

async function createRendererInventoryFixtures() {
  scratch ??= await mkdtemp(join(tmpdir(), 'tuxsql-docs-build-'))
  const rendererModulesPath = join(scratch, 'renderer-bundle-modules.json')
  const rendererAssetsPath = join(scratch, 'renderer-bundle-assets.json')
  const appRoot = process.cwd()
  await writeFile(rendererModulesPath, JSON.stringify([
    resolve(appRoot, 'node_modules/@monaco-editor/react/dist/index.js'),
    resolve(appRoot, 'node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon.js'),
    resolve(appRoot, 'node_modules/echarts/lib/echarts.js'),
    resolve(appRoot, 'node_modules/.pnpm/echarts@6.1.0/node_modules/zrender/lib/zrender.js')
  ]))
  await writeFile(rendererAssetsPath, JSON.stringify([
    { fileName: 'assets/rubik-spray-paint-fixture.ttf' },
    { fileName: 'assets/sedgwick-ave-display-fixture.ttf' },
    { fileName: 'assets/codicon-fixture.ttf' },
    { fileName: 'assets/Inter-400-latin-fixture.woff2' },
    { fileName: 'assets/JetBrainsMono-400-latin-fixture.woff2' }
  ]))
  return { rendererModulesPath, rendererAssetsPath }
}

afterEach(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true })
  scratch = undefined
})

describe('offline documentation build', () => {
  it('keeps the Portuguese page labels aligned with the app translation catalog', () => {
    expect(languageCopy['pt-BR'].title).toBe(ptBrModulesDocs['docs.title'])
    expect(languageCopy['pt-BR'].home).toBe('Documentação')
    expect(languageCopy['pt-BR'].contents).toBe(ptBrModulesDocs['docs.contents'])
    expect(languageCopy['pt-BR'].search).toBe(ptBrModulesDocs['docs.search'])
    expect(languageCopy['pt-BR'].license).toBe(ptBrModulesDocs['docs.license'])
    expect(languageCopy['pt-BR'].chromium).toBe(ptBrModulesDocs['docs.chromium'])
    expect(languageCopy['pt-BR'].chromiumHint).toBe(ptBrModulesDocs['docs.chromium.hint'])
  })

  it('generates localized static pages and blocks unsafe Markdown HTML and destinations', async () => {
    scratch = await mkdtemp(join(tmpdir(), 'tuxsql-docs-build-'))
    const source = join(scratch, 'source')
    const output = join(scratch, 'output')
    const licenseFile = join(scratch, 'LICENSE')
    for (const lang of ['en', 'pt-BR']) {
      await mkdir(join(source, lang), { recursive: true })
      await writeFile(join(source, lang, 'index.md'), `# ${lang} guide\n\n[Safe guide](child.md) · [External](https://docs.example.test) · [Unsafe](javascript:alert(1))\n\n<script>window.pwned=true</script><iframe src="https://bad.example"></iframe>\n`)
      await writeFile(join(source, lang, 'child.md'), '# Child page\n')
    }
    await writeFile(licenseFile, 'MIT LICENSE FIXTURE\n')
    const built = await buildDocs({ sourceRoot: source, outputRoot: output, licenseFile, noticesOverride: 'NOTICE FIXTURE' })
    const en = await readFile(join(output, 'en/index.html'), 'utf8')
    const pt = await readFile(join(output, 'pt-BR/index.html'), 'utf8')
    const page = await readFile(join(output, 'en/guide-index.html'), 'utf8')
    const license = await readFile(join(output, 'en/license.html'), 'utf8')
    expect(built.en).toHaveLength(2)
    expect(built['pt-BR']).toHaveLength(2)
    expect(en).toContain('<html lang="en">')
    expect(pt).toContain('<html lang="pt-BR">')
    expect(page).toContain('child.html')
    expect(page).toContain('rel="noopener noreferrer"')
    expect(page).toContain('&lt;script&gt;window.pwned=true&lt;/script&gt;')
    expect(page).not.toContain('<script>window.pwned=true</script>')
    expect(page).not.toContain('<iframe')
    expect(page).not.toContain('javascript:')
    expect(license).toContain('MIT LICENSE FIXTURE')
    expect(license).toContain('NOTICE FIXTURE')
    expect(await readFile(join(output, 'en/docs.css'), 'utf8')).toContain('--color-surface-base')
    expect(await readFile(join(output, 'pt-BR/docs.js'), 'utf8')).toContain('tuxsql-doc-theme')
  })

  it('has a known permissive license record for every renderer bundle package and production dependency', async () => {
    const { rendererModulesPath } = await createRendererInventoryFixtures()
    const entries = collectLicenseEntries({ rendererModulesPath })
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((entry) => entry.name === 'react')).toBe(true)
    expect(entries.some((entry) => entry.name === '@monaco-editor/react')).toBe(true)
    expect(entries.some((entry) => entry.name === 'monaco-editor')).toBe(true)
    expect(entries.some((entry) => entry.name === 'echarts')).toBe(true)
    expect(entries.some((entry) => entry.name === 'zrender')).toBe(true)
    expect(entries.some((entry) => entry.name === 'mysql2')).toBe(true)
    expect(entries.every((entry) => entry.spdx && !/unknown|unlicensed|\b(?:AGPL|GPL)(?:-|\b)/i.test(entry.spdx))).toBe(true)
    expect(entries.every((entry) => entry.versions?.[0] && entry.homepage)).toBe(true)
  })

  it('writes complete package, project, and bundled-font notices to both required destinations', async () => {
    const { rendererModulesPath, rendererAssetsPath } = await createRendererInventoryFixtures()
    const rootOutputPath = join(scratch, 'THIRD-PARTY-NOTICES.txt')
    const packagedOutputPath = join(scratch, 'build-resources/THIRD-PARTY-NOTICES.txt')
    const notices = await generateNotices({ rendererAssetsPath, rendererModulesPath, rootOutputPath, packagedOutputPath })
    const entries = collectLicenseEntries({ rendererModulesPath })
    for (const entry of entries) {
      expect(notices).toContain(`${entry.name} ${entry.versions?.[0]}`)
      expect(notices).toContain(`SPDX: ${entry.spdx}`)
    }
    expect(notices).toContain('Rubik Spray Paint')
    expect(notices).toContain('Sedgwick Ave Display')
    expect(notices).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(notices).toContain('Inter and JetBrains Mono are system-font fallbacks only')
    const rootNotices = await readFile(rootOutputPath, 'utf8')
    const packagedNotices = await readFile(packagedOutputPath, 'utf8')
    expect(rootNotices).toBe(notices)
    expect(packagedNotices).toBe(notices)
  })

  it('embeds the complete repository MIT license in both localized license pages', async () => {
    scratch = await mkdtemp(join(tmpdir(), 'tuxsql-docs-license-'))
    const output = join(scratch, 'docs')
    const original = (await readFile(resolve(process.cwd(), '../LICENSE'), 'utf8')).trim()
    const escaped = original.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
    await buildDocs({ outputRoot: output, noticesOverride: 'NOTICE FIXTURE' })
    for (const lang of ['en', 'pt-BR']) expect(await readFile(join(output, lang, 'license.html'), 'utf8')).toContain(escaped)
  })
})
