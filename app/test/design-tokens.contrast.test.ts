import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../')
const tokensCss = readFileSync(resolve(root, 'document/ux/tokens-v2.css'), 'utf8')
const stylesCss = readFileSync(resolve(root, 'app/src/renderer/src/ui/styles.css'), 'utf8')
const entrySource = readFileSync(resolve(root, 'app/src/renderer/src/main.tsx'), 'utf8')
const fontCss = readFileSync(resolve(root, 'app/src/renderer/src/ui/fonts.css'), 'utf8')
const fontDirectory = resolve(root, 'app/src/renderer/src/ui/fonts')

function declarations(css: string, selector: string): Record<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1]
  if (!rule) throw new Error(`Missing CSS rule: ${selector}`)
  return Object.fromEntries([...rule.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

function computedTokens(theme: 'light' | 'dark'): Record<string, string> {
  const result = {
    ...declarations(tokensCss, ':root'),
    ...(theme === 'dark' ? declarations(tokensCss, ":root[data-theme='dark']") : {}),
    ...declarations(stylesCss, ':root')
  }
  const resolveValue = (name: string, seen = new Set<string>()): string => {
    if (seen.has(name)) throw new Error(`Circular CSS variable: ${[...seen, name].join(' -> ')}`)
    const value = result[name]
    if (!value) throw new Error(`Missing CSS variable: ${name}`)
    const nextSeen = new Set(seen).add(name)
    return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]*))?\)/g, (_match, dependency: string, fallback?: string) => {
      if (!result[dependency] && fallback) return fallback.trim()
      return resolveValue(dependency, nextSeen)
    })
  }
  return Object.fromEntries(Object.keys(result).map((name) => [name, resolveValue(name)]))
}

function luminance(color: string): number {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (!hex) throw new Error(`Expected a solid hex color, got ${color}`)
  const channels = hex.length === 3
    ? [...hex].map((channel) => Number.parseInt(channel + channel, 16))
    : hex.match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16))
  const linear = channels.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('design token contrast', () => {
  it.each(['light', 'dark'] as const)('computes final %s tokens from the imported CSS cascade', (theme) => {
    const tokens = computedTokens(theme)
    const pairs: Array<[string, string, string, number]> = [
      ['primary on base', '--text-primary', '--color-surface-base', 4.5],
      ['primary on canvas', '--text-primary', '--color-canvas-app', 4.5],
      ['primary on raised', '--text-primary', '--color-surface-raised', 4.5],
      ['secondary on base', '--text-secondary', '--color-surface-base', 4.5],
      ['secondary on canvas', '--text-secondary', '--color-canvas-app', 4.5],
      ['secondary on raised', '--text-secondary', '--color-surface-raised', 4.5],
      ['tertiary on base', '--text-tertiary', '--color-surface-base', 4.5],
      ['tertiary on canvas', '--text-tertiary', '--color-canvas-app', 4.5],
      ['tertiary on raised', '--text-tertiary', '--color-surface-raised', 4.5],
      ['tertiary on hover', '--text-tertiary', '--color-surface-hover', 4.5],
      ['text on accent', '--text-on-accent', '--color-accent', 4.5],
      ['accent text on base', '--color-accent-text', '--color-surface-base', 4.5],
      ['focus border on base', '--border-focus', '--color-surface-base', 3],
      ['control border on base', '--border-control', '--color-surface-base', 3],
      ['control border on raised', '--border-control', '--color-surface-raised', 3],
      ['control border on canvas', '--border-control', '--color-canvas-app', 3]
    ]
    for (const environment of ['dev', 'test', 'sandbox', 'prod']) {
      pairs.push([`${environment} badge text`, `--env-${environment}-text`, `--env-${environment}-bg`, 4.5])
      pairs.push([`${environment} badge border`, `--env-${environment}-border`, theme === 'light' ? '--color-canvas-app' : '--color-surface-base', 3])
    }
    for (const [label, foreground, background, minimum] of pairs) {
      const ratio = contrast(tokens[foreground], tokens[background])
      expect(ratio, `${theme}: ${label} (${tokens[foreground]} / ${tokens[background]})`).toBeGreaterThanOrEqual(minimum)
    }
    expect(tokens['--color-accent']).toBe(theme === 'light' ? '#0e7490' : '#38bdf8')
    expect(stylesCss).toMatch(/:where\([^}]+\):focus-visible\s*\{\s*outline:\s*2px solid var\(--border-focus\)/)
    expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('imports tokens before font and component styles', () => {
    const tokensIndex = entrySource.indexOf("document/ux/tokens-v2.css")
    const fontsIndex = entrySource.indexOf("./ui/fonts.css")
    const stylesIndex = entrySource.indexOf("./ui/styles.css")
    expect(tokensIndex).toBeGreaterThanOrEqual(0)
    expect(tokensIndex).toBeLessThan(fontsIndex)
    expect(fontsIndex).toBeLessThan(stylesIndex)
  })

  it('pins packaged font subsets and uses only local WOFF2 files', () => {
    const lines = readFileSync(resolve(fontDirectory, 'SHA256SUMS'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(12)
    for (const line of lines) {
      const [expectedHash, file] = line.trim().split(/\s+/)
      const bytes = readFileSync(resolve(fontDirectory, file))
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(expectedHash)
      expect(fontCss).toContain(`./fonts/${file}`)
    }
    expect(fontCss).not.toMatch(/https?:\/\//)
    expect(readFileSync(resolve(fontDirectory, 'Inter-OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE')
    expect(readFileSync(resolve(fontDirectory, 'JetBrainsMono-OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE')
  })
})
