import { describe, expect, it } from 'vitest'
import { isTrustedRendererNavigation, maySaveSqlToPath } from '../src/main/security/windowPolicy.js'

describe('renderer navigation policy', () => {
  it('allows only the current local renderer document or dev origin', () => {
    expect(isTrustedRendererNavigation('file:///opt/tuxsql/renderer/index.html', 'file:///opt/tuxsql/renderer/index.html#options')).toBe(true)
    expect(isTrustedRendererNavigation('file:///opt/tuxsql/renderer/index.html', 'file:///tmp/attacker.html')).toBe(false)
    expect(isTrustedRendererNavigation('http://localhost:5173/', 'http://localhost:5173/options')).toBe(true)
    expect(isTrustedRendererNavigation('http://localhost:5173/', 'https://attacker.example/')).toBe(false)
    expect(isTrustedRendererNavigation('http://localhost:5173/', 'javascript:alert(1)')).toBe(false)
  })
  it('allows SQL overwrite only for a path explicitly selected through Open or Save As', () => {
    expect(maySaveSqlToPath(new Set(['/tmp/query.sql']), '/tmp/query.sql')).toBe(true)
    expect(maySaveSqlToPath(new Set(['/tmp/query.sql']), '/etc/cron.d/task')).toBe(false)
    expect(maySaveSqlToPath(undefined, '/tmp/query.sql')).toBe(false)
  })
})
