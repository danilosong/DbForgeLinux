import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { aboutEnMessages, aboutPtBrMessages } from '../../src/renderer/src/i18n/aboutMessages.js'
import { importExportEnMessages, importExportPtBrMessages } from '../../src/renderer/src/i18n/importExportMessages.js'
import { menuEnMessages, menuPtBrMessages } from '../../src/renderer/src/i18n/menuMessages.js'
import { navigationEnMessages, navigationPtBrMessages } from '../../src/renderer/src/i18n/navigationMessages.js'
import { updaterEnMessages, updaterPtBrMessages } from '../../src/renderer/src/i18n/updaterMessages.js'
import { enMessages, ptBrCatalog } from '../../src/renderer/src/i18n/specMessages.js'
import { panelRegistry } from '../../src/renderer/src/ui/panels/registry.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/renderer/src/ui/panels')
const en = { ...enMessages, ...navigationEnMessages, ...aboutEnMessages, ...menuEnMessages, ...updaterEnMessages, ...importExportEnMessages }
const pt = { ...ptBrCatalog, ...navigationPtBrMessages, ...aboutPtBrMessages, ...menuPtBrMessages, ...updaterPtBrMessages, ...importExportPtBrMessages }

function sourceForRegisteredPanel(importPath: string): string {
  return readFileSync(resolve(root, `${importPath}/Panel.tsx`), 'utf8')
}

describe('registered panel localization', () => {
  it('has a real en and pt-BR title for every registered panel', () => {
    const missing: string[] = []
    for (const panel of panelRegistry) {
      if (!en[panel.titleKey] || en[panel.titleKey] === panel.titleKey) missing.push(`${panel.id}: missing or untranslated en ${panel.titleKey}`)
      if (!pt[panel.titleKey] || pt[panel.titleKey] === panel.titleKey) missing.push(`${panel.id}: missing or untranslated pt-BR ${panel.titleKey}`)
    }
    expect(missing).toEqual([])
  })

  it('translates every static t() key used by every registered panel', () => {
    const missing: string[] = []
    for (const match of readFileSync(resolve(root, 'registry.ts'), 'utf8').matchAll(/lazy\(\(\) => import\('\.\/([^']+)\/Panel'\)\)/g)) {
      const importPath = match[1]!
      const source = sourceForRegisteredPanel(importPath)
      for (const call of source.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) {
        const key = call[2]!
        if (!en[key] || en[key] === key) missing.push(`${importPath}: missing or untranslated en ${key}`)
        if (!pt[key] || pt[key] === key) missing.push(`${importPath}: missing or untranslated pt-BR ${key}`)
      }
      for (const call of source.matchAll(/\bt\(\s*`([^`]*)`/g)) {
        const pattern = call[1]!
        const prefix = pattern.split('${')[0]!
        if (!prefix) continue
        const dynamic = pattern.includes('${')
        const hasEn = dynamic ? Object.keys(en).some((key) => key.startsWith(prefix)) : Boolean(en[prefix])
        const hasPt = dynamic ? Object.keys(pt).some((key) => key.startsWith(prefix)) : Boolean(pt[prefix])
        if (!hasEn) missing.push(`${importPath}: missing en key/prefix ${prefix}`)
        if (!hasPt) missing.push(`${importPath}: missing pt-BR key/prefix ${prefix}`)
      }
    }
    expect(missing).toEqual([])
  })
})
