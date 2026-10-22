import { describe, expect, it } from 'vitest'
import { isAllowedWindowPermission } from '../src/main/security/permissionPolicy.js'

describe('Chromium window permission policy', () => {
  const primary = {}
  const docs = {}

  it.each(['camera', 'microphone', 'media', 'geolocation', 'notifications', 'midi', 'midiSysex'])('denies %s', (permission) => {
    expect(isAllowedWindowPermission(primary, permission, primary)).toBe(false)
  })

  it.each(['clipboard-read', 'clipboard-sanitized-write'])('allows %s only to the primary window', (permission) => {
    expect(isAllowedWindowPermission(primary, permission, primary)).toBe(true)
    expect(isAllowedWindowPermission(docs, permission, primary)).toBe(false)
    expect(isAllowedWindowPermission(null, permission, primary)).toBe(false)
    expect(isAllowedWindowPermission(primary, permission, undefined)).toBe(false)
  })

  it('denies permissions outside the explicit clipboard allowlist', () => {
    expect(isAllowedWindowPermission(primary, 'fullscreen', primary)).toBe(false)
    expect(isAllowedWindowPermission(primary, 'deprecated-sync-clipboard-read', primary)).toBe(false)
  })
})
