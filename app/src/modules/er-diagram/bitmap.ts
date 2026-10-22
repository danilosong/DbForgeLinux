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
