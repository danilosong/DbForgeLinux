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
