export function encodeBmp24(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || rgba.length !== width * height * 4) throw new Error('Invalid bitmap dimensions or pixel buffer.')
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelSize = rowSize * height
  const output = new Uint8Array(54 + pixelSize)
  const view = new DataView(output.buffer)
  output[0] = 0x42; output[1] = 0x4d
  view.setUint32(2, output.length, true); view.setUint32(10, 54, true)
  view.setUint32(14, 40, true); view.setInt32(18, width, true); view.setInt32(22, height, true)
  view.setUint16(26, 1, true); view.setUint16(28, 24, true); view.setUint32(34, pixelSize, true)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = ((height - y - 1) * width + x) * 4
    const target = 54 + y * rowSize + x * 3
    output[target] = rgba[source + 2]!; output[target + 1] = rgba[source + 1]!; output[target + 2] = rgba[source]!
  }
  return output
}

/** Encodes an opaque GIF using a 3-3-2 RGB palette and bounded-memory LZW blocks. */
export function encodeGif(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  if (!Number.isInteger(width) || width < 1 || width > 65535 || !Number.isInteger(height) || height < 1 || height > 65535 || rgba.length !== width * height * 4) throw new Error('Invalid GIF dimensions or pixel buffer.')
  const output: number[] = []
  const word = (value: number): void => { output.push(value & 0xff, (value >>> 8) & 0xff) }
  output.push(...[...`GIF89a`].map((character) => character.charCodeAt(0)))
  word(width); word(height)
  output.push(0xf7, 0, 0) // Global 256-color table, 8-bit color resolution.
  for (let index = 0; index < 256; index++) output.push(((index >>> 5) & 7) * 255 / 7, ((index >>> 2) & 7) * 255 / 7, (index & 3) * 255 / 3)
  output.push(0x2c, 0, 0, 0, 0); word(width); word(height); output.push(0)
  const bytes: number[] = []
  let bits = 0; let bitCount = 0
  const code = (value: number): void => { bits |= value << bitCount; bitCount += 9; while (bitCount >= 8) { bytes.push(bits & 0xff); bits >>>= 8; bitCount -= 8 } }
  code(256)
  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * 4
    const palette = (rgba[offset]! & 0xe0) | ((rgba[offset + 1]! & 0xe0) >>> 3) | (rgba[offset + 2]! >>> 6)
    code(palette)
    code(256) // Reset dictionary before it grows; keeps code width fixed and memory bounded.
  }
  code(257)
  if (bitCount) bytes.push(bits & 0xff)
  for (let offset = 0; offset < bytes.length; offset += 255) { const chunk = bytes.slice(offset, offset + 255); output.push(chunk.length, ...chunk) }
  output.push(0, 0x3b)
  return Uint8Array.from(output)
}

export function encodeTiff24(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || rgba.length !== width * height * 4) throw new Error('Invalid TIFF dimensions or pixel buffer.')
  const entries = 10; const ifdOffset = 8; const ifdSize = 2 + entries * 12 + 4; const bitsOffset = ifdOffset + ifdSize; const pixelOffset = bitsOffset + 6
  const output = new Uint8Array(pixelOffset + width * height * 3); const view = new DataView(output.buffer)
  output[0] = 0x49; output[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, ifdOffset, true); view.setUint16(ifdOffset, entries, true)
  const tag = (index: number, id: number, type: number, count: number, value: number): void => { const offset = ifdOffset + 2 + index * 12; view.setUint16(offset, id, true); view.setUint16(offset + 2, type, true); view.setUint32(offset + 4, count, true); if (type === 3 && count === 1) view.setUint16(offset + 8, value, true); else view.setUint32(offset + 8, value, true) }
  tag(0, 256, 4, 1, width); tag(1, 257, 4, 1, height); tag(2, 258, 3, 3, bitsOffset); tag(3, 259, 3, 1, 1); tag(4, 262, 3, 1, 2); tag(5, 273, 4, 1, pixelOffset); tag(6, 277, 3, 1, 3); tag(7, 278, 4, 1, height); tag(8, 279, 4, 1, width * height * 3); tag(9, 284, 3, 1, 1)
  view.setUint32(ifdOffset + 2 + entries * 12, 0, true); view.setUint16(bitsOffset, 8, true); view.setUint16(bitsOffset + 2, 8, true); view.setUint16(bitsOffset + 4, 8, true)
  for (let pixel = 0; pixel < width * height; pixel++) { const source = pixel * 4; const target = pixelOffset + pixel * 3; output[target] = rgba[source]!; output[target + 1] = rgba[source + 1]!; output[target + 2] = rgba[source + 2]! }
  return output
}
