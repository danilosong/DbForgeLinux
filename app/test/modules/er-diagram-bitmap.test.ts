import { describe, expect, it } from 'vitest'
import { encodeBmp24 } from '../../src/modules/er-diagram/bitmap.js'

describe('ER diagram BMP export', () => {
  it('encodes bottom-up 24-bit pixels with padded rows and a valid BMP header', () => {
    const bitmap = encodeBmp24(1, 2, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))
    expect([...bitmap.slice(0, 2)]).toEqual([0x42, 0x4d])
    expect(new DataView(bitmap.buffer).getUint32(2, true)).toBe(62)
    expect([...bitmap.slice(54, 62)]).toEqual([0, 255, 0, 0, 0, 0, 255, 0])
  })
})
