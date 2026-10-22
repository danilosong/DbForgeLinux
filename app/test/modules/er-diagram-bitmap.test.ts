import { describe, expect, it } from 'vitest'
import { encodeBmp24, encodeGif, encodeTiff24 } from '../../src/modules/er-diagram/bitmap.js'

describe('ER diagram BMP export', () => {
  it('encodes bottom-up 24-bit pixels with padded rows and a valid BMP header', () => {
    const bitmap = encodeBmp24(1, 2, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))
    expect([...bitmap.slice(0, 2)]).toEqual([0x42, 0x4d])
    expect(new DataView(bitmap.buffer).getUint32(2, true)).toBe(62)
    expect([...bitmap.slice(54, 62)]).toEqual([0, 255, 0, 0, 0, 0, 255, 0])
  })
})

describe('ER diagram TIFF export', () => {
  it('writes a baseline little-endian RGB TIFF with the image bytes referenced by its IFD', () => {
    const image = encodeTiff24(1, 1, new Uint8ClampedArray([12, 34, 56, 255]))
    const view = new DataView(image.buffer)
    expect([...image.slice(0, 4)]).toEqual([0x49, 0x49, 42, 0])
    expect(view.getUint32(4, true)).toBe(8)
    const entries = view.getUint16(8, true)
    const strip = 10 + 5 * 12
    expect(view.getUint16(strip, true)).toBe(273)
    expect(image.slice(view.getUint32(strip + 8, true))).toEqual(new Uint8Array([12, 34, 56]))
    expect(entries).toBe(10)
  })
})

describe('ER diagram GIF export', () => {
  it('writes a GIF89a image with palette, image data and trailer', () => {
    const image = encodeGif(2, 1, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))
    expect(new TextDecoder().decode(image.slice(0, 6))).toBe('GIF89a')
    expect(new DataView(image.buffer).getUint16(6, true)).toBe(2)
    expect(new DataView(image.buffer).getUint16(8, true)).toBe(1)
    expect(image).toContain(0x2c)
    expect(image.at(-1)).toBe(0x3b)
    expect(() => encodeGif(0, 1, new Uint8ClampedArray())).toThrow('Invalid GIF dimensions')
  })
})
